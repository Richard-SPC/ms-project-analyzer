import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, AlertTriangle, Calendar } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import type { Project, Task, DcmaAssessment, NecCompliance } from "@shared/schema";

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
    const duration = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Milestones should have 0 duration, regular tasks minimum 1
    const finalDuration = task.isMilestone ? 0 : Math.max(1, duration);
    
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

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const { data: dcmaAssessment } = useQuery<DcmaAssessment>({
    queryKey: ["/api/projects", projectId, "dcma-assessments", "latest"],
    enabled: !!projectId,
  });

  const { data: necCompliance } = useQuery<NecCompliance>({
    queryKey: ["/api/projects", projectId, "nec-compliance", "latest"],
    enabled: !!projectId,
  });

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic details and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Project Manager:</span>
              <span className="text-sm font-medium">{project.projectManager || "Not assigned"}</span>
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
              <span className="text-sm text-muted-foreground">NEC Compliant:</span>
              <span className="text-sm font-medium">
                {project.necCompliant === true ? "Yes" : project.necCompliant === false ? "No" : "Not assessed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tasks Overview
            </CardTitle>
            <CardDescription>Project activities and milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg. Completion:</span>
              <span className="text-sm font-medium">
                {tasks && tasks.length > 0
                  ? `${Math.round(tasks.reduce((sum, t) => sum + parseFloat(t.percentComplete || "0"), 0) / tasks.length)}%`
                  : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              DCMA Assessment
            </CardTitle>
            <CardDescription>14-point schedule health check</CardDescription>
          </CardHeader>
          <CardContent>
            {dcmaAssessment ? (
              <div className="space-y-3">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              NEC Compliance
            </CardTitle>
            <CardDescription>Contract compliance check</CardDescription>
          </CardHeader>
          <CardContent>
            {necCompliance ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={necCompliance.overallCompliant ? "default" : "destructive"}>
                    {necCompliance.overallCompliant ? "Compliant" : "Non-compliant"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assessment Date:</span>
                  <span className="text-sm font-medium">
                    {formatDateUK(necCompliance.assessmentDate)}
                  </span>
                </div>
                {necCompliance.notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes:</span>
                    <p className="text-sm mt-1">{necCompliance.notes}</p>
                  </div>
                )}
                <Link href="/nec">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-view-nec">
                    View Full Compliance
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">No compliance check available</p>
                <Link href="/nec">
                  <Button data-testid="button-run-nec-check">Run Compliance Check</Button>
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
