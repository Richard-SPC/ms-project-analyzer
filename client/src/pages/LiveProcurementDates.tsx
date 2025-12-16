import { useQuery } from "@tanstack/react-query";
import { Clock, Package, X, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateUK } from "@/lib/utils";
import { useState, useMemo } from "react";

interface LiveProcurementTask {
  id: number;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  duration: number | null;
  percentComplete: number;
  projectId: number;
  projectName: string;
  workspaceName: string;
  client?: string;
  status?: string;
}

export default function LiveProcurementDates() {
  const { data: liveProcurement, isLoading } = useQuery<LiveProcurementTask[]>({
    queryKey: ["/api/live-procurement-dates"],
  });

  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Group by workspace and project
  const groupedData = useMemo(() => {
    return liveProcurement?.reduce((acc, task) => {
      const workspaceKey = task.workspaceName;
      const projectKey = task.projectName;
      
      if (!acc[workspaceKey]) {
        acc[workspaceKey] = {};
      }
      if (!acc[workspaceKey][projectKey]) {
        acc[workspaceKey][projectKey] = [];
      }
      acc[workspaceKey][projectKey].push(task);
      return acc;
    }, {} as Record<string, Record<string, LiveProcurementTask[]>>) || {};
  }, [liveProcurement]);

  // Get unique clients and projects for filtering
  const uniqueClients = useMemo(() => {
    if (!liveProcurement) return [];
    const clients = [...new Set(liveProcurement.map(t => t.client).filter(Boolean))];
    return clients.sort();
  }, [liveProcurement]);

  const uniqueProjects = useMemo(() => {
    if (!liveProcurement) return [];
    const filteredByClient = selectedClient === "all" 
      ? liveProcurement 
      : liveProcurement.filter(t => t.client === selectedClient);
    const projects = [...new Set(filteredByClient.map(t => t.projectName))];
    return projects.sort();
  }, [liveProcurement, selectedClient]);

  // Filter grouped data
  const filteredGroupedData = useMemo(() => {
    const filtered: typeof groupedData = {};
    
    Object.entries(groupedData).forEach(([workspaceName, projects]) => {
      Object.entries(projects).forEach(([projectName, tasks]) => {
        const firstTask = tasks[0];
        const matchesClient = selectedClient === "all" || firstTask?.client === selectedClient;
        const matchesProject = selectedProjects.size === 0 || selectedProjects.has(projectName);
        
        if (matchesClient && matchesProject) {
          if (!filtered[workspaceName]) {
            filtered[workspaceName] = {};
          }
          filtered[workspaceName][projectName] = tasks;
        }
      });
    });
    
    return filtered;
  }, [groupedData, selectedClient, selectedProjects]);

  const toggleProject = (key: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedProjects(newSet);
  };

  const hasActiveFilters = selectedClient !== "all" || selectedProjects.size > 0;

  const toggleProjectSelection = (projectName: string) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(projectName)) {
      newSet.delete(projectName);
    } else {
      newSet.add(projectName);
    }
    setSelectedProjects(newSet);
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-live-procurement-title">
          Live Procurement Dates
        </h1>
        <p className="text-muted-foreground mt-2">
          Latest procurement tasks across all projects (showing most recent programme version)
        </p>
      </div>

      {!isLoading && liveProcurement && liveProcurement.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger data-testid="select-client-filter">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client || "unknown"}>
                      {client || "No Client"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Project(s)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-project-filter">
                    {selectedProjects.size === 0
                      ? "All Projects"
                      : `${selectedProjects.size} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-3" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Select Projects</p>
                      {selectedProjects.size > 0 && (
                        <button
                          onClick={() => setSelectedProjects(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          data-testid="button-clear-project-selection"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {uniqueProjects.map((project) => (
                        <div key={project} className="flex items-center gap-2">
                          <Checkbox
                            id={`project-${project}`}
                            checked={selectedProjects.has(project)}
                            onCheckedChange={() => toggleProjectSelection(project)}
                            data-testid={`checkbox-project-${project.replace(/\s+/g, "-").toLowerCase()}`}
                          />
                          <label
                            htmlFor={`project-${project}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {project}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedClient("all");
                setSelectedProjects(new Set());
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(filteredGroupedData).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {liveProcurement && liveProcurement.length > 0
                ? "No Data Matching Filters"
                : "No Procurement Data Available"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {liveProcurement && liveProcurement.length > 0
                ? "Try adjusting your filters to find what you're looking for."
                : "Upload programmes with procurement tasks to see data here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(filteredGroupedData).map(([workspaceName, projects]) => (
          <div key={workspaceName} className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-xl font-semibold text-foreground" data-testid={`text-project-${workspaceName}`}>
                {workspaceName}
              </h2>
            </div>

            {Object.entries(projects).map(([projectName, tasks]) => {
              const projectKey = `${workspaceName}-${projectName}`;
              const isExpanded = expandedProjects.has(projectKey);

              return (
                <Collapsible
                  key={projectKey}
                  open={isExpanded}
                  onOpenChange={() => toggleProject(projectKey)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="h-6 w-6 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-6 w-6 flex-shrink-0" />
                            )}
                            <Clock className="h-6 w-6 flex-shrink-0" />
                            <CardTitle className="text-lg truncate">{projectName}</CardTitle>
                          </div>
                          <div className="flex items-center justify-end gap-4 flex-shrink-0 w-80">
                            <div className="flex-1 text-center">
                              <span className="text-base text-muted-foreground whitespace-nowrap font-medium">
                                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex-1 text-center">
                              {tasks[0]?.client && (
                                <span className="text-sm bg-muted px-3 py-2 rounded whitespace-nowrap">
                                  {tasks[0].client}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 text-center">
                              {tasks[0]?.status && (
                                <span className="text-sm bg-muted px-3 py-2 rounded whitespace-nowrap">
                                  {tasks[0].status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="h-auto">
                                <TableHead className="text-sm" data-testid="header-task-name">
                                  Task Name
                                </TableHead>
                                <TableHead className="text-sm" data-testid="header-start-date">
                                  Start Date
                                </TableHead>
                                <TableHead className="text-sm" data-testid="header-finish-date">
                                  Finish Date
                                </TableHead>
                                <TableHead className="text-right text-sm" data-testid="header-duration">
                                  Duration (days)
                                </TableHead>
                                <TableHead className="text-right text-sm" data-testid="header-complete">
                                  % Complete
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tasks.map((task) => (
                                <TableRow key={task.id} data-testid={`row-procurement-task-${task.id}`}>
                                  <TableCell className="text-sm py-3" data-testid={`text-task-name-${task.id}`}>
                                    {task.name}
                                  </TableCell>
                                  <TableCell className="text-sm py-3" data-testid={`text-start-date-${task.id}`}>
                                    {task.startDate ? formatDateUK(task.startDate) : "N/A"}
                                  </TableCell>
                                  <TableCell className="text-sm py-3" data-testid={`text-finish-date-${task.id}`}>
                                    {task.endDate ? formatDateUK(task.endDate) : "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm py-3" data-testid={`text-duration-${task.id}`}>
                                    {task.duration ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm py-3" data-testid={`text-complete-${task.id}`}>
                                    {task.percentComplete.toFixed(0)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
