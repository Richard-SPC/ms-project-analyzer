import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, FileCheck } from "lucide-react";
import { Link } from "wouter";
import type { Workspace, Project } from "@shared/schema";

const PROJECT_STATUSES = [
  "Tender",
  "Pre-Construction",
  "On Site",
  "Off Site",
  "Commissioning",
  "Complete",
];

export default function Dashboard() {
  const { data: workspaces, isLoading: workspacesLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const totalProjects = workspaces?.length || 0;

  // Group workspaces by status
  const projectsByStatus = PROJECT_STATUSES.reduce((acc, status) => {
    acc[status] = workspaces?.filter(p => p.status === status) || [];
    return acc;
  }, {} as Record<string, Workspace[]>);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
          Overview
        </h1>
      </div>

      <Card data-testid="card-total-projects" className="w-fit">
        <CardContent className="px-3 py-2">
          <div className="text-lg font-bold" data-testid="text-total-projects">
            {totalProjects}
          </div>
          <p className="text-xs text-muted-foreground">Projects</p>
          <div className="text-lg font-bold mt-2" data-testid="text-total-programmes">
            {allProjects?.length || 0}
          </div>
          <p className="text-xs text-muted-foreground">Programmes</p>
        </CardContent>
      </Card>

      {workspacesLoading ? (
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
                      {projectsForStatus.map((workspace) => (
                        <div key={workspace.id} className="space-y-1">
                          <div className="p-2 rounded-md border bg-muted/50 text-xs">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{workspace.name}</p>
                                {workspace.client && (
                                  <p className="text-xs text-muted-foreground truncate">Client: {workspace.client}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="ml-2 space-y-1">
                            {(() => {
                              const workspaceProjects = allProjects?.filter(p => p.workspaceId === workspace.id) || [];
                              const mostRecentProject = workspaceProjects.reduce((latest, current) => {
                                const latestDate = latest.statusDate ? new Date(latest.statusDate).getTime() : 0;
                                const currentDate = current.statusDate ? new Date(current.statusDate).getTime() : 0;
                                return currentDate > latestDate ? current : latest;
                              }, workspaceProjects[0]);
                              
                              return mostRecentProject ? (
                                <Link key={mostRecentProject.id} href={`/projects/${mostRecentProject.id}`}>
                                  <div 
                                    className="flex items-center gap-2 p-1 hover-elevate rounded-md border text-xs" 
                                    data-testid={`card-programme-${mostRecentProject.id}-in-${workspace.id}`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs truncate">{mostRecentProject.name}</p>
                                    </div>
                                  </div>
                                </Link>
                              ) : null;
                            })()}
                          </div>
                        </div>
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
