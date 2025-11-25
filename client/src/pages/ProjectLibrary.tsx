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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWorkspaceSchema, insertProjectSchema, type Workspace, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Library, ChevronDown, ChevronRight, Trash2, Edit, FolderOpen, Upload, MoreHorizontal } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const workspaceFormSchema = insertWorkspaceSchema.extend({
  name: z.string().min(1, "Name is required"),
});

const projectFormSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required"),
});

type WorkspaceFormData = z.infer<typeof workspaceFormSchema>;
type ProjectFormData = z.infer<typeof projectFormSchema>;

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

function WorkspaceSection({ 
  workspace, 
  projects, 
  onDelete,
  onEdit,
}: { 
  workspace: Workspace; 
  projects: Project[];
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspace.id, "projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "Project has been removed.",
      });
    },
  });

  return (
    <Card className="mb-4" data-testid={`card-workspace-${workspace.id}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: workspace.color || "#3B82F6" }}
                  />
                  <CardTitle className="text-lg">{workspace.name}</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {projects.length} project{projects.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </Button>
            </CollapsibleTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-workspace-menu-${workspace.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-workspace-${workspace.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Workspace
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete} 
                  className="text-destructive"
                  data-testid={`button-delete-workspace-${workspace.id}`}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {workspace.description && (
            <CardDescription className="ml-9">{workspace.description}</CardDescription>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {projects.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <Card key={project.id} className="hover-elevate" data-testid={`card-project-${project.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FolderKanban className="h-4 w-4 text-primary flex-shrink-0" />
                          <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            deleteMutation.mutate(project.id);
                          }}
                          data-testid={`button-delete-project-${project.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1 text-xs text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="font-medium text-foreground">{project.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Manager:</span>
                          <span className="font-medium text-foreground">{project.projectManager || "N/A"}</span>
                        </div>
                      </div>
                      <Link href={`/projects/${project.id}`}>
                        <Button className="w-full" variant="outline" size="sm" data-testid={`button-view-project-${project.id}`}>
                          View Details
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projects in this workspace yet</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ProjectLibrary() {
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: workspaces, isLoading: workspacesLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const workspaceForm = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3B82F6",
    },
  });

  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      projectManager: "",
      status: "active",
      workspaceId: undefined,
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: WorkspaceFormData) => {
      const res = await apiRequest("POST", "/api/workspaces", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setWorkspaceDialogOpen(false);
      workspaceForm.reset();
      toast({
        title: "Workspace created",
        description: "Your workspace has been created successfully.",
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

  const updateWorkspaceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WorkspaceFormData> }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setEditingWorkspace(null);
      workspaceForm.reset();
      toast({
        title: "Workspace updated",
        description: "Your workspace has been updated successfully.",
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

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/workspaces/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Workspace deleted",
        description: "Workspace has been removed. Projects are now unassigned.",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
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
      if (data.success && data.project && uploadWorkspaceId) {
        await apiRequest("PATCH", `/api/projects/${data.project.id}`, {
          workspaceId: uploadWorkspaceId,
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
          title: "Project imported",
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
      setUploadWorkspaceId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateWorkspace = (data: WorkspaceFormData) => {
    createWorkspaceMutation.mutate(data);
  };

  const handleUpdateWorkspace = (data: WorkspaceFormData) => {
    if (editingWorkspace) {
      updateWorkspaceMutation.mutate({ id: editingWorkspace.id, data });
    }
  };

  const handleEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    workspaceForm.reset({
      name: workspace.name,
      description: workspace.description || "",
      color: workspace.color || "#3B82F6",
    });
  };

  const handleCreateProject = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const getProjectsForWorkspace = (workspaceId: number) => {
    return allProjects?.filter(p => p.workspaceId === workspaceId) || [];
  };

  const unassignedProjects = allProjects?.filter(p => !p.workspaceId) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-library-title">Project Library</h1>
          <p className="text-muted-foreground">Organize your projects into workspaces</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-upload-project">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Project File</DialogTitle>
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
                  <label className="text-sm font-medium">Assign to Workspace (optional)</label>
                  <Select 
                    value={uploadWorkspaceId?.toString() || ""} 
                    onValueChange={(val) => setUploadWorkspaceId(val ? parseInt(val) : null)}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-upload-workspace">
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No workspace</SelectItem>
                      {workspaces?.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id.toString()}>
                          {ws.name}
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
                  setUploadWorkspaceId(null);
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

          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-project">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>Add a new project to your library</DialogDescription>
              </DialogHeader>
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Project description" {...field} value={field.value || ""} data-testid="input-project-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="workspaceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-project-workspace">
                              <SelectValue placeholder="Select workspace (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No workspace</SelectItem>
                            {workspaces?.map((ws) => (
                              <SelectItem key={ws.id} value={ws.id.toString()}>
                                {ws.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <Input placeholder="Manager name" {...field} value={field.value || ""} data-testid="input-project-manager" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-project-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on-hold">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)} data-testid="button-cancel-project">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createProjectMutation.isPending} data-testid="button-submit-project">
                      {createProjectMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={workspaceDialogOpen || !!editingWorkspace} onOpenChange={(open) => {
            if (!open) {
              setWorkspaceDialogOpen(false);
              setEditingWorkspace(null);
              workspaceForm.reset();
            } else {
              setWorkspaceDialogOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-workspace">
                <Library className="mr-2 h-4 w-4" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingWorkspace ? "Edit Workspace" : "Create New Workspace"}</DialogTitle>
                <DialogDescription>
                  {editingWorkspace ? "Update your workspace details" : "Create a workspace to organize your projects"}
                </DialogDescription>
              </DialogHeader>
              <Form {...workspaceForm}>
                <form onSubmit={workspaceForm.handleSubmit(editingWorkspace ? handleUpdateWorkspace : handleCreateWorkspace)} className="space-y-4">
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter workspace name" {...field} data-testid="input-workspace-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Workspace description" {...field} value={field.value || ""} data-testid="input-workspace-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
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
                      setWorkspaceDialogOpen(false);
                      setEditingWorkspace(null);
                      workspaceForm.reset();
                    }} data-testid="button-cancel-workspace">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createWorkspaceMutation.isPending || updateWorkspaceMutation.isPending} 
                      data-testid="button-submit-workspace"
                    >
                      {createWorkspaceMutation.isPending || updateWorkspaceMutation.isPending 
                        ? (editingWorkspace ? "Updating..." : "Creating...") 
                        : (editingWorkspace ? "Update" : "Create")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {workspacesLoading ? (
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
          {workspaces && workspaces.length > 0 ? (
            workspaces.map((workspace) => (
              <WorkspaceSection
                key={workspace.id}
                workspace={workspace}
                projects={getProjectsForWorkspace(workspace.id)}
                onDelete={() => deleteWorkspaceMutation.mutate(workspace.id)}
                onEdit={() => handleEditWorkspace(workspace)}
              />
            ))
          ) : null}

          {unassignedProjects.length > 0 && (
            <Card data-testid="card-unassigned-projects">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Unassigned Projects</CardTitle>
                  <Badge variant="secondary">
                    {unassignedProjects.length} project{unassignedProjects.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <CardDescription>Projects not assigned to any workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {unassignedProjects.map((project) => (
                    <Card key={project.id} className="hover-elevate" data-testid={`card-project-${project.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FolderKanban className="h-4 w-4 text-primary flex-shrink-0" />
                            <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1 text-xs text-muted-foreground mb-3">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="font-medium text-foreground">{project.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Manager:</span>
                            <span className="font-medium text-foreground">{project.projectManager || "N/A"}</span>
                          </div>
                        </div>
                        <Link href={`/projects/${project.id}`}>
                          <Button className="w-full" variant="outline" size="sm" data-testid={`button-view-project-${project.id}`}>
                            View Details
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!workspaces || workspaces.length === 0) && unassignedProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Library className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your library is empty</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Create a workspace to start organizing your projects, or add projects directly to get started.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setProjectDialogOpen(true)} data-testid="button-create-first-project">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Project
                  </Button>
                  <Button onClick={() => setWorkspaceDialogOpen(true)} data-testid="button-create-first-workspace">
                    <Library className="mr-2 h-4 w-4" />
                    Create Workspace
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
