import { useQuery } from "@tanstack/react-query";
import { Pencil, X, ChevronDown, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateUK } from "@/lib/utils";
import { useState, useMemo } from "react";
import { format } from "date-fns";

interface LiveDesignTask {
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

export default function LiveDesignDates() {
  const { data: liveDesign, isLoading } = useQuery<LiveDesignTask[]>({
    queryKey: ["/api/live-design-dates"],
  });

  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedProgress, setSelectedProgress] = useState<string>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  const groupedData = useMemo(() => {
    return liveDesign?.reduce((acc, task) => {
      const workspaceKey = task.workspaceName;
      const projectKey = task.projectName;
      if (!acc[workspaceKey]) acc[workspaceKey] = {};
      if (!acc[workspaceKey][projectKey]) acc[workspaceKey][projectKey] = [];
      acc[workspaceKey][projectKey].push(task);
      return acc;
    }, {} as Record<string, Record<string, LiveDesignTask[]>>) || {};
  }, [liveDesign]);

  const uniqueClients = useMemo(() => {
    if (!liveDesign) return [];
    return [...new Set(liveDesign.map(t => t.client).filter(Boolean))].sort() as string[];
  }, [liveDesign]);

  const uniqueProjects = useMemo(() => {
    if (!liveDesign) return [];
    const filteredByClient = selectedClient === "all"
      ? liveDesign
      : liveDesign.filter(t => t.client === selectedClient);
    return [...new Set(filteredByClient.map(t => t.projectName))].sort();
  }, [liveDesign, selectedClient]);

  const matchesProgressFilter = (progress: number): boolean => {
    if (selectedProgress === "all") return true;
    if (selectedProgress === "0") return progress === 0;
    if (selectedProgress === "1-99") return progress > 0 && progress < 100;
    if (selectedProgress === "100") return progress === 100;
    return true;
  };

  const filteredGroupedData = useMemo(() => {
    const filtered: typeof groupedData = {};
    Object.entries(groupedData).forEach(([workspaceName, projects]) => {
      Object.entries(projects).forEach(([projectName, tasks]) => {
        const firstTask = tasks[0];
        const matchesClient = selectedClient === "all" || firstTask?.client === selectedClient;
        const matchesProject = selectedProjects.size === 0 || selectedProjects.has(projectName);
        const filteredTasks = tasks.filter(task =>
          matchesProgressFilter(task.percentComplete) && task.duration !== 0
        );
        if (matchesClient && matchesProject && filteredTasks.length > 0) {
          if (!filtered[workspaceName]) filtered[workspaceName] = {};
          filtered[workspaceName][projectName] = filteredTasks;
        }
      });
    });
    return filtered;
  }, [groupedData, selectedClient, selectedProjects, selectedProgress]);

  const toggleProject = (key: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedProjects(newSet);
  };

  const hasActiveFilters = selectedClient !== "all" || selectedProjects.size > 0 || selectedProgress !== "all";

  const toggleProjectSelection = (projectName: string) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(projectName)) newSet.delete(projectName);
    else newSet.add(projectName);
    setSelectedProjects(newSet);
  };

  const allTasks = useMemo(() => liveDesign || [], [liveDesign]);

  const tasksStartingThisMonth = useMemo(() => {
    return allTasks.filter(task => {
      if (!task.startDate || task.duration === 0) return false;
      const matchesClient = selectedClient === "all" || task.client === selectedClient;
      if (!matchesClient) return false;
      const matchesProject = selectedProjects.size === 0 || selectedProjects.has(task.projectName);
      if (!matchesProject) return false;
      return format(new Date(task.startDate), "yyyy-MM") === selectedMonth;
    });
  }, [allTasks, selectedMonth, selectedClient, selectedProjects]);

  const tasksEndingThisMonth = useMemo(() => {
    return allTasks.filter(task => {
      if (!task.endDate || task.duration === 0) return false;
      const matchesClient = selectedClient === "all" || task.client === selectedClient;
      if (!matchesClient) return false;
      const matchesProject = selectedProjects.size === 0 || selectedProjects.has(task.projectName);
      if (!matchesProject) return false;
      return format(new Date(task.endDate), "yyyy-MM") === selectedMonth;
    });
  }, [allTasks, selectedMonth, selectedClient, selectedProjects]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allTasks.forEach(task => {
      if (task.startDate) months.add(format(new Date(task.startDate), "yyyy-MM"));
      if (task.endDate) months.add(format(new Date(task.endDate), "yyyy-MM"));
    });
    return Array.from(months).sort().reverse();
  }, [allTasks]);

  const groupTasksByProject = (tasks: LiveDesignTask[]) => {
    return tasks.reduce((acc, task) => {
      if (!acc[task.projectName]) acc[task.projectName] = [];
      acc[task.projectName].push(task);
      return acc;
    }, {} as Record<string, LiveDesignTask[]>);
  };

  const startingTasksByProject = useMemo(() => {
    const grouped = groupTasksByProject(tasksStartingThisMonth);
    Object.keys(grouped).forEach(p => {
      grouped[p].sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return da - db;
      });
    });
    return grouped;
  }, [tasksStartingThisMonth]);

  const endingTasksByProject = useMemo(() => {
    const grouped = groupTasksByProject(tasksEndingThisMonth);
    Object.keys(grouped).forEach(p => {
      grouped[p].sort((a, b) => {
        const da = a.endDate ? new Date(a.endDate).getTime() : 0;
        const db = b.endDate ? new Date(b.endDate).getTime() : 0;
        return da - db;
      });
    });
    return grouped;
  }, [tasksEndingThisMonth]);

  const formatDurationWeeks = (duration: number | null): string => {
    if (!duration) return "N/A";
    const weeks = duration / 5;
    return weeks % 1 === 0 ? weeks.toFixed(0) : weeks.toFixed(1);
  };

  const exportMonthlyToExcel = () => {
    const wb = XLSX.utils.book_new();
    const startData: (string | number)[][] = [
      ["Design Tasks Starting", format(new Date(selectedMonth + "-01"), "MMMM yyyy")],
      [],
      ["Project", "Task Name", "Start Date"]
    ];
    tasksStartingThisMonth.forEach(task => {
      startData.push([task.projectName, task.name, task.startDate ? formatDateUK(task.startDate) : "N/A"]);
    });
    const endData: (string | number)[][] = [
      ["Design Tasks Completing", format(new Date(selectedMonth + "-01"), "MMMM yyyy")],
      [],
      ["Project", "Task Name", "End Date"]
    ];
    tasksEndingThisMonth.forEach(task => {
      endData.push([task.projectName, task.name, task.endDate ? formatDateUK(task.endDate) : "N/A"]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(startData);
    const ws2 = XLSX.utils.aoa_to_sheet(endData);
    ws1["!cols"] = [{ wch: 25 }, { wch: 40 }, { wch: 15 }];
    ws2["!cols"] = [{ wch: 25 }, { wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Starting");
    XLSX.utils.book_append_sheet(wb, ws2, "Completing");
    XLSX.writeFile(wb, `Design_${format(new Date(selectedMonth + "-01"), "MMM_yyyy")}.xlsx`);
  };

  const exportAllFilteredToExcel = () => {
    const wb = XLSX.utils.book_new();
    const tasksByProject: Record<string, LiveDesignTask[]> = {};
    Object.values(filteredGroupedData).forEach(projects => {
      Object.values(projects).forEach(tasks => {
        tasks.forEach(task => {
          if (!tasksByProject[task.projectName]) tasksByProject[task.projectName] = [];
          tasksByProject[task.projectName].push(task);
        });
      });
    });
    Object.keys(tasksByProject).forEach(p => {
      tasksByProject[p].sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : (a.endDate ? new Date(a.endDate).getTime() : Infinity);
        const db = b.startDate ? new Date(b.startDate).getTime() : (b.endDate ? new Date(b.endDate).getTime() : Infinity);
        return da - db;
      });
    });
    const sheetData: (string | number)[][] = [
      ["All Filtered Design Items"],
      [],
      ["Project", "Task Name", "Progress", "Start Date", "End Date", "Duration (Weeks)"]
    ];
    Object.keys(tasksByProject).sort().forEach(projectName => {
      tasksByProject[projectName].forEach(task => {
        sheetData.push([
          task.projectName,
          task.name,
          `${task.percentComplete}%`,
          task.startDate ? formatDateUK(task.startDate) : "N/A",
          task.endDate ? formatDateUK(task.endDate) : "N/A",
          formatDurationWeeks(task.duration)
        ]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "All Design Items");
    XLSX.writeFile(wb, `All_Design_Items_${format(new Date(), "dd_MMM_yyyy")}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-live-design-title">
          Live Design Dates
        </h1>
        <p className="text-muted-foreground mt-2">
          Latest design tasks across all projects (showing most recent programme version)
        </p>
      </div>

      {!isLoading && liveDesign && liveDesign.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger data-testid="select-client-filter">
                  <SelectValue placeholder="All Clients" />
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
            <div>
              <label className="text-sm font-medium mb-2 block">Progress</label>
              <Select value={selectedProgress} onValueChange={setSelectedProgress}>
                <SelectTrigger data-testid="select-progress-filter">
                  <SelectValue placeholder="All Progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="0">0 (Not Started)</SelectItem>
                  <SelectItem value="1-99">1-99 (In Progress)</SelectItem>
                  <SelectItem value="100">100 (Complete)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Project(s)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-project-filter">
                    {selectedProjects.size === 0 ? "All Projects" : `${selectedProjects.size} selected`}
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
                          <label htmlFor={`project-${project}`} className="text-sm cursor-pointer flex-1">
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
                setSelectedProgress("all");
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {!isLoading && liveDesign && liveDesign.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {format(new Date(month + "-01"), "MMMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportMonthlyToExcel} variant="outline" size="sm" data-testid="button-export-monthly">
              <Download className="h-4 w-4 mr-2" />
              Export Monthly
            </Button>
            <Button onClick={exportAllFilteredToExcel} variant="outline" size="sm" data-testid="button-export-all-filtered">
              <Download className="h-4 w-4 mr-2" />
              Export All Filtered
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Design Tasks Starting</CardTitle>
                <CardDescription>{format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4" data-testid="text-starting-count">
                  {tasksStartingThisMonth.length}
                </div>
                {tasksStartingThisMonth.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(startingTasksByProject).map(([projectName, tasks]) => (
                      <div key={projectName} className="space-y-0.5">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">{projectName}</div>
                        {tasks.map((task) => (
                          <div key={task.id} className="text-sm p-2 bg-muted rounded ml-2 flex items-center justify-between gap-2" data-testid={`item-starting-${task.id}`}>
                            <div className="font-medium truncate flex-1">{task.name}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {task.startDate ? formatDateUK(task.startDate) : "N/A"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {tasksStartingThisMonth.length === 0 && (
                  <p className="text-sm text-muted-foreground">No design tasks starting this month</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Design Tasks Completing</CardTitle>
                <CardDescription>{format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4" data-testid="text-completing-count">
                  {tasksEndingThisMonth.length}
                </div>
                {tasksEndingThisMonth.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(endingTasksByProject).map(([projectName, tasks]) => (
                      <div key={projectName} className="space-y-0.5">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">{projectName}</div>
                        {tasks.map((task) => (
                          <div key={task.id} className="text-sm p-2 bg-muted rounded ml-2 flex items-center justify-between gap-2" data-testid={`item-completing-${task.id}`}>
                            <div className="font-medium truncate flex-1">{task.name}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {task.endDate ? formatDateUK(task.endDate) : "N/A"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {tasksEndingThisMonth.length === 0 && (
                  <p className="text-sm text-muted-foreground">No design tasks completing this month</p>
                )}
              </CardContent>
            </Card>
          </div>
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
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : liveDesign && liveDesign.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Pencil className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Design Tasks Found</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              No tasks with "Design -" in the name were found across your programmes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Design Tasks</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allKeys = Object.entries(filteredGroupedData).flatMap(([ws, projects]) =>
                  Object.keys(projects).map(p => `${ws}-${p}`)
                );
                if (expandedProjects.size === allKeys.length) {
                  setExpandedProjects(new Set());
                } else {
                  setExpandedProjects(new Set(allKeys));
                }
              }}
              data-testid="button-expand-collapse-all"
            >
              {expandedProjects.size > 0 ? "Collapse All" : "Expand All"}
            </Button>
          </div>

          {Object.entries(filteredGroupedData).map(([workspaceName, projects]) => (
            <div key={workspaceName} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {workspaceName}
              </h3>
              {Object.entries(projects).map(([projectName, tasks]) => {
                const key = `${workspaceName}-${projectName}`;
                const isExpanded = expandedProjects.has(key);
                const sortedTasks = [...tasks].sort((a, b) => {
                  const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
                  const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
                  return da - db;
                });

                return (
                  <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleProject(key)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                              <CardTitle className="text-base truncate">{projectName}</CardTitle>
                            </div>
                            <span className="text-sm text-muted-foreground shrink-0">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left p-2 font-medium">Task Name</th>
                                  <th className="text-center p-2 font-medium w-24">Progress</th>
                                  <th className="text-center p-2 font-medium w-28">Start Date</th>
                                  <th className="text-center p-2 font-medium w-28">End Date</th>
                                  <th className="text-center p-2 font-medium w-24">Duration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedTasks.map((task, idx) => (
                                  <tr key={task.id} className={idx % 2 === 0 ? "" : "bg-muted/30"} data-testid={`row-design-task-${task.id}`}>
                                    <td className="p-2">{task.name}</td>
                                    <td className="p-2 text-center">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        task.percentComplete === 100
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                          : task.percentComplete > 0
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                          : "bg-muted text-muted-foreground"
                                      }`}>
                                        {task.percentComplete}%
                                      </span>
                                    </td>
                                    <td className="p-2 text-center text-muted-foreground">
                                      {task.startDate ? formatDateUK(task.startDate) : "N/A"}
                                    </td>
                                    <td className="p-2 text-center text-muted-foreground">
                                      {task.endDate ? formatDateUK(task.endDate) : "N/A"}
                                    </td>
                                    <td className="p-2 text-center text-muted-foreground">
                                      {task.duration ? `${formatDurationWeeks(task.duration)}w` : "N/A"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ))}

          {Object.keys(filteredGroupedData).length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">No design tasks match the current filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
