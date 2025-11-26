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

    // Collect all milestones from all programmes
    const allMilestonesByName = new Map<string, { section: string; name: string }>();
    
    selectedProgrammesWithTasks.forEach((progWithTasks) => {
      // Find the main Contract & Key Dates summary (WBS = 1)
      const mainSummary = progWithTasks.tasks.find(t => t.wbsCode === "1" && t.isSummary);
      
      if (!mainSummary) return;

      // Find all subsections (direct children with isSummary)
      const subsections = progWithTasks.tasks.filter(
        t => t.wbsCode && 
             t.wbsCode.startsWith("1.") &&
             !t.wbsCode.includes("..", "1.".length) &&
             t.isSummary
      );

      // Get all milestones directly under main summary (1.1, 1.2, 1.3, 1.4 - direct children)
      const directMilestones = progWithTasks.tasks.filter(
        t => t.wbsCode && 
             /^1\.\d+$/.test(t.wbsCode) &&  // Matches 1.1, 1.2, 1.3, etc (exactly 3 parts)
             t.isMilestone &&
             !t.isSummary  // Exclude summary tasks
      );

      directMilestones.forEach(m => {
        const key = `1:::${m.name}`;
        if (!allMilestonesByName.has(key)) {
          allMilestonesByName.set(key, { section: "Contract & Key Dates", name: m.name });
        }
      });

      // Get milestones from subsections (1.5.x, 1.6.x, 1.4.x, etc)
      subsections.forEach(subsection => {
        const subsectionChildren = progWithTasks.tasks.filter(
          t => t.wbsCode && 
               t.wbsCode.startsWith(subsection.wbsCode || "") &&
               t.id !== subsection.id &&
               t.isMilestone &&
               !t.isSummary  // Exclude summary tasks
        );

        subsectionChildren.forEach(m => {
          const key = `${subsection.wbsCode}:::${m.name}`;
          if (!allMilestonesByName.has(key)) {
            allMilestonesByName.set(key, { section: subsection.name, name: m.name });
          }
        });
      });
    });

    // Create comparison data grouped by section
    const groupedMilestones: Array<{
      section: string;
      isHeader: boolean;
      name: string;
      data: Array<{ progId: number; date: Date | null; moved: boolean; movementWeeks?: number; movementDays?: number }>;
    }> = [];

    const processedSections = new Set<string>();

    allMilestonesByName.forEach((info, key) => {
      const { section, name } = info;
      
      // Add section header if not already added
      if (!processedSections.has(section)) {
        groupedMilestones.push({
          section,
          isHeader: true,
          name: section,
          data: [],
        });
        processedSections.add(section);
      }

      // Get dates from each programme for this milestone
      const dates: Array<{ progId: number; date: Date | null }> = [];
      
      selectedProgrammesWithTasks.forEach((progWithTasks) => {
        const milestone = progWithTasks.tasks.find(t => t.name === name && t.isMilestone);
        dates.push({
          progId: progWithTasks.programme.id,
          date: milestone?.startDate || milestone?.endDate || null,
        });
      });

      // Check if dates have moved (are different across programmes)
      const validDates = dates
        .filter(d => d.date)
        .map(d => {
          const date = typeof d.date === 'string' ? new Date(d.date) : d.date;
          return date?.getTime?.() || 0;
        });
      const moved = validDates.length > 0 && new Set(validDates).size > 1;

      // Calculate movement between consecutive programmes
      const dataWithMovement = dates.map((d, idx) => {
        let movementWeeks: number | undefined;
        let movementDays: number | undefined;

        if (idx > 0 && d.date && dates[idx - 1].date) {
          const prevDate = typeof dates[idx - 1].date === 'string' ? new Date(dates[idx - 1].date) : dates[idx - 1].date;
          const currDate = typeof d.date === 'string' ? new Date(d.date) : d.date;
          
          if (prevDate && currDate) {
            const diffMs = currDate.getTime() - prevDate.getTime();
            movementDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            movementWeeks = Math.round((movementDays / 5) * 10) / 10; // Round to 1 decimal place
          }
        }

        return {
          progId: d.progId,
          date: d.date,
          moved,
          movementWeeks,
          movementDays,
        };
      });

      groupedMilestones.push({
        section,
        isHeader: false,
        name,
        data: dataWithMovement,
      });
    });

    // Define custom section order
    const sectionOrder = [
      "Contract & Key Dates",
      "Access Dates",
      "Contract Key Dates",
      "Planned Contract Key Dates"
    ];

    return groupedMilestones.sort((a, b) => {
      // Sort by section first using custom order
      const aOrder = sectionOrder.indexOf(a.section);
      const bOrder = sectionOrder.indexOf(b.section);
      if (aOrder !== bOrder) {
        return (aOrder === -1 ? sectionOrder.length : aOrder) - (bOrder === -1 ? sectionOrder.length : bOrder);
      }
      
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
