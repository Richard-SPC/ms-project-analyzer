import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProcurementTask {
  id: number;
  name: string;
  duration: number | null;
  percentComplete: number;
  projectId: number;
  projectName: string;
}

export default function ProcurementDurations() {
  const { data: procurementTasks, isLoading } = useQuery<ProcurementTask[]>({
    queryKey: ["/api/procurement-tasks"],
  });

  const [searchText, setSearchText] = useState("");
  const [selectedProgramme, setSelectedProgramme] = useState<string>("all");
  const [completionFilter, setCompletionFilter] = useState<string>("all");

  const programmes = useMemo(() => {
    if (!procurementTasks) return [];
    return Array.from(new Set(procurementTasks.map(t => t.projectName))).sort();
  }, [procurementTasks]);

  const filteredTasks = useMemo(() => {
    if (!procurementTasks) return [];
    
    return procurementTasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchText.toLowerCase());
      const matchesProgramme = selectedProgramme === "all" || task.projectName === selectedProgramme;
      
      let matchesCompletion = true;
      if (completionFilter !== "all") {
        if (completionFilter === "not-started" && task.percentComplete !== 0) matchesCompletion = false;
        if (completionFilter === "in-progress" && (task.percentComplete === 0 || task.percentComplete === 100)) matchesCompletion = false;
        if (completionFilter === "completed" && task.percentComplete !== 100) matchesCompletion = false;
      }
      
      return matchesSearch && matchesProgramme && matchesCompletion;
    });
  }, [procurementTasks, searchText, selectedProgramme, completionFilter]);

  const totalDuration = procurementTasks?.reduce((sum, task) => sum + (task.duration || 0), 0) || 0;
  const filteredDuration = filteredTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const taskCount = procurementTasks?.length || 0;
  const filteredCount = filteredTasks.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-procurement-title">
          Procurement Durations
        </h1>
        <p className="text-muted-foreground">
          Tasks containing "procurement" across all programmes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-stat-task-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-task-count">
              {filteredCount} / {taskCount}
            </div>
            <p className="text-xs text-muted-foreground">Filtered / Total</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-total-duration">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total-duration">
              {filteredDuration} / {totalDuration} days
            </div>
            <p className="text-xs text-muted-foreground">Filtered / Total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Procurement Tasks</CardTitle>
          <CardDescription>Search and filter procurement-related tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Search Task Name</label>
              <Input
                placeholder="Search tasks..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                data-testid="input-search-procurement"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Programme</label>
              <Select value={selectedProgramme} onValueChange={setSelectedProgramme}>
                <SelectTrigger data-testid="select-programme-filter">
                  <SelectValue placeholder="All Programmes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programmes</SelectItem>
                  {programmes.map((prog) => (
                    <SelectItem key={prog} value={prog}>
                      {prog}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Completion Status</label>
              <Select value={completionFilter} onValueChange={setCompletionFilter}>
                <SelectTrigger data-testid="select-completion-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(searchText || selectedProgramme !== "all" || completionFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchText("");
                setSelectedProgramme("all");
                setCompletionFilter("all");
              }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-programme">Programme</TableHead>
                    <TableHead data-testid="header-task-name">Task Name</TableHead>
                    <TableHead className="text-right" data-testid="header-duration-days">
                      Duration (days)
                    </TableHead>
                    <TableHead className="text-right" data-testid="header-duration-weeks">
                      Duration (weeks)
                    </TableHead>
                    <TableHead className="text-right" data-testid="header-complete">
                      % Complete
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id} data-testid={`row-procurement-task-${task.id}`}>
                      <TableCell className="font-medium" data-testid={`text-programme-${task.id}`}>
                        {task.projectName}
                      </TableCell>
                      <TableCell data-testid={`text-task-name-${task.id}`}>
                        {task.name}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-duration-days-${task.id}`}>
                        {task.duration ?? "-"}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-duration-weeks-${task.id}`}>
                        {task.duration ? (task.duration / 7).toFixed(1) : "-"}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-complete-${task.id}`}>
                        {task.percentComplete}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No procurement tasks found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
