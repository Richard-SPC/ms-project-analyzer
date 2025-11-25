import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type Project, type DcmaAssessment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, PlayCircle, CheckCircle2, XCircle, AlertCircle, Loader2, Save, FolderKanban } from "lucide-react";

const dcmaCriteria = [
  { 
    key: "missingLogic", 
    label: "1. Missing Logic",
    description: "All activities (except start/finish milestones) must have at least one predecessor and one successor relationship.",
    details: "Ensures schedule logic flow is complete with no 'dangling' activities. Activities without predecessors may start too early; activities without successors may not drive the end date. Industry standard: ≤5% of total activities may lack logic.",
    threshold: "≤5% of activities missing predecessors/successors"
  },
  { 
    key: "negativeLag", 
    label: "2. Negative Lag",
    description: "Negative lag relationships (leads) should be eliminated entirely - zero tolerance policy.",
    details: "Negative lags are mathematically equivalent to leads but can indicate unrealistic assumptions about task overlap or parallel work. They often hide poor planning or overly optimistic estimates. Industry best practice is to eliminate them entirely.",
    threshold: "0% of relationships with negative lags"
  },
  { 
    key: "leadsLags", 
    label: "3. Leads & Lags",
    description: "Lead and lag durations on dependencies should be minimal, justified, and properly documented.",
    details: "Excessive leads/lags can mask scheduling issues or create unrealistic dependencies. Leads allow successors to start before predecessors finish; lags delay the start of successors. Best practice: ≤5% of relationships should have leads/lags.",
    threshold: "≤5% of relationships with leads/lags"
  },
  { 
    key: "relationshipTypes", 
    label: "4. Relationship Type",
    description: "Finish-to-Start (FS) should be the predominant relationship type throughout the schedule.",
    details: "Industry best practice dictates that ≥90% of all task relationships should be Finish-to-Start (FS). Other relationship types (SS, FF, SF) should be used sparingly and only when logically necessary. Overuse of non-FS relationships can indicate poor schedule logic or unnecessary complexity.",
    threshold: "≥90% of relationships are Finish-to-Start (FS)"
  },
  { 
    key: "hardConstraints", 
    label: "5. Hard Constraints",
    description: "Minimize use of hard constraints (Must Start On, Must Finish On, Start No Later Than, Finish No Later Than).",
    details: "Hard constraints override logic-driven scheduling and reduce schedule flexibility. They prevent the schedule from responding dynamically to changes. Acceptable constraints include project start/finish and externally imposed milestones.",
    threshold: "≤1% of activities with hard constraints"
  },
  { 
    key: "largeFloat", 
    label: "6. Large Float",
    description: "Activities with excessive total float (slack time) should be reviewed for logic errors or improper constraints.",
    details: "Tasks with >44 days of float may indicate missing logic relationships, incorrect calendars, or activities not properly integrated into the schedule network. High float can also indicate tasks that don't drive project completion.",
    threshold: "≤5% of activities with float >44 days"
  },
  { 
    key: "negativeFloat", 
    label: "7. Negative Float",
    description: "No activities should have negative total float - indicates tasks are behind schedule.",
    details: "Negative float indicates that tasks are running behind schedule and the project completion date is at risk. This occurs when task dates are pushed beyond their late finish dates. All tasks with negative float require immediate attention and corrective action.",
    threshold: "0% of activities with negative float"
  },
  { 
    key: "largeDurations", 
    label: "8. Large Durations",
    description: "Activities should not have excessively long durations that prevent meaningful status tracking.",
    details: "Tasks longer than 44 working days (approximately 2 months) are difficult to track accurately and may hide problems. Long-duration tasks should be broken into smaller, measurable work packages. Exceptions may include level-of-effort activities.",
    threshold: "≤5% of activities with duration >44 days"
  },
  { 
    key: "invalidTasks", 
    label: "9. Invalid Tasks",
    description: "All activity dates should be realistic, fall within the project timeline, and use proper calendars.",
    details: "Checks for activities with dates outside the project start/finish window, weekend/holiday work on non-working calendars, or illogical sequences. Invalid dates often indicate data entry errors or calendar misconfigurations.",
    threshold: "0% of activities with invalid dates"
  },
  { 
    key: "resourcesAssigned", 
    label: "10. Resource & Costs Assigned",
    description: "All activities should have resources (labor, equipment, materials) assigned to enable resource analysis.",
    details: "Resource assignments enable resource loading analysis, identification of over-allocation, and cost tracking. Activities without resources cannot be analyzed for resource conflicts. Industry standard: ≥95% of activities should have resource assignments.",
    threshold: "≥95% of activities with resources assigned"
  },
  { 
    key: "lateTasks", 
    label: "11. Late Tasks",
    description: "Activities scheduled in the past should be 100% complete or have valid explanations for delays.",
    details: "Incomplete tasks with finish dates in the past indicate schedule slippage and require corrective action. The schedule must accurately reflect current project status. Missed tasks affect critical path validity and forecast accuracy.",
    threshold: "≤5% of past-due activities incomplete"
  },
  { 
    key: "criticalPathTest", 
    label: "12. Critical Path Test",
    description: "Verify that a valid critical path exists and is properly identified throughout the schedule network.",
    details: "The critical path defines the longest sequence of dependent activities driving project completion. The longest path test ensures the critical path is properly calculated with no logic breaks. Critical path should be continuous from project start to finish.",
    threshold: "Continuous critical path from start to finish"
  },
  { 
    key: "criticalPathLength", 
    label: "13. Critical Path Length",
    description: "The critical path duration should be reasonable and consistent with project scope and constraints.",
    details: "Validates that the critical path length aligns with contract milestones, project objectives, and historical performance data. An unrealistically short critical path may indicate overly optimistic planning; an excessively long path suggests inefficient planning.",
    threshold: "Critical path aligns with contract milestones ±10%"
  },
  { 
    key: "baselineExecutionIndex", 
    label: "14. Baseline Execution Index",
    description: "A performance measurement baseline must exist for schedule variance analysis and earned value management.",
    details: "The baseline schedule represents the approved plan against which progress is measured. Without a baseline, schedule variance analysis and trend forecasting are impossible. Baseline should be established before work begins and maintained throughout the project.",
    threshold: "Baseline exists and is properly maintained"
  },
];

interface AnalysisResult {
  missingLogic: boolean;
  negativeLag: boolean;
  leadsLags: boolean;
  relationshipTypes: boolean;
  hardConstraints: boolean;
  largeFloat: boolean;
  negativeFloat: boolean;
  largeDurations: boolean;
  invalidTasks: boolean;
  resourcesAssigned: boolean;
  lateTasks: boolean;
  criticalPathTest: boolean;
  criticalPathLength: boolean;
  baselineExecutionIndex: boolean;
  overallScore: number;
  passed: boolean;
  findings: {
    [key: string]: {
      passed: boolean;
      details: string;
      count?: number;
      percentage?: number;
      failedTasks?: Array<{
        id: number | string;
        name: string;
        reason?: string;
      }>;
    };
  };
}

export default function DcmaAssessment() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedAssessment, setExpandedAssessment] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: assessments, isLoading } = useQuery<DcmaAssessment[]>({
    queryKey: ["/api/dcma-assessments"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await fetch(`/api/projects/${projectId}/dcma-analysis`);
      if (!res.ok) throw new Error("Failed to run analysis");
      return await res.json();
    },
    onSuccess: (data: AnalysisResult, projectId: number) => {
      setAnalysisResult(data);
      setSelectedProject(projectId);
      setSaveDialogOpen(true);
      toast({
        title: "Analysis complete",
        description: `Score: ${data.overallScore}/14 - ${data.passed ? 'PASSED' : 'FAILED'}`,
        variant: data.passed ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysisResult || !selectedProject) return;
      
      const res = await apiRequest("POST", "/api/dcma-assessments", {
        projectId: selectedProject,
        ...analysisResult,
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dcma-assessments"] });
      setSaveDialogOpen(false);
      setAnalysisResult(null);
      setNotes("");
      toast({
        title: "Assessment saved",
        description: "DCMA assessment has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-dcma-title">DCMA 14-Point Assessment</h1>
        <p className="text-muted-foreground">Automated schedule health and quality analysis</p>
      </div>

      {/* Run Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle>Run Automated Analysis</CardTitle>
          <CardDescription>Select a project to automatically analyze against DCMA 14-point criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects?.map((project) => (
              <Card key={project.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FolderKanban className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{project.name}</CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Status Date</p>
                        <p className="font-medium text-foreground">
                          {project.statusDate ? formatDateUK(project.statusDate) : "N/A"}
                        </p>
                      </div>
                      <Button
                        onClick={() => analysisMutation.mutate(project.id)}
                        disabled={analysisMutation.isPending}
                        size="sm"
                        data-testid={`button-analyze-${project.id}`}
                      >
                        {analysisMutation.isPending && analysisMutation.variables === project.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Run Analysis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Previous Assessments */}
      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : assessments && assessments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Previous Assessments</h2>
          <div className="grid gap-4">
            {assessments.map((assessment) => {
              const project = projects?.find(p => p.id === assessment.projectId);
              return (
                <Card key={assessment.id} data-testid={`card-assessment-${assessment.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileCheck className="h-5 w-5" />
                          {project?.name || `Project ${assessment.projectId}`}
                        </CardTitle>
                        <CardDescription>
                          Assessed on {formatDateUK(assessment.assessmentDate)}
                          {project?.statusDate && (
                            <span> • Status Date: {formatDateUK(project.statusDate)}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{assessment.overallScore}/14</div>
                        {assessment.passed ? (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Passed
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-destructive">
                            <XCircle className="h-4 w-4" />
                            Failed
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {dcmaCriteria.map((criterion) => {
                        const value = assessment[criterion.key as keyof DcmaAssessment];
                        return (
                          <div
                            key={criterion.key}
                            className="flex items-center gap-2 text-sm"
                            data-testid={`criterion-${criterion.key}`}
                          >
                            {value ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="text-xs">{criterion.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <Accordion 
                      type="single" 
                      collapsible 
                      className="mt-4"
                      onValueChange={(value) => {
                        // When accordion opens (value = "details"), set this assessment as expanded
                        // When it closes (value = ""), only clear if this was the expanded one
                        if (value === "details") {
                          setExpandedAssessment(assessment.id);
                        } else if (expandedAssessment === assessment.id) {
                          setExpandedAssessment(null);
                        }
                      }}
                    >
                      <AssessmentDetailView 
                        assessment={assessment} 
                        isExpanded={expandedAssessment === assessment.id}
                      />
                    </Accordion>

                    {assessment.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Notes:</p>
                        <p className="text-sm mt-1">{assessment.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Save Analysis Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analysis Results</DialogTitle>
            <DialogDescription>
              Review the automated DCMA analysis results and save to project history
            </DialogDescription>
          </DialogHeader>
          
          {analysisResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md">
                <div>
                  <div className="text-2xl font-bold">Score: {analysisResult.overallScore}/14</div>
                  <div className="text-sm text-muted-foreground">
                    {analysisResult.passed ? 'PASSED (≥10 required)' : 'FAILED (<10)'}
                  </div>
                </div>
                {analysisResult.passed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-8 w-8" />
                    <span className="text-lg font-semibold">Passed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-8 w-8" />
                    <span className="text-lg font-semibold">Failed</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Detailed Findings:</h3>
                {dcmaCriteria.map((criterion) => {
                  const value = analysisResult[criterion.key as keyof AnalysisResult];
                  const finding = analysisResult.findings[criterion.key];
                  
                  return (
                    <div key={criterion.key} className="border-l-2 pl-3 py-2" 
                         style={{ borderColor: value ? '#16a34a' : '#ef4444' }}>
                      <div className="flex items-start gap-2">
                        {value ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{criterion.label}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {finding?.details || "No detailed findings available"}
                          </p>
                          
                          {finding?.failedTasks && finding.failedTasks.length > 0 && (
                            <Accordion type="single" collapsible className="mt-2">
                              <AccordionItem value="tasks" className="border-0">
                                <AccordionTrigger className="text-xs py-1 hover:no-underline">
                                  <span className="text-destructive font-medium">
                                    View {finding.failedTasks.length} affected task{finding.failedTasks.length !== 1 ? 's' : ''}
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                    {finding.failedTasks.map((task: any) => (
                                      <div key={task.id} className="text-xs p-2 bg-muted/30 rounded border-l-2 border-destructive/30">
                                        <div className="font-medium">
                                          <span className="text-muted-foreground">[ID {task.id}]</span> {task.name}
                                        </div>
                                        {task.reason && (
                                          <div className="text-muted-foreground mt-0.5">{task.reason}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any observations or comments about this assessment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Assessment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssessmentDetailView({ assessment, isExpanded }: { assessment: DcmaAssessment; isExpanded: boolean }) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [overrideNotes, setOverrideNotes] = useState(assessment.notes || "");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch detailed analysis for this assessment's project - ONLY when accordion is expanded
  const { data: detailedAnalysis, isLoading: isLoadingAnalysis } = useQuery<AnalysisResult>({
    queryKey: ["/api/projects", assessment.projectId, "dcma-analysis"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${assessment.projectId}/dcma-analysis`);
      if (!res.ok) throw new Error("Failed to fetch analysis details");
      return await res.json();
    },
    enabled: isExpanded, // Only fetch when accordion is expanded
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid refetching on re-expand
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async (data: { overrides: Record<string, boolean>; notes?: string }) => {
      return apiRequest(
        "PATCH",
        `/api/dcma-assessments/${assessment.id}`,
        { ...data.overrides, notes: data.notes || assessment.notes }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dcma-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", assessment.projectId, "dcma-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", assessment.projectId, "dcma-analysis"] });
      toast({
        title: "Overrides Saved",
        description: "Manual overrides have been applied and the score has been recalculated.",
      });
      setHasChanges(false);
    },
    onError: (error) => {
      toast({
        title: "Error Saving Overrides",
        description: error instanceof Error ? error.message : "Failed to save manual overrides",
        variant: "destructive",
      });
    },
  });

  const handleOverrideChange = (criterionKey: string, checked: boolean) => {
    const overrideKey = `${criterionKey}Override`;
    setOverrides((prev) => ({ ...prev, [overrideKey]: checked }));
    setHasChanges(true);
  };

  const handleSaveOverrides = () => {
    updateOverrideMutation.mutate({ overrides, notes: overrideNotes });
  };

  if (isLoadingAnalysis) {
    return (
      <AccordionItem value="details">
        <AccordionTrigger className="text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            View Detailed Analysis & Manual Overrides
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <AccordionItem value="details">
      <AccordionTrigger className="text-sm font-medium">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          View Detailed Analysis & Manual Overrides
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-6 pt-2">
          {/* Warning Banner */}
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Manual Override Guidance
            </p>
            <p>
              Manual overrides allow you to mark failed checks as passing when you have verified compliance through alternative means
              or have business justification. Please provide detailed notes explaining why each override is necessary.
            </p>
          </div>

          {/* Criteria Details with Task Breakdowns and Overrides */}
          <div className="space-y-4">
            {dcmaCriteria.map((criterion) => {
              const savedValue = assessment[criterion.key as keyof DcmaAssessment] as boolean;
              const overrideKey = `${criterion.key}Override` as keyof DcmaAssessment;
              const isOverridden = assessment[overrideKey] as boolean;
              const currentOverride = overrides[overrideKey] ?? isOverridden;
              const finding = detailedAnalysis?.findings[criterion.key];
              
              // Determine display state (considering overrides)
              const effectivePass = savedValue || isOverridden;

              return (
                <div key={criterion.key} className="border rounded-md p-4 space-y-3">
                  {/* Criterion Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      {effectivePass ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">{criterion.label}</h4>
                        {isOverridden && (
                          <span className="inline-block mt-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                            Manual Override Active
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Target: {criterion.threshold}
                        </p>
                      </div>
                    </div>

                    {/* Override Checkbox (only show for failed checks) */}
                    {!savedValue && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`override-${criterion.key}`}
                          checked={currentOverride}
                          onCheckedChange={(checked) => handleOverrideChange(criterion.key, checked as boolean)}
                          data-testid={`checkbox-override-${criterion.key}`}
                        />
                        <Label
                          htmlFor={`override-${criterion.key}`}
                          className="text-xs font-medium cursor-pointer whitespace-nowrap"
                        >
                          Override
                        </Label>
                      </div>
                    )}
                  </div>

                  {/* Detailed Finding */}
                  <div className="ml-7 bg-muted/30 rounded-md px-3 py-2 text-xs">
                    <p className="text-muted-foreground">
                      {finding?.details || "Analysis details not available"}
                    </p>
                  </div>

                  {/* Failed Tasks Breakdown */}
                  {finding?.failedTasks && finding.failedTasks.length > 0 && (
                    <div className="ml-7">
                      <Accordion type="single" collapsible>
                        <AccordionItem value="tasks" className="border-0">
                          <AccordionTrigger className="text-xs py-1 hover:no-underline">
                            <span className="text-destructive font-medium">
                              View {finding.failedTasks.length} affected task{finding.failedTasks.length !== 1 ? 's' : ''}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                              {finding.failedTasks.map((task: any) => (
                                <div key={task.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-destructive/40">
                                  <div className="font-medium">
                                    <span className="text-muted-foreground">[ID {task.id}]</span> {task.name}
                                  </div>
                                  {task.reason && (
                                    <div className="text-muted-foreground mt-0.5">{task.reason}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Override Justification */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="override-notes" className="text-sm font-medium">
              Justification for Overrides
            </Label>
            <Textarea
              id="override-notes"
              placeholder="Explain why these manual overrides are necessary and document any alternative verification methods used..."
              value={overrideNotes}
              onChange={(e) => {
                setOverrideNotes(e.target.value);
                setHasChanges(true);
              }}
              rows={4}
              data-testid="textarea-override-notes"
            />
          </div>

          {/* Save/Reset Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOverrides({});
                setOverrideNotes(assessment.notes || "");
                setHasChanges(false);
              }}
              disabled={!hasChanges}
              data-testid="button-reset-overrides"
            >
              Reset
            </Button>
            <Button
              onClick={handleSaveOverrides}
              disabled={updateOverrideMutation.isPending || !hasChanges}
              data-testid="button-save-overrides"
            >
              {updateOverrideMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Overrides
                </>
              )}
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
