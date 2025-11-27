import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
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
  const [viewMode, setViewMode] = useState("latest");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const { data: workspaces, isLoading: workspacesLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const totalProjects = workspaces?.length || 0;

  // Get unique clients
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    workspaces?.forEach(workspace => {
      if (workspace.client) {
        clients.add(workspace.client);
      }
    });
    return Array.from(clients).sort();
  }, [workspaces]);

  // Filter workspaces by client
  const filteredWorkspaces = useMemo(() => {
    if (selectedClient === "all") return workspaces || [];
    return workspaces?.filter(w => w.client === selectedClient) || [];
  }, [workspaces, selectedClient]);

  // Group filtered workspaces by status
  const projectsByStatus = PROJECT_STATUSES.reduce((acc, status) => {
    acc[status] = filteredWorkspaces.filter(p => p.status === status) || [];
    return acc;
  }, {} as Record<string, Workspace[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Overview
          </h1>
        </div>
        <Card data-testid="card-total-projects" className="w-fit">
          <CardContent className="px-3 py-1 flex gap-6">
            <div>
              <div className="text-lg font-bold" data-testid="text-total-projects">
                {totalProjects}
              </div>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
            <div>
              <div className="text-lg font-bold" data-testid="text-total-programmes">
                {allProjects?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Programmes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-project-statuses">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <CardTitle>Projects by Status</CardTitle>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48" data-testid="select-client">
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {uniqueClients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value)}
            data-testid="toggle-view-mode"
            className="border rounded-md"
          >
            <ToggleGroupItem value="latest" aria-label="Latest Programme" data-testid="toggle-latest">
              Latest Programme
            </ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="All Programmes" data-testid="toggle-all">
              All Programmes
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {workspacesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <Accordion type="single" collapsible defaultValue="Tender">
              {PROJECT_STATUSES.map((status) => {
                const projectsForStatus = projectsByStatus[status];
                return (
                  <AccordionItem key={status} value={status}>
                    <AccordionTrigger 
                      data-testid={`button-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                      className="hover:no-underline"
                    >
                      <div className="flex items-center justify-between w-full gap-2 pr-2">
                        <span className="text-sm font-medium">{status}</span>
                        <span 
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                          data-testid={`text-count-${status.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {projectsForStatus.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {projectsForStatus.length > 0 ? (
                        <div className="space-y-2">
                          {projectsForStatus.map((workspace) => {
                            const workspaceProjects = allProjects?.filter(p => p.workspaceId === workspace.id) || [];
                            const mostRecentProject = workspaceProjects.reduce((latest, current) => {
                              const latestDate = latest.statusDate ? new Date(latest.statusDate).getTime() : 0;
                              const currentDate = current.statusDate ? new Date(current.statusDate).getTime() : 0;
                              return currentDate > latestDate ? current : latest;
                            }, workspaceProjects[0]);
                            
                            const projectsToDisplay = viewMode === "all" ? workspaceProjects : (mostRecentProject ? [mostRecentProject] : []);
                            
                            return (
                              <div key={workspace.id} className="space-y-2">
                                {projectsToDisplay.length > 0 ? (
                                  projectsToDisplay.map(project => (
                                    <Link key={project.id} href={`/programmes/${project.id}`}>
                                      <div 
                                        className="flex items-center justify-between gap-2 p-2 hover-elevate rounded-md border bg-muted/50 text-xs"
                                        data-testid={`card-programme-${project.id}-in-${workspace.id}`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{workspace.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{viewMode === "all" ? "Programme: " : "Latest Programme: "}{project.name}</p>
                                          </div>
                                        </div>
                                        {workspace.client && (
                                          <p className="text-sm font-bold text-foreground truncate whitespace-nowrap ml-2">{workspace.client}</p>
                                        )}
                                      </div>
                                    </Link>
                                  ))
                                ) : (
                                  <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/50 text-xs">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold truncate">{workspace.name}</p>
                                        <p className="text-xs text-muted-foreground">No programme uploaded</p>
                                      </div>
                                    </div>
                                    {workspace.client && (
                                      <p className="text-sm font-bold text-foreground truncate whitespace-nowrap ml-2">{workspace.client}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No projects</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
