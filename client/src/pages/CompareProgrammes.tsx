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

  // Extract Contract & Key Dates milestones grouped by subsection
  const contractKeyDatesMilestones = useMemo(() => {
    if (selectedProgrammesWithTasks.length === 0) return [];

    // Store both milestones and their subsection info
    const allMilestonesWithSection = new Map<string, { section: string; wbsCode: string; set: Set<number> }>();
    const contractSummaryWbsCodes = new Map<number, string>();
    
    selectedProgrammesWithTasks.forEach((progWithTasks) => {
      // Look for Contract & Key Dates summary
      let contractSummary = progWithTasks.tasks.find(
        t => t.isSummary && t.name.toLowerCase().includes("contract") && t.name.toLowerCase().includes("key")
      );
      
      if (!contractSummary) {
        contractSummary = progWithTasks.tasks.find(
          t => t.isSummary && t.wbsCode === "1"
        );
      }
      
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
        
        // Find subsection summaries under main summary
        const subsections = progWithTasks.tasks.filter(
          t => t.isSummary && 
               t.wbsCode && 
               t.wbsCode.startsWith(contractSummary.wbsCode || "") &&
               t.id !== contractSummary.id
        );

        // Get all milestones under this summary
        const allTasksUnderSummary = progWithTasks.tasks.filter(
          t => t.wbsCode && 
               t.wbsCode.startsWith(contractSummary!.wbsCode || "") &&
               t.id !== contractSummary.id &&
               (t.isMilestone || t.name.toLowerCase().includes("date"))
        );

        allTasksUnderSummary.forEach(m => {
          // Find which subsection this milestone belongs to
          let subsectionName = "Contract & Key Dates";
          let subsectionWbs = "";
          
          for (const subsection of subsections) {
            if (m.wbsCode && m.wbsCode.startsWith(subsection.wbsCode || "") && m.id !== subsection.id) {
              subsectionName = subsection.name;
              subsectionWbs = subsection.wbsCode || "";
              break;
            }
          }

          const key = `${subsectionName}:::${m.name}`;
          if (!allMilestonesWithSection.has(key)) {
            allMilestonesWithSection.set(key, { section: subsectionName, wbsCode: subsectionWbs, set: new Set() });
          }
          allMilestonesWithSection.get(key)!.set.add(progWithTasks.programme.id);
        });
      }
    });

    // Create comparison data grouped by section
    const groupedMilestones: Array<{
      section: string;
      isHeader: boolean;
      name: string;
      data: Array<{ progId: number; date: Date | null; moved: boolean }>;
    }> = [];

    const processedSections = new Set<string>();

    allMilestonesWithSection.forEach((sectionInfo, key) => {
      const [sectionName, milestoneName] = key.split(":::") as [string, string];
      
      // Add section header if not already added
      if (!processedSections.has(sectionName)) {
        groupedMilestones.push({
          section: sectionName,
          isHeader: true,
          name: sectionName,
          data: [],
        });
        processedSections.add(sectionName);
      }

      const dates: Array<{ progId: number; date: Date | null }> = [];
      
      selectedProgrammesWithTasks.forEach((progWithTasks) => {
        const wbsCodePrefix = contractSummaryWbsCodes.get(progWithTasks.programme.id);
        
        if (wbsCodePrefix) {
          const milestone = progWithTasks.tasks.find(
            t => t.name === milestoneName &&
                t.wbsCode && 
                t.wbsCode.startsWith(wbsCodePrefix)
          );
          dates.push({
            progId: progWithTasks.programme.id,
            date: milestone?.startDate || milestone?.endDate || null,
          });
        } else {
          dates.push({
            progId: progWithTasks.programme.id,
            date: null,
          });
        }
      });

      // Check if dates have moved
      const validDates = dates
        .filter(d => d.date)
        .map(d => {
          const date = typeof d.date === 'string' ? new Date(d.date) : d.date;
          return date?.getTime?.() || 0;
        });
      const moved = validDates.length > 0 && new Set(validDates).size > 1;

      groupedMilestones.push({
        section: sectionName,
        isHeader: false,
        name: milestoneName,
        data: dates.map(d => ({
          progId: d.progId,
          date: d.date,
          moved,
        })),
      });
    });

    return groupedMilestones.sort((a, b) => {
      // Sort by section first, then show moved items first, then by name
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      if (a.isHeader) return -1;
      if (b.isHeader) return 1;
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
                      <TableRow key={idx} className={milestone.isHeader ? "bg-muted hover:bg-muted" : ""}>
                        <TableCell className={milestone.isHeader ? "font-bold text-foreground py-3" : "font-medium max-w-xs"}>
                          <div className="flex items-center gap-2">
                            {!milestone.isHeader && milestone.data.some(d => d.moved) && (
                              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" data-testid={`icon-moved-${idx}`} />
                            )}
                            <span className={milestone.isHeader ? "" : "pl-4"}>{milestone.name}</span>
                          </div>
                        </TableCell>
                        {milestone.data.map((dateData, dateIdx) => (
                          <TableCell 
                            key={`${idx}-${dateIdx}`}
                            className={milestone.isHeader ? "bg-muted text-muted-foreground" : dateData.moved ? "bg-amber-50 dark:bg-amber-950" : ""}
                            data-testid={`cell-milestone-${idx}-${dateIdx}`}
                          >
                            {!milestone.isHeader && dateData.date ? (
                              <span className={dateData.moved ? "font-semibold text-amber-900 dark:text-amber-100" : ""}>
                                {formatDateUK(dateData.date)}
                              </span>
                            ) : !milestone.isHeader ? (
                              <span className="text-muted-foreground italic">-</span>
                            ) : null}
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
