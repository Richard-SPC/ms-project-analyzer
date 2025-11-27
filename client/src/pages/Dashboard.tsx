import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

const PROJECT_STATUSES = [
  "Tender",
  "Pre-Construction",
  "On Site",
  "Off Site",
  "Commissioning",
  "Complete",
];

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const totalProjects = projects?.length || 0;

  // Group projects by status
  const projectsByStatus = PROJECT_STATUSES.reduce((acc, status) => {
    acc[status] = projects?.filter(p => p.status === status) || [];
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Programme Dashboard
          </h1>
          <p className="text-muted-foreground">
            Microsoft Project Programme Analyser
          </p>
        </div>
        <Link href="/projects">
          <Button data-testid="button-view-projects">
            View All Projects
          </Button>
        </Link>
      </div>

      <Card data-testid="card-total-projects">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-projects">
            {totalProjects}
          </div>
          <p className="text-xs text-muted-foreground">All programmes</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-6 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROJECT_STATUSES.map((status) => {
            const projectsForStatus = projectsByStatus[status];
            return (
              <Card 
                key={status} 
                data-testid={`card-project-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="py-2 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{status}</CardTitle>
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold" data-testid={`text-count-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {projectsForStatus.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pb-2">
                  {projectsForStatus.length > 0 ? (
                    <div className="space-y-1">
                      {projectsForStatus.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`}>
                          <div 
                            className="flex items-center justify-between p-2 hover-elevate rounded-md border text-xs" 
                            data-testid={`card-project-${project.id}-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-xs truncate">{project.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{project.projectManager || "No manager"}</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No projects</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
