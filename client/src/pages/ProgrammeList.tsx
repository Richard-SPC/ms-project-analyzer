import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, Upload, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";
import { formatDateUK } from "@/lib/utils";

const formSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required"),
  statusDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? (val ? new Date(val) : undefined) : val
  ).optional(),
});

type FormData = z.infer<typeof formSchema>;

function ProgrammeTile({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const { data: completion } = useQuery({
    queryKey: [`/api/projects/${project.id}/completion`],
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-programme-${project.id}`}>
        <CardHeader className="py-0.5 px-2">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-normal">{project.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <div className="text-xs">
                <p className="text-muted-foreground leading-tight">Status Date</p>
                <p className="font-medium text-foreground leading-tight">
                  {project.statusDate ? formatDateUK(project.statusDate) : "N/A"}
                </p>
              </div>
              <div className="text-xs">
                <p className="text-muted-foreground leading-tight">Overall Complete</p>
                <p className="font-medium text-foreground leading-tight">
                  {completion?.percentComplete ?? "-"}%
                </p>
              </div>
              <Link href={`/programmes/${project.id}`}>
                <Button variant="outline" size="sm" data-testid={`button-view-programme-${project.id}`}>
                  View Details
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                data-testid={`button-delete-programme-${project.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the programme "{project.name}" and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`button-confirm-delete-${project.id}`}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Projects() {
  const [searchText, setSearchText] = useState("");
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      projectManager: "",
      status: "active",
      statusDate: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      form.reset();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Programme deleted",
        description: "Programme has been removed.",
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
    onSuccess: (data) => {
      if (data.requiresConversion) {
        toast({
          title: "Conversion Required",
          description: data.message,
          variant: "default",
          duration: 10000,
        });
        setUploadOpen(false);
        setUploadFile(null);
      } else if (data.success && data.project) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({
          title: "Programme imported",
          description: data.message || `Successfully imported "${data.project.name}"`,
        });
        setUploadOpen(false);
        setUploadFile(null);
      } else if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({
          title: "File uploaded",
          description: `Successfully uploaded ${data.fileName}`,
        });
        setUploadOpen(false);
        setUploadFile(null);
      } else {
        toast({
          title: "Upload issue",
          description: data.message || "Please check the file and try again",
          variant: "destructive",
        });
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

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const filteredProjects = projects?.filter((project) =>
    project.name.toLowerCase().includes(searchText.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-programmes-title">Programmes</h1>
        </div>
        <Input
          placeholder="Search programmes..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-programmes"
        />
      </div>


      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <ProgrammeTile
              key={project.id}
              project={project}
              onDelete={() => deleteMutation.mutate(project.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No programmes found</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a Microsoft Project file to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
