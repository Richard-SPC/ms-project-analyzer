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
import { insertWorkspaceSchema, insertProjectSchema, type Workspace, type Project, type Task, type CalendarException } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Library, ChevronDown, ChevronRight, Trash2, Edit, FolderOpen, Upload, MoreHorizontal, MoveRight, X, GitCompare, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  "Lost/Withdrawn",
  "Pre-Construction",
  "On Site",
  "Off Site",
  "Commissioning",
  "Complete",
];

const getStatusButtonClass = (status?: string | null): string => {
  switch (status) {
    case "Tender":
      return "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700";
    case "Lost/Withdrawn":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600";
    case "Pre-Construction":
      return "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700";
    case "On Site":
      return "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100 border-green-300 dark:border-green-700";
    case "Off Site":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700";
    case "Commissioning":
      return "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700";
    case "Complete":
      return "bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-100 border-red-800 dark:border-red-900";
    default:
      return "bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700";
  }
};

function ProgrammeTile({ programme, projects, onAssign }: { programme: Project; projects?: Workspace[]; onAssign?: (projectId: number) => void }) {
  const { data: completion } = useQuery<{ percentComplete?: number }>({
    queryKey: [`/api/projects/${programme.id}/completion`],
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/projects/${programme.id}/tasks`],
  });

  // Calculate actual project start/end from tasks
  const getActualProjectDates = () => {
    let actualStart = programme.startDate ? new Date(programme.startDate) : undefined;
    let actualEnd = programme.endDate ? new Date(programme.endDate) : undefined;

    if (tasks && tasks.length > 0) {
      const taskStarts = tasks
        .filter(t => t.startDate && !t.isSummary)
        .map(t => new Date(t.startDate as any).getTime());
      const taskEnds = tasks
        .filter(t => t.endDate && !t.isSummary)
        .map(t => new Date(t.endDate as any).getTime());

      if (taskStarts.length > 0) {
        actualStart = new Date(Math.min(...taskStarts));
      }
      if (taskEnds.length > 0) {
        actualEnd = new Date(Math.max(...taskEnds));
      }
    }

    return { actualStart, actualEnd };
  };

  const { actualStart, actualEnd } = getActualProjectDates();

  return (
    <Card className="hover-elevate" data-testid={`card-programme-${programme.id}`}>
      <CardHeader className="py-1 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium truncate text-foreground">{programme.name}</div>
          <div className="flex-1 flex justify-center gap-4 items-center">
            <div className="text-xs text-center">
              <p className="text-muted-foreground font-bold">Status Date</p>
              <p className="font-medium text-foreground">
                {programme.statusDate ? formatDateUK(programme.statusDate) : "N/A"}
              </p>
            </div>
            <div className="text-xs text-center">
              <p className="text-muted-foreground font-bold">% Complete</p>
              <p className="font-medium text-foreground">
                {completion?.percentComplete ?? "-"}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <div className="text-xs text-center">
              <p className="text-muted-foreground font-bold">Project Start</p>
              <p className="font-medium text-foreground">
                {actualStart ? formatDateUK(actualStart) : "N/A"}
              </p>
            </div>
            <div className="text-xs text-center">
              <p className="text-muted-foreground font-bold">Project End</p>
              <p className="font-medium text-foreground">
                {actualEnd ? formatDateUK(actualEnd) : "N/A"}
              </p>
            </div>
            {projects && onAssign && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid={`button-assign-programme-${programme.id}`}>
                    <MoveRight className="h-3 w-3 mr-1.5" />
                    Assign to Project
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {projects.length === 0 ? (
                    <DropdownMenuItem disabled>No projects available</DropdownMenuItem>
                  ) : (
                    projects.map(p => (
                      <DropdownMenuItem key={p.id} onClick={() => onAssign(p.id)}>
                        <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color || "#3B82F6" }} />
                        {p.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link href={`/programmes/${programme.id}`}>
              <Button variant="outline" size="sm" data-testid={`button-view-programme-${programme.id}`}>
                View Details
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
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
  const [isOpen, setIsOpen] = useState(false);
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
        <CardHeader className="py-3 px-4">
          <div className="grid grid-cols-12 items-start gap-4">
            <div className="col-span-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent h-auto justify-start">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: project.color || "#3B82F6" }}
                    />
                    <CardTitle className="text-lg font-bold leading-tight">{project.name}</CardTitle>
                  </div>
                </Button>
              </CollapsibleTrigger>
            </div>
            <div className="col-span-4 flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`text-xs w-28 flex-shrink-0 ${getStatusButtonClass(project.status)}`} data-testid={`button-status-dropdown-${project.id}`}>
                    {project.status || "Not set"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {PROJECT_STATUSES.map((status) => (
                    <DropdownMenuItem 
                      key={status}
                      onClick={() => updateProjectStatusMutation.mutate(status)}
                      className={project.status === status ? "bg-primary text-primary-foreground" : ""}
                    >
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {project.projectManager ? `PM: ${project.projectManager}` : ""}
              </p>
            </div>
            <div className="col-span-5 flex items-center justify-end gap-3">
              {project.client && (
                <span className="text-sm font-bold text-foreground leading-tight">{project.client}</span>
              )}
              <Badge variant="secondary" className="flex-shrink-0 text-xs h-fit">
                {programmes.length}
              </Badge>
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
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-2 pb-2 space-y-2">
            {programmes.length > 0 ? (
              <div className="space-y-0">
                {(() => {
                  const sortedProgrammes = [...programmes].sort((a, b) => {
                    const dateA = a.statusDate ? new Date(a.statusDate).getTime() : 0;
                    const dateB = b.statusDate ? new Date(b.statusDate).getTime() : 0;
                    return dateB - dateA; // Most recent first (descending)
                  });

                  return sortedProgrammes.map((programme) => (
                    <ProgrammeTile
                      key={programme.id}
                      programme={programme}
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

type SortColumn = "name" | "status" | "pm" | "client" | "programmes";
type SortDir = "asc" | "desc";

export default function ProjectLibrary() {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [programmeDialogOpen, setProgrammeDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Workspace | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProjectId, setUploadProjectId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { toast } = useToast();

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

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
      
      if (uploadFiles.length === 0) {
        setUploadOpen(false);
        setUploadProjectId(null);
      }
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

  const handleUpload = async () => {
    for (const file of uploadFiles) {
      await new Promise((resolve) => {
        uploadMutation.mutate(file, {
          onSuccess: () => resolve(null),
          onError: () => resolve(null),
        });
      });
    }
  };

  const getProgrammesForProject = (projectId: number) => {
    return allProgrammes?.filter(p => p.workspaceId === projectId) || [];
  };

  const unassignedProgrammes = allProgrammes?.filter(p => !p.workspaceId) || [];

  const filteredProjects = projects?.filter(project => {
    const searchLower = searchText.toLowerCase();
    const matchesSearch = project.name.toLowerCase().includes(searchLower) ||
      project.projectManager?.toLowerCase().includes(searchLower) ||
      project.client?.toLowerCase().includes(searchLower) ||
      getProgrammesForProject(project.id).some(p => p.name.toLowerCase().includes(searchLower));
    if (!matchesSearch) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(project.status || "")) return false;
    return true;
  })?.sort((a, b) => {
    let valA = "";
    let valB = "";
    if (sortColumn === "name") {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortColumn === "status") {
      const iA = PROJECT_STATUSES.indexOf(a.status || "");
      const iB = PROJECT_STATUSES.indexOf(b.status || "");
      const idxA = iA === -1 ? 999 : iA;
      const idxB = iB === -1 ? 999 : iB;
      return sortDir === "asc" ? idxA - idxB : idxB - idxA;
    } else if (sortColumn === "pm") {
      valA = (a.projectManager || "").toLowerCase();
      valB = (b.projectManager || "").toLowerCase();
    } else if (sortColumn === "client") {
      valA = (a.client || "").toLowerCase();
      valB = (b.client || "").toLowerCase();
    } else if (sortColumn === "programmes") {
      const cA = getProgrammesForProject(a.id).length;
      const cB = getProgrammesForProject(b.id).length;
      return sortDir === "asc" ? cA - cB : cB - cA;
    }
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  }) || [];

  const statusesInUse = PROJECT_STATUSES.filter(s =>
    projects?.some(p => p.status === s)
  );

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-library-title">Project Library</h1>
        </div>
        <Input
          placeholder="Search projects..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-library"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={statusFilter.length === 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter([])}
          data-testid="button-filter-all"
        >
          All
        </Button>
        {statusesInUse.map(status => {
          const active = statusFilter.includes(status);
          return (
            <Button
              key={status}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setStatusFilter(prev =>
                  prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                )
              }
              className={!active ? getStatusButtonClass(status) : ""}
              data-testid={`button-filter-${status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              {status}
            </Button>
          );
        })}
        {(searchText || statusFilter.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchText(""); setStatusFilter([]); }}
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Column sort header */}
      <div className="grid grid-cols-12 items-center gap-4 px-4 py-1">
        <div className="col-span-3">
          <button
            className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => handleSort("name")}
            data-testid="button-sort-name"
          >
            Project Name <SortIcon col="name" />
          </button>
        </div>
        <div className="col-span-2">
          <button
            className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => handleSort("status")}
            data-testid="button-sort-status"
          >
            Status <SortIcon col="status" />
          </button>
        </div>
        <div className="col-span-2">
          <button
            className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => handleSort("pm")}
            data-testid="button-sort-pm"
          >
            Project Manager <SortIcon col="pm" />
          </button>
        </div>
        <div className="col-span-3">
          <button
            className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => handleSort("client")}
            data-testid="button-sort-client"
          >
            Client <SortIcon col="client" />
          </button>
        </div>
        <div className="col-span-2 flex justify-end">
          <button
            className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            onClick={() => handleSort("programmes")}
            data-testid="button-sort-programmes"
          >
            Programmes <SortIcon col="programmes" />
          </button>
        </div>
      </div>

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
                  multiple
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  data-testid="input-file-upload" 
                />
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected files ({uploadFiles.length}):</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {uploadFiles.map((file, idx) => (
                        <li key={idx}>• {file.name}</li>
                      ))}
                    </ul>
                  </div>
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
                  setUploadFiles([]);
                  setUploadProjectId(null);
                }} data-testid="button-cancel-upload">
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={uploadFiles.length === 0 || uploadMutation.isPending}
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

          {unassignedProgrammes && unassignedProgrammes.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">No Project</h2>
              <div className="space-y-2">
                {unassignedProgrammes.map((programme) => (
                  <ProgrammeTile
                    key={programme.id}
                    programme={programme}
                    projects={projects || []}
                    onAssign={(projectId) =>
                      moveProgrammeMutation.mutate({ programmeId: programme.id, projectId })
                    }
                  />
                ))}
              </div>
            </div>
          )}

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
