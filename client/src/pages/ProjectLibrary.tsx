import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWorkspaceSchema, insertProjectSchema, type Workspace, type Project, type Task } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Library, ChevronDown, ChevronRight, Trash2, Edit, FolderOpen, Upload, MoreHorizontal, MoveRight, X, GitCompare } from "lucide-react";
import { DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const projectFormSchema = insertWorkspaceSchema.extend({
  name: z.string().min(1, "Name is required"),
  projectManager: z.string().optional(),
  client: z.string().optional(),
});

const programmeFormSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required"),
  statusDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? (val ? new Date(val) : undefined) : val
  ).optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;
type ProgrammeFormData = z.infer<typeof programmeFormSchema>;

const colorOptions = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#64748B", label: "Slate" },
];

const PROJECT_STATUSES = [
  "Tender",
  "Pre-Construction",
  "On Site",
  "Off Site",
  "Commissioning",
  "Complete",
];

function ProgrammeTile({ programme, onDelete, showGantt = true }: { programme: Project; onDelete: () => void; showGantt?: boolean }) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [ignoreDelayTasks, setIgnoreDelayTasks] = useState(false);

  const { data: completion } = useQuery<{ percentComplete?: number }>({
    queryKey: [`/api/projects/${programme.id}/completion`],
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: [`/api/projects/${programme.id}/tasks`],
    enabled: showGantt,
  });

  // Extract Procurement and On Site Works summary phases
  const phases = showGantt && tasks
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

  // Check if a summary task has any non-delay descendants
  const hasNonDelayDescendants = (taskId: number): boolean => {
    if (!tasks) return false;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.wbsCode) return false;
    
    const taskWbs = task.wbsCode;
    for (const t of tasks) {
      if (!t.wbsCode || t.id === taskId) continue;
      if (t.wbsCode.startsWith(taskWbs + '.')) {
        // Found a descendant that is not a delay task
        if (!t.name || !t.name.startsWith("Delay -")) {
          return true;
        }
      }
    }
    return false;
  };

  // Get all descendants of a task (for calculating true span)
  const getAllDescendants = (parentId: number, filterDelays: boolean = false): Task[] => {
    if (!tasks) return [];
    const parent = tasks.find(t => t.id === parentId);
    if (!parent || !parent.wbsCode) return [];
    
    const parentWbs = parent.wbsCode;
    const descendants: Task[] = [];
    
    for (const task of tasks) {
      if (!task.wbsCode || task.id === parentId) continue;
      
      // Filter out delay tasks if requested
      if (filterDelays && task.name && task.name.startsWith("Delay -")) {
        continue;
      }
      
      // Include all tasks that have this parent WBS in their code (any nesting level)
      if (task.wbsCode.startsWith(parentWbs + '.')) {
        // If filtering delays and this is a summary, check if it has any non-delay descendants
        if (filterDelays && task.isSummary && !hasNonDelayDescendants(task.id)) {
          continue; // Skip this summary if it only has delay tasks
        }
        descendants.push(task);
      }
    }
    return descendants;
  };

  // Calculate timeline position and width using direct child summary tasks' dates
  const calculatePhaseStyle = (task: Task) => {
    if (!programme.startDate || !programme.endDate) {
      return { left: "0%", width: "0%" };
    }

    // Get direct child summary tasks only
    const childSummaries = getChildTasks(task.id);
    
    // Find earliest start and latest end from child summary tasks
    let minStart: number | null = null;
    let maxEnd: number | null = null;
    
    for (const child of childSummaries) {
      if (child.startDate) {
        const startMs = new Date(child.startDate).getTime();
        minStart = minStart === null ? startMs : Math.min(minStart, startMs);
      }
      if (child.endDate) {
        const endMs = new Date(child.endDate).getTime();
        maxEnd = maxEnd === null ? endMs : Math.max(maxEnd, endMs);
      }
    }
    
    // If no child summaries found, use parent task's dates as fallback
    if (minStart === null && task.startDate) {
      minStart = new Date(task.startDate).getTime();
    }
    if (maxEnd === null && task.endDate) {
      maxEnd = new Date(task.endDate).getTime();
    }
    
    if (minStart === null || maxEnd === null) {
      return { left: "0%", width: "0%" };
    }

    const totalMs = new Date(programme.endDate).getTime() - new Date(programme.startDate).getTime();
    const taskStartMs = minStart - new Date(programme.startDate).getTime();
    const taskDurationMs = maxEnd - minStart;

    const left = (taskStartMs / totalMs) * 100;
    const width = (taskDurationMs / totalMs) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0, Math.min(width, 100 - left))}%`,
    };
  };

  // Calculate timeline position and width for child tasks relative to parent phase
  const calculateChildTaskStyle = (task: Task, parentPhase: Task) => {
    if (!parentPhase.startDate || !parentPhase.endDate || !task.startDate || !task.endDate) {
      return { left: "0%", width: "0%" };
    }

    const totalMs = new Date(parentPhase.endDate).getTime() - new Date(parentPhase.startDate).getTime();
    const taskStartMs = new Date(task.startDate).getTime() - new Date(parentPhase.startDate).getTime();
    const taskDurationMs = new Date(task.endDate).getTime() - new Date(task.startDate).getTime();

    const left = (taskStartMs / totalMs) * 100;
    const width = (taskDurationMs / totalMs) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0, Math.min(width, 100 - left))}%`,
    };
  };

  // Determine phase color
  const getPhaseColor = (name: string | null) => {
    if (!name) return "bg-primary";
    const nameLower = name.toLowerCase();
    if (nameLower.includes("procurement")) return "bg-[#159775]";
    if (nameLower.includes("on site") || nameLower.includes("on-site") || nameLower.includes("onsite")) return "bg-[#006093]";
    return "bg-primary";
  };

  // Get child tasks for a summary task - includes all nested descendants that should be displayed
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
      
      // Filter out delay tasks if checkbox is checked
      if (ignoreDelayTasks && task.name && task.name.startsWith("Delay -")) {
        continue;
      }
      
      // Check if task is a direct child (exactly one level deeper)
      const taskWbsParts = task.wbsCode.split('.');
      const taskLevel = taskWbsParts.length;
      
      // Task must be exactly one level deeper and start with parent WBS - summary tasks only
      if (taskLevel === expectedChildLevel && task.wbsCode.startsWith(parentWbs + '.') && task.isSummary) {
        children.push(task);
      }
    }
    
    // Sort by task order in the original list
    children.sort((a, b) => {
      const aIdx = tasks.findIndex(t => t.id === a.id);
      const bIdx = tasks.findIndex(t => t.id === b.id);
      return aIdx - bIdx;
    });
    
    return children;
  };

  return (
    <Card className="hover-elevate" data-testid={`card-programme-${programme.id}`}>
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderKanban className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm">{programme.name}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs">
              <p className="text-muted-foreground">Start</p>
              <p className="font-medium text-foreground">
                {programme.startDate ? formatDateUK(programme.startDate) : "N/A"}
              </p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">End</p>
              <p className="font-medium text-foreground">
                {programme.endDate ? formatDateUK(programme.endDate) : "N/A"}
              </p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">
                {programme.statusDate ? formatDateUK(programme.statusDate) : "N/A"}
              </p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">Complete</p>
              <p className="font-medium text-foreground">
                {completion?.percentComplete ?? "-"}%
              </p>
            </div>
            <Link href={`/projects/${programme.id}`}>
              <Button variant="outline" size="sm" data-testid={`button-view-programme-${programme.id}`}>
                View Details
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              data-testid={`button-delete-programme-${programme.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {programme.startDate && programme.endDate && (
        <CardContent className="px-4 py-2">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id={`ignore-delay-${programme.id}`}
              checked={ignoreDelayTasks}
              onChange={(e) => setIgnoreDelayTasks(e.target.checked)}
              className="cursor-pointer"
              data-testid={`checkbox-ignore-delay-${programme.id}`}
            />
            <label htmlFor={`ignore-delay-${programme.id}`} className="text-xs text-muted-foreground cursor-pointer">
              Hide Delay tasks
            </label>
          </div>
          {phases.length > 0 && (() => {
            // Generate monthly increments
            const getMonthlyMarkers = () => {
              const start = new Date(programme.startDate as any);
              const end = new Date(programme.endDate as any);
              const markers = [];
              
              let current = new Date(start);
              current.setDate(1);
              
              while (current < end) {
                markers.push(new Date(current));
                current.setMonth(current.getMonth() + 1);
              }
              
              return markers;
            };

            const markers = getMonthlyMarkers();
            const totalMs = new Date(programme.endDate as any).getTime() - new Date(programme.startDate as any).getTime();

            return (
              <div className="space-y-2">
              <div className="text-xs">
                <p className="text-muted-foreground truncate mb-1">Project Timeline</p>
                
                {/* Monthly markers */}
                <div className="relative w-full mb-1 h-4 flex items-end">
                  {markers.map((marker, idx) => {
                    const markerMs = marker.getTime() - new Date(programme.startDate as any).getTime();
                    const position = (markerMs / totalMs) * 100;
                    const monthYear = marker.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                    
                    return (
                      <div
                        key={idx}
                        className="absolute flex flex-col items-center"
                        style={{ left: `${Math.max(0, Math.min(position, 100))}%` }}
                      >
                        <div className="w-0.5 h-2 bg-muted-foreground/30" />
                        <div className="text-muted-foreground text-xs mt-0.5 whitespace-nowrap -translate-x-1/2">
                          {monthYear}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full h-5 bg-muted rounded overflow-hidden relative border border-border mt-6">
                  <div
                    className="h-full bg-muted-foreground/20 transition-all"
                    style={{
                      left: "0%",
                      width: "100%",
                    }}
                    data-testid={`gantt-timeline-${programme.id}`}
                  />
                </div>
                <div className="flex justify-between mt-0.5 text-xs text-muted-foreground">
                  <span>{formatDateUK(programme.startDate)}</span>
                  <span>{formatDateUK(programme.endDate)}</span>
                </div>
              </div>

              {phases.map((phase) => {
                const isOnSite = phase.name?.toLowerCase().includes("on site") || phase.name?.toLowerCase().includes("on-site") || phase.name?.toLowerCase().includes("onsite");
                const childTasks = isOnSite ? getChildTasks(phase.id) : [];
                const isExpanded = expandedPhase === phase.id;

                return (
                  <div key={phase.id} className="text-xs">
                    <div className="flex items-center gap-1">
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
                      <p className="text-muted-foreground truncate flex-1">{phase.name}</p>
                    </div>
                    <div className="w-full h-5 bg-muted rounded overflow-hidden relative border border-border mt-0.5 ml-4">
                      <div
                        className={`h-full absolute ${getPhaseColor(phase.name)} rounded transition-all`}
                        style={calculatePhaseStyle(phase)}
                        data-testid={`gantt-phase-${phase.id}`}
                      />
                    </div>

                    {isExpanded && childTasks.length > 0 && (
                      <div className="mt-1 ml-4 space-y-1 pl-3 border-l border-muted-foreground/20">
                        {childTasks.map((child) => (
                          <div key={child.id} className="text-xs">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-muted-foreground truncate flex-1">{child.name}</p>
                              <span className="text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                                {child.startDate && child.endDate ? (
                                  <>{formatDateUK(child.startDate)} - {formatDateUK(child.endDate)}</>
                                ) : (
                                  "No dates"
                                )}
                              </span>
                            </div>
                            <div className="w-full h-4 bg-muted rounded overflow-hidden relative border border-muted-foreground/30">
                              <div
                                className="h-full absolute bg-muted-foreground/30 transition-all"
                                style={calculatePhaseStyle(child)}
                                data-testid={`gantt-child-${child.id}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })()}
        </CardContent>
      )}
    </Card>
  );
}

function ProjectSection({ 
  project, 
  programmes, 
  onDelete,
  onEdit,
}: { 
  project: Workspace; 
  programmes: Project[];
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", project.id, "projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Programme deleted",
        description: "Programme has been removed.",
      });
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/workspaces/${project.id}`, { status: newStatus });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setIsStatusOpen(false);
      toast({
        title: "Status updated",
        description: "Project status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="mb-3" data-testid={`card-project-${project.id}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent">
                <div className="flex items-center gap-2 flex-1">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: project.color || "#3B82F6" }}
                  />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <div className="flex-shrink-0">
                      <CardTitle className="text-sm">{project.name}</CardTitle>
                    </div>
                    <div className="flex-1 flex justify-center">
                      {project.client && (
                        <span className="text-xs text-muted-foreground">Client: {project.client}</span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {project.projectManager && (
                        <p className="text-xs text-muted-foreground">PM: {project.projectManager}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-1 flex-shrink-0 text-xs">
                    {programmes.length}
                  </Badge>
                </div>
              </Button>
            </CollapsibleTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-project-menu-${project.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-project-${project.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete} 
                  className="text-destructive"
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {project.description && (
            <CardDescription className="ml-6 text-xs">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-2 pb-2 space-y-2">
            <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start px-0 py-1 h-auto text-xs" data-testid={`button-toggle-project-status-${project.id}`}>
                  <ChevronDown className={`h-3 w-3 mr-2 transition-transform ${isStatusOpen ? "" : "-rotate-90"}`} />
                  Project Status: <span className="ml-1 font-medium">{project.status || "Not set"}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2 mb-2">
                  <p className="text-xs text-muted-foreground">Select project stage</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROJECT_STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={project.status === status ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => updateProjectStatusMutation.mutate(status)}
                        disabled={updateProjectStatusMutation.isPending}
                        data-testid={`button-project-status-${status.toLowerCase().replace(/\s+/g, '-')}-${project.id}`}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {programmes.length > 0 ? (
              <div className="space-y-1">
                {(() => {
                  const mostRecentProgramme = programmes.reduce((latest, current) => {
                    const latestDate = latest.statusDate ? new Date(latest.statusDate).getTime() : 0;
                    const currentDate = current.statusDate ? new Date(current.statusDate).getTime() : 0;
                    return currentDate > latestDate ? current : latest;
                  }, programmes[0]);

                  return programmes.map((programme) => (
                    <ProgrammeTile
                      key={programme.id}
                      programme={programme}
                      onDelete={() => deleteMutation.mutate(programme.id)}
                      showGantt={programme.id === mostRecentProgramme?.id}
                    />
                  ));
                })()}
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                <FolderOpen className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs">No programmes in this project yet</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ProjectLibrary() {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [programmeDialogOpen, setProgrammeDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Workspace | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading: projectsLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: allProgrammes } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3B82F6",
      client: "",
    },
  });

  const programmeForm = useForm<ProgrammeFormData>({
    resolver: zodResolver(programmeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      projectManager: "",
      status: "active",
      workspaceId: undefined,
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const res = await apiRequest("POST", "/api/workspaces", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setProjectDialogOpen(false);
      projectForm.reset();
      toast({
        title: "Project created",
        description: "Your project has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProjectFormData> }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setEditingProject(null);
      projectForm.reset();
      toast({
        title: "Project updated",
        description: "Your project has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/workspaces/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "Project has been removed. Programmes are now unassigned.",
      });
    },
  });

  const createProgrammeMutation = useMutation({
    mutationFn: async (data: ProgrammeFormData) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setProgrammeDialogOpen(false);
      programmeForm.reset();
      toast({
        title: "Programme created",
        description: "Your programme has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProgrammeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({
        title: "Programme deleted",
        description: "Programme has been removed.",
      });
    },
  });

  const moveProgrammeMutation = useMutation({
    mutationFn: async ({ programmeId, projectId }: { programmeId: number; projectId: number }) => {
      const res = await apiRequest("PATCH", `/api/projects/${programmeId}`, { workspaceId: projectId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      toast({
        title: "Programme moved",
        description: "Programme has been assigned to the project.",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/projects/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to upload file" }));
        throw new Error(errorData.error || errorData.message || "Failed to upload file");
      }
      
      return await res.json();
    },
    onSuccess: async (data) => {
      if (data.success && data.project && uploadProjectId) {
        await apiRequest("PATCH", `/api/projects/${data.project.id}`, {
          workspaceId: uploadProjectId,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      
      if (data.requiresConversion) {
        toast({
          title: "Conversion Required",
          description: data.message,
          variant: "default",
          duration: 10000,
        });
      } else if (data.success && data.project) {
        toast({
          title: "Programme imported",
          description: data.message || `Successfully imported "${data.project.name}"`,
        });
      } else if (data.success) {
        toast({
          title: "File uploaded",
          description: `Successfully uploaded ${data.fileName}`,
        });
      }
      
      setUploadOpen(false);
      setUploadFile(null);
      setUploadProjectId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleUpdateProject = (data: ProjectFormData) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    }
  };

  const handleEditProject = (project: Workspace) => {
    setEditingProject(project);
    projectForm.reset({
      name: project.name,
      description: project.description || "",
      color: project.color || "#3B82F6",
      projectManager: project.projectManager || "",
      client: project.client || "",
    });
  };

  const handleCreateProgramme = (data: ProgrammeFormData) => {
    createProgrammeMutation.mutate(data);
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const getProgrammesForProject = (projectId: number) => {
    return allProgrammes?.filter(p => p.workspaceId === projectId) || [];
  };

  const unassignedProgrammes = allProgrammes?.filter(p => !p.workspaceId) || [];

  const filteredProjects = projects?.filter(project => {
    const searchLower = searchText.toLowerCase();
    const matchesProject = project.name.toLowerCase().includes(searchLower) ||
      project.projectManager?.toLowerCase().includes(searchLower) ||
      project.description?.toLowerCase().includes(searchLower);
    
    if (matchesProject) return true;
    
    // Also include project if any of its programmes match
    const projectProgrammes = getProgrammesForProject(project.id);
    return projectProgrammes.some(p => p.name.toLowerCase().includes(searchLower));
  }) || [];

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-library-title">Project Library</h1>
          <p className="text-muted-foreground">Organize your programmes into projects</p>
        </div>
        <Input
          placeholder="Search projects..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-library"
        />
      </div>

      {(searchText) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchText("")}
          data-testid="button-clear-search"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Search
        </Button>
      )}

      <div className="flex gap-2 flex-wrap">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-upload-programme">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Programme File</DialogTitle>
                <DialogDescription>Upload a Microsoft Project file (.mpp, .xml) or Excel export (.xlsx, .csv)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input 
                  type="file" 
                  accept=".xml,.mpp,.xlsx,.csv" 
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  data-testid="input-file-upload" 
                />
                {uploadFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {uploadFile.name}
                  </p>
                )}
                <div>
                  <label className="text-sm font-medium">Assign to Project (optional)</label>
                  <Select 
                    value={uploadProjectId?.toString() || "none"} 
                    onValueChange={(val) => setUploadProjectId(val === "none" ? null : parseInt(val))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-upload-project">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects?.map((proj) => (
                        <SelectItem key={proj.id} value={proj.id.toString()}>
                          {proj.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setUploadOpen(false);
                  setUploadFile(null);
                  setUploadProjectId(null);
                }} data-testid="button-cancel-upload">
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!uploadFile || uploadMutation.isPending}
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={projectDialogOpen || !!editingProject} onOpenChange={(open) => {
            if (!open) {
              setProjectDialogOpen(false);
              setEditingProject(null);
              projectForm.reset();
            } else {
              setProjectDialogOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-project">
                <Library className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
                <DialogDescription>
                  {editingProject ? "Update your project details" : "Create a project to organize your programmes"}
                </DialogDescription>
              </DialogHeader>
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(editingProject ? handleUpdateProject : handleCreateProject)} className="space-y-4">
                  <FormField
                    control={projectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="projectManager"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Manager</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter project manager name" {...field} value={field.value || ""} data-testid="input-project-manager" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter client name" {...field} value={field.value || ""} data-testid="input-project-client" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colour</FormLabel>
                        <div className="flex gap-2 flex-wrap">
                          {colorOptions.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                field.value === color.value ? "border-foreground scale-110" : "border-transparent"
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.label}
                              data-testid={`button-color-${color.label.toLowerCase()}`}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      setProjectDialogOpen(false);
                      setEditingProject(null);
                      projectForm.reset();
                    }} data-testid="button-cancel-project">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createProjectMutation.isPending || updateProjectMutation.isPending} 
                      data-testid="button-submit-project"
                    >
                      {createProjectMutation.isPending || updateProjectMutation.isPending 
                        ? (editingProject ? "Updating..." : "Creating...") 
                        : (editingProject ? "Update" : "Create")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
      </Dialog>
      </div>

      {projectsLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded w-48" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-32 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {filteredProjects && filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <ProjectSection
                key={project.id}
                project={project}
                programmes={getProgrammesForProject(project.id)}
                onDelete={() => deleteProjectMutation.mutate(project.id)}
                onEdit={() => handleEditProject(project)}
              />
            ))
          ) : null}

          {filteredProjects.length === 0 && projects && projects.length > 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Library className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No projects match your search</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Try adjusting your search terms to find what you're looking for.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearchText("")}
                  data-testid="button-clear-search-empty"
                >
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          )}

          {(!projects || projects.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Library className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your library is empty</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Create a project to start organizing your programmes, or add programmes directly to get started.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setProgrammeDialogOpen(true)} data-testid="button-create-first-programme">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Programme
                  </Button>
                  <Button onClick={() => setProjectDialogOpen(true)} data-testid="button-create-first-project">
                    <Library className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
