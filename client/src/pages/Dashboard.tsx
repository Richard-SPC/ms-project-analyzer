import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, FileCheck } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Workspace, Project } from "@shared/schema";

const COLORS = ["#006093", "#159775", "#29CE58", "#494949", "#8B5CF6", "#EC4899", "#F59E0B", "#3B82F6"];

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

  // Calculate projects by client
  const projectsByClient = useMemo(() => {
    if (!workspaces) return [];
    const clientCounts: Record<string, number> = {};
    workspaces.forEach(workspace => {
      const clientName = workspace.client || "Unassigned";
      clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
    });
    return Object.entries(clientCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [workspaces]);

  // Calculate projects by PM
  const projectsByPM = useMemo(() => {
    if (!workspaces) return [];
    const pmCounts: Record<string, number> = {};
    workspaces.forEach(workspace => {
      const pmName = workspace.projectManager || "Unassigned";
      pmCounts[pmName] = (pmCounts[pmName] || 0) + 1;
    });
    return Object.entries(pmCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [workspaces]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Overview
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card data-testid="card-total-projects" className="w-72">
            <CardContent className="px-4 py-4 space-y-4">
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-projects">
                  {totalProjects}
                </div>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-programmes">
                  {allProjects?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">Programmes</p>
              </div>
            </CardContent>
          </Card>
          
          {projectsByClient.length > 0 && (
            <Card data-testid="card-projects-by-client" className="w-72">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Client</CardTitle>
              </CardHeader>
              <CardContent className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectsByClient}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={50}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {projectsByClient.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `${value}`}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {projectsByPM.length > 0 && (
            <Card data-testid="card-projects-by-pm" className="w-72">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By PM</CardTitle>
              </CardHeader>
              <CardContent className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectsByPM} layout="vertical" margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => `${value}`}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="value" fill="#006093" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
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
            <Accordion type="single" collapsible>
              {PROJECT_STATUSES.map((status) => {
                const projectsForStatus = projectsByStatus[status];
                return (
                  <AccordionItem key={status} value={status}>
                    <AccordionTrigger 
                      data-testid={`button-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                      className="hover:no-underline"
                    >
                      <div className="flex items-center justify-between w-full gap-2 pr-2">
                        <span className="text-lg font-bold">{status}</span>
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
