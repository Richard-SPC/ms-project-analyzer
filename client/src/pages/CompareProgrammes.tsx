import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertCircle } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import type { Project, Task } from "@shared/schema";

interface ProgrammeWithTasks {
  programme: Project;
  tasks: Task[];
}

export default function CompareProgrammes() {
  const { data: allProgrammes, isLoading: programmesLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Fetch tasks for selected programmes
  const taskQueries = selectedIds.map(id => ({
    queryKey: [`/api/projects/${id}/tasks`],
  }));

  const taskResults = useQuery<Task[][]>({
    queryKey: ["selected-programme-tasks", selectedIds.join(",")],
    queryFn: async () => {
      if (selectedIds.length === 0) return [];
      const results = await Promise.all(
        selectedIds.map(id =>
          fetch(`/api/projects/${id}/tasks`)
            .then(r => r.json())
            .catch(() => [])
        )
      );
      return results;
    },
    enabled: selectedIds.length > 0,
  });

  const selectedProgrammesWithTasks = useMemo(() => {
    if (!allProgrammes || !taskResults.data) return [];
    
    return selectedIds.map((id, idx) => ({
      programme: allProgrammes.find(p => p.id === id)!,
      tasks: taskResults.data[idx] || [],
    })).filter(item => item.programme);
  }, [allProgrammes, selectedIds, taskResults.data]);

  // Extract Contract & Key Dates milestones
  const contractKeyDatesMilestones = useMemo(() => {
    if (selectedProgrammesWithTasks.length === 0) return [];

    // Find all unique milestone names across all programmes
    const allMilestones = new Map<string, Set<number>>();
    const contractSummaryWbsCodes = new Map<number, string>(); // programme id -> wbs code of summary
    
    selectedProgrammesWithTasks.forEach((progWithTasks) => {
      // Look for Contract & Key Dates summary - try multiple patterns
      let contractSummary = progWithTasks.tasks.find(
        t => t.isSummary && t.name.toLowerCase().includes("contract") && t.name.toLowerCase().includes("key")
      );
      
      // If not found, try to find the top-level summary (wbs code like "1")
      if (!contractSummary) {
        contractSummary = progWithTasks.tasks.find(
          t => t.isSummary && t.wbsCode === "1"
        );
      }
      
      // If still not found, find any summary with milestones under it
      if (!contractSummary) {
        const summariesWithMilestones = progWithTasks.tasks.filter(t => t.isSummary);
        for (const summary of summariesWithMilestones) {
          const hasMilestones = progWithTasks.tasks.some(
            t => t.isMilestone && t.wbsCode && t.wbsCode.startsWith(summary.wbsCode || "")
          );
          if (hasMilestones) {
            contractSummary = summary;
            break;
          }
        }
      }

      if (contractSummary) {
        contractSummaryWbsCodes.set(progWithTasks.programme.id, contractSummary.wbsCode || "");
        
        // Get all milestones under this summary (including nested ones)
        const milestones = progWithTasks.tasks.filter(
          t => t.isMilestone && 
              t.wbsCode && 
              t.wbsCode.startsWith(contractSummary.wbsCode || "") &&
              t.id !== contractSummary.id
        );

        milestones.forEach(m => {
          if (!allMilestones.has(m.name)) {
            allMilestones.set(m.name, new Set());
          }
          allMilestones.get(m.name)!.add(progWithTasks.programme.id);
        });
      }
    });

    // Create comparison data - group actual and planned milestones
    const milestoneGroups = new Map<string, Array<{
      name: string;
      data: Array<{ progId: number; actualDate: Date | null; plannedDate: Date | null; moved: boolean }>;
    }>>();

    allMilestones.forEach((progIds, milestoneName) => {
      // Skip if this is a planned milestone (we'll pair it with the actual)
      if (milestoneName.toLowerCase().startsWith("planned - ")) {
        return;
      }

      const actualDates: Array<{ progId: number; date: Date | null }> = [];
      const plannedDates: Array<{ progId: number; date: Date | null }> = [];
      
      selectedProgrammesWithTasks.forEach((progWithTasks) => {
        const wbsCodePrefix = contractSummaryWbsCodes.get(progWithTasks.programme.id);
        
        if (wbsCodePrefix) {
          // Find actual milestone
          const milestone = progWithTasks.tasks.find(
            t => t.isMilestone && t.name === milestoneName &&
                t.wbsCode && 
                t.wbsCode.startsWith(wbsCodePrefix)
          );
          
          // Find planned version
          const plannedMilestone = progWithTasks.tasks.find(
            t => t.isMilestone && t.name === `Planned - ${milestoneName}` &&
                t.wbsCode && 
                t.wbsCode.startsWith(wbsCodePrefix)
          );
          
          actualDates.push({
            progId: progWithTasks.programme.id,
            date: milestone?.startDate || milestone?.endDate || null,
          });
          
          plannedDates.push({
            progId: progWithTasks.programme.id,
            date: plannedMilestone?.startDate || plannedMilestone?.endDate || null,
          });
        } else {
          actualDates.push({
            progId: progWithTasks.programme.id,
            date: null,
          });
          plannedDates.push({
            progId: progWithTasks.programme.id,
            date: null,
          });
        }
      });

      // Check if dates have moved (are different across programmes)
      const allDates = [...actualDates, ...plannedDates]
        .filter(d => d.date)
        .map(d => {
          const date = typeof d.date === 'string' ? new Date(d.date) : d.date;
          return date?.getTime?.() || 0;
        });
      const moved = allDates.length > 0 && new Set(allDates).size > 1;

      const data = actualDates.map((actual, idx) => ({
        progId: actual.progId,
        actualDate: actual.date,
        plannedDate: plannedDates[idx]?.date || null,
        moved,
      }));

      milestoneGroups.set(milestoneName, [{
        name: milestoneName,
        data,
      }]);
    });

    const milestones = Array.from(milestoneGroups.values()).flat();

    return milestones.sort((a, b) => {
      // Show moved milestones first
      if (a.data.some(d => d.moved) && !b.data.some(d => d.moved)) return -1;
      if (!a.data.some(d => d.moved) && b.data.some(d => d.moved)) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [selectedProgrammesWithTasks]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isLoading = programmesLoading || (selectedIds.length > 0 && taskResults.isLoading);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-compare-title">
          Compare Programmes
        </h1>
        <p className="text-muted-foreground">
          Compare Contract & Key Dates milestones across programmes to track date movements
        </p>
      </div>

      <Card data-testid="card-programme-selection">
        <CardHeader>
          <CardTitle>Select Programmes</CardTitle>
          <CardDescription>Choose programmes to compare their Contract & Key Dates milestones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} programme{selectedIds.length !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allProgrammes && allProgrammes.length > 0 ? (
              allProgrammes.map((programme) => (
                <div
                  key={programme.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => selectedIds.length < 5 && toggleSelection(programme.id)}
                  data-testid={`checkbox-programme-${programme.id}`}
                >
                  <Checkbox
                    checked={selectedIds.includes(programme.id)}
                    disabled={!selectedIds.includes(programme.id) && selectedIds.length >= 5}
                    onCheckedChange={() => toggleSelection(programme.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {programme.name}
                    </p>
                    {programme.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {programme.description}
                      </p>
                    )}
                  </div>
                  {programme.statusDate && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDateUK(programme.statusDate)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No programmes available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedProgrammesWithTasks.length > 0 && !isLoading && (
        <Card data-testid="card-comparison-table">
          <CardHeader>
            <CardTitle>Contract & Key Dates Milestone Comparison</CardTitle>
            <CardDescription>
              Comparing {selectedProgrammesWithTasks.length} programme{selectedProgrammesWithTasks.length !== 1 ? "s" : ""}
              {contractKeyDatesMilestones.length === 0 && " - No Contract & Key Dates milestones found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contractKeyDatesMilestones.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Milestone</TableHead>
                      {selectedProgrammesWithTasks.map((progWithTasks) => (
                        <TableHead key={progWithTasks.programme.id} data-testid={`header-programme-${progWithTasks.programme.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-[150px]">{progWithTasks.programme.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4"
                              onClick={() => toggleSelection(progWithTasks.programme.id)}
                              data-testid={`button-remove-${progWithTasks.programme.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractKeyDatesMilestones.map((milestone, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium max-w-xs">
                          <div className="flex items-center gap-2">
                            {milestone.data.some(d => d.moved) && (
                              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" data-testid={`icon-moved-${idx}`} />
                            )}
                            <span>{milestone.name}</span>
                          </div>
                        </TableCell>
                        {milestone.data.map((dateData, dateIdx) => (
                          <TableCell 
                            key={`${idx}-${dateIdx}`}
                            className={dateData.moved ? "bg-amber-50 dark:bg-amber-950" : ""}
                            data-testid={`cell-milestone-${idx}-${dateIdx}`}
                          >
                            <div className="space-y-1">
                              {dateData.actualDate ? (
                                <div className={dateData.moved ? "font-semibold text-amber-900 dark:text-amber-100" : ""}>
                                  <div className="text-xs text-muted-foreground">Actual:</div>
                                  <div>{formatDateUK(dateData.actualDate)}</div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground italic">Actual: -</div>
                              )}
                              {dateData.plannedDate ? (
                                <div className="text-muted-foreground">
                                  <div className="text-xs">Planned:</div>
                                  <div className="text-sm">{formatDateUK(dateData.plannedDate)}</div>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground italic">Planned: -</div>
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No Contract & Key Dates milestones found in selected programmes</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
