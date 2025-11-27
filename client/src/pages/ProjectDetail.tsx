import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatDateUK } from "@/lib/utils";
import type { Project, Task, DcmaAssessment, Workspace, CalendarException } from "@shared/schema";

interface GanttData {
  tasks: Array<{
    id: number;
    taskName: string;
    startDate: string;
    finishDate: string;
    duration: number;
    daysFromStart: number;
    percentComplete: number;
    isMilestone: boolean;
  }>;
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

function formatGanttData(tasks: Task[], projectStart: string | Date): GanttData {
  if (!tasks || !projectStart) return {
    tasks: [],
    startDate: new Date(),
    endDate: new Date(),
    totalDays: 0,
  };
  
  const startDate = new Date(projectStart);
  const criticalTasks = tasks.filter(t => t.isCriticalPath && !t.isSummary);
  
  const ganttTasks = criticalTasks.map(task => {
    const taskStart = task.startDate ? new Date(task.startDate) : startDate;
    const taskEnd = task.endDate ? new Date(task.endDate) : new Date(taskStart);
    
    const daysFromStart = Math.floor((taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Use duration from database if available, otherwise calculate
    let finalDuration = task.duration !== null && task.duration !== undefined ? parseInt(String(task.duration)) : 0;
    
    // Milestones should have 0 duration, regular tasks use database duration or calculate
    if (task.isMilestone) {
      finalDuration = 0;
    } else if (finalDuration === 0) {
      // Fallback calculation if no duration in database
      finalDuration = Math.max(1, Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    return {
      id: task.id,
      taskName: task.name,
      startDate: formatDateUK(taskStart),
      finishDate: formatDateUK(taskEnd),
      duration: finalDuration,
      daysFromStart: Math.max(0, daysFromStart),
      percentComplete: parseFloat(task.percentComplete || "0"),
      isMilestone: task.isMilestone || false,
    };
  }).sort((a, b) => a.daysFromStart - b.daysFromStart);

  // Calculate project end date for timeline
  const projectEndDate = ganttTasks.length > 0 
    ? new Date(startDate.getTime() + (Math.max(...ganttTasks.map(t => t.daysFromStart + t.duration)) * 24 * 60 * 60 * 1000))
    : new Date(startDate.getTime() + (365 * 24 * 60 * 60 * 1000));

  return {
    tasks: ganttTasks,
    startDate,
    endDate: projectEndDate,
    totalDays: Math.ceil((projectEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

function generateMonthHeaders(startDate: Date, endDate: Date): Array<{ month: string; startDay: number }> {
  const months: Array<{ month: string; startDay: number }> = [];
  const current = new Date(startDate);
  current.setDate(1);
  
  while (current <= endDate) {
    const dayDiff = Math.floor((new Date(current).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    months.push({
      month: current.toLocaleString('default', { month: 'short', year: '2-digit' }),
      startDay: Math.max(0, dayDiff),
    });
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [ignoreDelayTasks, setIgnoreDelayTasks] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", project?.workspaceId],
    enabled: !!project?.workspaceId,
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const { data: dcmaAssessment } = useQuery<DcmaAssessment>({
    queryKey: ["/api/projects", projectId, "dcma-assessments", "latest"],
    enabled: !!projectId,
  });

  const { data: calendarExceptions = [] } = useQuery<CalendarException[]>({
    queryKey: ["/api/projects", projectId, "exceptions"],
    enabled: !!projectId,
  });

  // Format date as ISO string for comparison
  const formatDateISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Calculate working days (Monday-Friday only, excluding calendar exceptions)
  const calculateWorkingDays = (startDate: Date, endDate: Date, exceptions: CalendarException[] | undefined): number => {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Create a set of exception dates for quick lookup
    const exceptionDates = new Set<string>();
    const exceptionArray = exceptions || [];
    for (const exc of exceptionArray) {
      const excStart = new Date(exc.startDate);
      const excEnd = new Date(exc.endDate);
      let excCurrent = new Date(excStart);
      
      while (excCurrent <= excEnd) {
        exceptionDates.add(formatDateISO(excCurrent));
        excCurrent.setDate(excCurrent.getDate() + 1);
      }
    }
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateISO = formatDateISO(current);
      
      // 1 = Monday, 5 = Friday (0 = Sunday, 6 = Saturday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !exceptionDates.has(dateISO)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };

  // Check if a summary task has any non-delay descendants
  const hasNonDelayDescendants = (taskId: number): boolean => {
    if (!tasks) return false;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.wbsCode) return false;
    
    const taskWbs = task.wbsCode;
    for (const t of tasks) {
      if (!t.wbsCode || t.id === taskId) continue;
      if (t.wbsCode.startsWith(taskWbs + '.')) {
        if (!t.name || !t.name.startsWith("Delay -")) {
          return true;
        }
      }
    }
    return false;
  };

  // Get all descendants of a task
  const getAllDescendants = (parentId: number, filterDelays: boolean = false): Task[] => {
    if (!tasks) return [];
    const parent = tasks.find(t => t.id === parentId);
    if (!parent || !parent.wbsCode) return [];
    
    const parentWbs = parent.wbsCode;
    const descendants: Task[] = [];
    
    for (const task of tasks) {
      if (!task.wbsCode || task.id === parentId) continue;
      
      if (filterDelays && task.name && task.name.startsWith("Delay -")) {
        continue;
      }
      
      if (task.wbsCode.startsWith(parentWbs + '.')) {
        if (filterDelays && task.isSummary && !hasNonDelayDescendants(task.id)) {
          continue;
        }
        descendants.push(task);
      }
    }
    return descendants;
  };

  // Get child tasks for a summary task
  const getChildTasks = (phaseId: number) => {
    if (!tasks) return [];
    const phase = tasks.find(t => t.id === phaseId);
    if (!phase || !phase.wbsCode) return [];
    
    const parentWbs = phase.wbsCode;
    const parentLevel = parentWbs.split('.').length;
    const expectedChildLevel = parentLevel + 1;
    
    const children: Task[] = [];
    for (const task of tasks) {
      if (!task.wbsCode || task.id === phaseId) continue;
      
      if (ignoreDelayTasks && task.name && task.name.startsWith("Delay -")) {
        continue;
      }
      
      const taskWbsParts = task.wbsCode.split('.');
      const taskLevel = taskWbsParts.length;
      
      if (taskLevel === expectedChildLevel && task.wbsCode.startsWith(parentWbs + '.') && task.isSummary) {
        children.push(task);
      }
    }
    
    children.sort((a, b) => a.id - b.id);
    return children;
  };

  // Calculate phase style
  const calculatePhaseStyle = (task: Task) => {
    if (!project?.startDate || !project?.endDate) {
      return { left: "0%", width: "0%" };
    }

    const childSummaries = getChildTasks(task.id);
    
    let minStart: number | null = null;
    let maxEnd: number | null = null;
    
    if (childSummaries.length > 0) {
      for (const child of childSummaries) {
        const childDescendants = getAllDescendants(child.id, ignoreDelayTasks);
        
        let childMinStart: number | null = null;
        let childMaxEnd: number | null = null;
        
        for (const desc of childDescendants) {
          if (desc.startDate) {
            const startMs = new Date(desc.startDate).getTime();
            childMinStart = childMinStart === null ? startMs : Math.min(childMinStart, startMs);
          }
          if (desc.endDate) {
            const endMs = new Date(desc.endDate).getTime();
            childMaxEnd = childMaxEnd === null ? endMs : Math.max(childMaxEnd, endMs);
          }
        }
        
        if (childMinStart === null && child.startDate) {
          childMinStart = new Date(child.startDate).getTime();
        }
        if (childMaxEnd === null && child.endDate) {
          childMaxEnd = new Date(child.endDate).getTime();
        }
        
        if (childMinStart !== null) {
          minStart = minStart === null ? childMinStart : Math.min(minStart, childMinStart);
        }
        if (childMaxEnd !== null) {
          maxEnd = maxEnd === null ? childMaxEnd : Math.max(maxEnd, childMaxEnd);
        }
      }
    } else {
      const descendants = getAllDescendants(task.id, ignoreDelayTasks);
      for (const desc of descendants) {
        if (desc.startDate) {
          const startMs = new Date(desc.startDate).getTime();
          minStart = minStart === null ? startMs : Math.min(minStart, startMs);
        }
        if (desc.endDate) {
          const endMs = new Date(desc.endDate).getTime();
          maxEnd = maxEnd === null ? endMs : Math.max(maxEnd, endMs);
        }
      }
    }
    
    if (minStart === null && task.startDate) {
      minStart = new Date(task.startDate).getTime();
    }
    if (maxEnd === null && task.endDate) {
      maxEnd = new Date(task.endDate).getTime();
    }
    
    if (minStart === null || maxEnd === null) {
      return { left: "0%", width: "0%" };
    }

    const totalMs = new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
    const taskStartMs = minStart - new Date(project.startDate).getTime();
    const taskDurationMs = maxEnd - minStart;

    const left = (taskStartMs / totalMs) * 100;
    const width = (taskDurationMs / totalMs) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0, Math.min(width, 100 - left))}%`,
    };
  };

  // Get phase start and end dates
  const getPhaseStartEndDates = (task: Task): { startDate: Date | null; endDate: Date | null } => {
    const childSummaries = getChildTasks(task.id);
    
    let minStart: number | null = null;
    let maxEnd: number | null = null;
    
    if (childSummaries.length > 0) {
      for (const child of childSummaries) {
        const childDescendants = getAllDescendants(child.id, ignoreDelayTasks);
        
        let childMinStart: number | null = null;
        let childMaxEnd: number | null = null;
        
        for (const desc of childDescendants) {
          if (desc.startDate) {
            const startMs = new Date(desc.startDate).getTime();
            childMinStart = childMinStart === null ? startMs : Math.min(childMinStart, startMs);
          }
          if (desc.endDate) {
            const endMs = new Date(desc.endDate).getTime();
            childMaxEnd = childMaxEnd === null ? endMs : Math.max(childMaxEnd, endMs);
          }
        }
        
        if (childMinStart === null && child.startDate) {
          childMinStart = new Date(child.startDate).getTime();
        }
        if (childMaxEnd === null && child.endDate) {
          childMaxEnd = new Date(child.endDate).getTime();
        }
        
        if (childMinStart !== null) {
          minStart = minStart === null ? childMinStart : Math.min(minStart, childMinStart);
        }
        if (childMaxEnd !== null) {
          maxEnd = maxEnd === null ? childMaxEnd : Math.max(maxEnd, childMaxEnd);
        }
      }
    } else {
      const descendants = getAllDescendants(task.id, ignoreDelayTasks);
      for (const desc of descendants) {
        if (desc.startDate) {
          const startMs = new Date(desc.startDate).getTime();
          minStart = minStart === null ? startMs : Math.min(minStart, startMs);
        }
        if (desc.endDate) {
          const endMs = new Date(desc.endDate).getTime();
          maxEnd = maxEnd === null ? endMs : Math.max(maxEnd, endMs);
        }
      }
    }
    
    if (minStart === null && task.startDate) {
      minStart = new Date(task.startDate).getTime();
    }
    if (maxEnd === null && task.endDate) {
      maxEnd = new Date(task.endDate).getTime();
    }
    
    return {
      startDate: minStart !== null ? new Date(minStart) : null,
      endDate: maxEnd !== null ? new Date(maxEnd) : null,
    };
  };

  // Determine phase color
  const getPhaseColor = (name: string | null) => {
    if (!name) return "bg-primary";
    const nameLower = name.toLowerCase();
    if (nameLower.includes("procurement")) return "bg-[#006093]";
    if (nameLower.includes("on site") || nameLower.includes("on-site") || nameLower.includes("onsite")) return "bg-[#006093]";
    return "bg-primary";
  };

  // Extract phases
  const phases = tasks
    ? tasks
        .filter(t => {
          if (!t.isSummary || !t.name) return false;
          const nameLower = t.name.toLowerCase();
          return nameLower.includes("procurement") || 
                 nameLower.includes("on site") || 
                 nameLower.includes("on-site") ||
                 nameLower.includes("onsite");
        })
        .sort((a, b) => {
          const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
          return aStart - bStart;
        })
    : [];

  const ganttData = project && tasks && project.startDate ? formatGanttData(tasks, project.startDate) : { tasks: [], startDate: new Date(), endDate: new Date(), totalDays: 0 };
  const monthHeaders = ganttData.tasks.length > 0 ? generateMonthHeaders(ganttData.startDate, ganttData.endDate) : [];

  if (projectLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Project not found</h1>
        <Link href="/projects">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-project-name">{project.name}</h1>
            <p className="text-muted-foreground">{project.description || "No description"}</p>
          </div>
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"} data-testid="badge-project-status">
          {project.status}
        </Badge>
      </div>

      {project?.startDate && project?.endDate && phases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Timeline</CardTitle>
            <CardDescription>Phase-level schedule visualization</CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="ignore-delay-tasks"
                checked={ignoreDelayTasks}
                onChange={(e) => setIgnoreDelayTasks(e.target.checked)}
                className="cursor-pointer"
                data-testid="checkbox-ignore-delay"
              />
              <label htmlFor="ignore-delay-tasks" className="text-xs text-muted-foreground cursor-pointer">
                Hide Delay tasks
              </label>
            </div>
            <div className="space-y-2">
              <div className="text-xs">
                {(() => {
                  const projectStart = new Date(project.startDate as any);
                  const projectEnd = new Date(project.endDate as any);
                  const totalMs = projectEnd.getTime() - projectStart.getTime();
                  
                  const getMonthlyMarkers = () => {
                    const markers = [];
                    let current = new Date(projectStart);
                    current.setDate(1);
                    
                    while (current < projectEnd) {
                      markers.push(new Date(current));
                      current.setMonth(current.getMonth() + 1);
                    }
                    
                    return markers;
                  };

                  const markers = getMonthlyMarkers();

                  return (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-4 flex-shrink-0" />
                            <p className="text-muted-foreground w-32 truncate flex-shrink-0">Overall Project</p>
                            <span className="text-muted-foreground/70 w-16 text-right flex-shrink-0">
                              {formatDateUK(project.startDate)}
                            </span>
                            <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative border border-border">
                              <div
                                className="h-full absolute bg-[#494949]"
                                style={{ left: "0%", width: "100%" }}
                                data-testid="gantt-project-overall"
                              />
                              {markers.map((marker, idx) => {
                                const position = ((marker.getTime() - projectStart.getTime()) / totalMs) * 100;
                                const nextMarker = markers[idx + 1] ? new Date(markers[idx + 1]) : projectEnd;
                                const midPosition = (position + ((nextMarker.getTime() - projectStart.getTime()) / totalMs) * 100) / 2;
                                const monthName = marker.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                                
                                return (
                                  <div key={`month-${idx}`}>
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/10"
                                      style={{ left: `${position}%` }}
                                    />
                                    <span 
                                      className="absolute text-xs text-white font-bold pointer-events-none whitespace-nowrap"
                                      style={{ left: `${midPosition}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                                    >
                                      {monthName}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-muted-foreground/70 w-16 flex-shrink-0">
                              {formatDateUK(project.endDate)}
                            </span>
                          </div>
                        </div>
                        {phases.map((phase) => {
                          const isOnSite = phase.name?.toLowerCase().includes("on site") || phase.name?.toLowerCase().includes("on-site") || phase.name?.toLowerCase().includes("onsite");
                          const childTasks = isOnSite ? getChildTasks(phase.id) : [];
                          const isExpanded = expandedPhase === phase.id;
                          const phaseDates = getPhaseStartEndDates(phase);
                          
                          const durationDays = phaseDates.startDate && phaseDates.endDate 
                            ? calculateWorkingDays(phaseDates.startDate, phaseDates.endDate, calendarExceptions)
                            : 0;

                          const phaseStyle = calculatePhaseStyle(phase);

                          return (
                            <div key={phase.id} className="text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-4 flex-shrink-0 flex items-center gap-1">
                                  {childTasks.length > 0 && (
                                    <button
                                      onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                                      className="p-0 hover:bg-muted rounded transition-colors"
                                      data-testid={`button-toggle-phase-${phase.id}`}
                                    >
                                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                  )}
                                  {childTasks.length === 0 && <div className="w-3" />}
                                </div>
                                <p className="text-muted-foreground w-32 truncate flex-shrink-0">{phase.name}</p>
                                <span className="text-muted-foreground/70 w-16 text-right flex-shrink-0">
                                  {phaseDates.startDate ? formatDateUK(phaseDates.startDate) : "N/A"}
                                </span>
                                <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative border border-border">
                                  <div
                                    className={`h-full absolute ${getPhaseColor(phase.name)} rounded transition-all`}
                                    style={{ left: phaseStyle.left, width: phaseStyle.width }}
                                    data-testid={`gantt-phase-${phase.id}`}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white pointer-events-none whitespace-nowrap truncate px-1">
                                      {durationDays}d
                                    </span>
                                  </div>
                                </div>
                                <span className="text-muted-foreground/70 w-16 flex-shrink-0">
                                  {phaseDates.endDate ? formatDateUK(phaseDates.endDate) : "N/A"}
                                </span>
                              </div>

                              {isExpanded && childTasks.length > 0 && (
                                <div className="mt-1 space-y-1 border-l border-muted-foreground/20">
                                  {childTasks.map((child) => {
                                    const childDates = getPhaseStartEndDates(child);
                                    const childDurationDays = childDates.startDate && childDates.endDate 
                                      ? calculateWorkingDays(childDates.startDate, childDates.endDate, calendarExceptions)
                                      : 0;
                                    
                                    const childStyle = calculatePhaseStyle(child);
                                    
                                    return (
                                      <div key={child.id} className="text-xs">
                                        <div className="flex items-center gap-1">
                                          <div className="w-4 flex-shrink-0" />
                                          <p className="text-muted-foreground w-32 truncate flex-shrink-0">{child.name}</p>
                                          <span className="text-muted-foreground/70 w-16 text-right text-xs flex-shrink-0">
                                            {childDates.startDate ? formatDateUK(childDates.startDate) : "N/A"}
                                          </span>
                                          <div className="flex-1 h-4 bg-muted rounded overflow-hidden relative border border-muted-foreground/30">
                                            <div
                                              className="h-full absolute bg-[#159775] transition-all"
                                              style={{ left: childStyle.left, width: childStyle.width }}
                                              data-testid={`gantt-child-${child.id}`}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <span className="text-xs font-bold text-white pointer-events-none whitespace-nowrap truncate px-1">
                                                {childDurationDays}d
                                              </span>
                                            </div>
                                          </div>
                                          <span className="text-muted-foreground/70 w-16 text-xs flex-shrink-0">
                                            {childDates.endDate ? formatDateUK(childDates.endDate) : "N/A"}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm">Project Information</CardTitle>
            <CardDescription className="text-xs">Basic details and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-2 pb-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Project Manager:</span>
              <span className="text-sm font-medium">{workspace?.projectManager || "Not assigned"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Start Date:</span>
              <span className="text-sm font-medium">
                {formatDateUK(project.startDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">End Date:</span>
              <span className="text-sm font-medium">
                {formatDateUK(project.endDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status Date:</span>
              <span className="text-sm font-medium">
                {project.statusDate ? formatDateUK(project.statusDate) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">% Complete:</span>
              <span className="text-sm font-medium">
                {tasks && tasks.length > 0
                  ? (() => {
                      // Exclude summary tasks and calculate based on duration-weighted completion
                      const nonSummaryTasks = tasks.filter(t => !t.isSummary);
                      if (nonSummaryTasks.length === 0) return "0%";
                      
                      const totalDuration = nonSummaryTasks.reduce((sum, t) => sum + (t.duration || 0), 0);
                      if (totalDuration === 0) return "0%";
                      
                      const completedDuration = nonSummaryTasks.reduce((sum, t) => 
                        sum + ((t.duration || 0) * (parseFloat(t.percentComplete || "0") / 100)), 0
                      );
                      
                      return `${Math.round((completedDuration / totalDuration) * 100)}%`;
                    })()
                  : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4" />
              Tasks Overview
            </CardTitle>
            <CardDescription className="text-xs">Project activities and milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-2 pb-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Tasks:</span>
              <span className="text-sm font-medium">{tasks?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Critical Path Tasks:</span>
              <span className="text-sm font-medium">
                {tasks?.filter(t => t.isCriticalPath).length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Milestones:</span>
              <span className="text-sm font-medium">
                {tasks?.filter(t => t.isMilestone).length || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="flex items-center gap-1 text-sm">
              <FileCheck className="h-4 w-4" />
              DCMA Assessment
            </CardTitle>
            <CardDescription className="text-xs">14-point schedule health check</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-2">
            {dcmaAssessment ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overall Score:</span>
                  <span className="text-2xl font-bold">
                    {dcmaAssessment.overallScore || 0}/14
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={dcmaAssessment.passed ? "default" : "destructive"}>
                    {dcmaAssessment.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assessment Date:</span>
                  <span className="text-sm font-medium">
                    {formatDateUK(dcmaAssessment.assessmentDate)}
                  </span>
                </div>
                <Link href="/dcma">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-view-dcma">
                    View Full Assessment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">No assessment available</p>
                <Link href="/dcma">
                  <Button data-testid="button-run-dcma-assessment">Run Assessment</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {ganttData.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Critical Path Gantt Chart</CardTitle>
            <CardDescription>Schedule visualization of critical path tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 overflow-x-auto">
              {/* Table Header */}
              <div className="flex min-w-max">
                <div style={{ width: '480px' }} className="flex-shrink-0">
                  <div className="flex gap-2 text-xs font-semibold px-2 py-2">
                    <div style={{ width: '240px' }}>Task Name</div>
                    <div style={{ width: '50px' }}>Duration</div>
                    <div style={{ width: '80px' }}>Start</div>
                    <div style={{ width: '80px' }}>Finish</div>
                  </div>
                </div>
                <div className="border-l-4 border-foreground"></div>
                <div style={{ width: `${Math.max(ganttData.totalDays * 1.5, 300)}px` }} className="flex-shrink-0"></div>
              </div>

              {/* Month Header */}
              <div className="flex min-w-max border-b">
                <div style={{ width: '480px' }} className="flex-shrink-0"></div>
                <div className="border-l-4 border-foreground"></div>
                <div className="flex gap-0" style={{ width: `${Math.max(ganttData.totalDays * 1.5, 300)}px` }}>
                  {monthHeaders.map((month, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-medium text-muted-foreground border-l pl-1"
                      style={{
                        width: idx < monthHeaders.length - 1 
                          ? `${(monthHeaders[idx + 1].startDay - month.startDay) * 1.5}px` 
                          : `${(ganttData.totalDays - month.startDay) * 1.5}px`,
                      }}
                    >
                      {month.month}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-0 min-w-max">
                {ganttData.tasks.map((task) => (
                  <div key={task.id} className="flex border-b">
                    <div style={{ width: '480px' }} className="flex-shrink-0">
                      <div className="flex gap-2 text-xs py-2 px-2">
                        <div style={{ width: '240px' }} className="font-medium" title={task.taskName}>
                          {task.taskName}
                        </div>
                        <div style={{ width: '50px' }} className="text-muted-foreground">{task.duration}d</div>
                        <div style={{ width: '80px' }} className="text-muted-foreground text-xs">{task.startDate}</div>
                        <div style={{ width: '80px' }} className="text-muted-foreground text-xs">{task.finishDate}</div>
                      </div>
                    </div>
                    <div className="border-l-4 border-foreground"></div>
                    <div className="h-6 relative rounded flex-shrink-0" style={{ width: `${Math.max(ganttData.totalDays * 1.5, 300)}px` }}>
                      {task.isMilestone ? (
                        <div
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{
                            left: `${task.daysFromStart * 1.5}px`,
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#ef4444',
                            transform: 'translateY(-50%) rotate(45deg)',
                          }}
                          title={`${task.taskName}: Milestone (${task.startDate})`}
                        >
                        </div>
                      ) : (
                        <div
                          className="h-full bg-red-500 rounded absolute top-0"
                          style={{
                            left: `${task.daysFromStart * 1.5}px`,
                            width: `${Math.max(20, task.duration * 1.5)}px`,
                          }}
                          title={`${task.taskName}: ${task.duration} days (${task.startDate} to ${task.finishDate})`}
                        >
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground pt-2 min-w-max">
                <p>Critical path: {ganttData.tasks.length} task{ganttData.tasks.length !== 1 ? "s" : ""} ({ganttData.totalDays} days total)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
