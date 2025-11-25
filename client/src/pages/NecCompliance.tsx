import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type Project, type NecCompliance } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, PlayCircle, CheckCircle2, XCircle, Loader2, Save } from "lucide-react";

const necCriteria = [
  { 
    key: "programmeDefined", 
    label: "Is there a defined programme?",
    description: "The project must have a defined programme with clear start and end dates, and tasks properly scheduled.",
    details: "A defined programme requires project-level dates and at least 90% of tasks to have start/end dates. This ensures the project has a structured timeline for tracking and management."
  },
  { 
    key: "acceptedProgramme", 
    label: "Has the programme been accepted?",
    description: "The programme must be formally accepted and baselined for performance measurement.",
    details: "Acceptance is indicated by comprehensive baseline coverage. At least 90% of tasks should have start and end dates, demonstrating a formally accepted and baselined programme."
  },
  { 
    key: "regularUpdates", 
    label: "Are regular updates provided?",
    description: "The programme must be regularly updated to reflect actual progress.",
    details: "Regular updates are evidenced by progress tracking on tasks. At least 80% of tasks should have percent complete values tracked, showing active programme management."
  },
  { 
    key: "earlyWarningsManaged", 
    label: "Are early warnings properly managed?",
    description: "Potential issues and risks must be identified and managed through early warnings.",
    details: "Proper management is shown by limited warning indicators such as high float tasks or missed deadlines. No more than 15% of tasks should show warning indicators."
  },
  { 
    key: "compensationEventsTracked", 
    label: "Are compensation events tracked?",
    description: "Compensation events and change impacts must be tracked in the schedule.",
    details: "Tracked through contingency and float in the schedule. For larger projects, at least 5% of tasks should have moderate float indicating planned contingency for compensation events."
  },
  { 
    key: "keyDatesIdentified", 
    label: "Are key dates identified?",
    description: "Important milestones and key dates must be clearly identified in the programme.",
    details: "Key dates are marked as milestones in the schedule. Larger programmes should have at least 3 milestone tasks identifying critical dates."
  },
  { 
    key: "completionDateRealistic", 
    label: "Is the completion date realistic?",
    description: "The planned completion date must be realistic and achievable based on the critical path.",
    details: "Completion date is realistic if the critical path end date aligns with the project end date within 30 days. Large variances indicate unrealistic planning."
  },
  { 
    key: "resourcesAdequate", 
    label: "Are resources adequate?",
    description: "Sufficient resources must be assigned to activities to ensure work can be completed.",
    details: "Resource adequacy is shown by resource assignments on at least 80% of tasks. This enables resource loading analysis and workload management."
  },
];

interface NecAnalysisResult {
  programmeDefined: boolean;
  acceptedProgramme: boolean;
  regularUpdates: boolean;
  earlyWarningsManaged: boolean;
  compensationEventsTracked: boolean;
  keyDatesIdentified: boolean;
  completionDateRealistic: boolean;
  resourcesAdequate: boolean;
  overallCompliant: boolean;
  findings: {
    [key: string]: {
      passed: boolean;
      details: string;
      count?: number;
      percentage?: number;
    };
  };
}

export default function NecCompliance() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<NecAnalysisResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: compliances, isLoading } = useQuery<NecCompliance[]>({
    queryKey: ["/api/nec-compliance"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await fetch(`/api/projects/${projectId}/nec-analysis`);
      if (!res.ok) throw new Error("Failed to run analysis");
      return await res.json();
    },
    onSuccess: (data: NecAnalysisResult, projectId: number) => {
      setAnalysisResult(data);
      setSelectedProject(projectId);
      setSaveDialogOpen(true);
      toast({
        title: "Analysis complete",
        description: data.overallCompliant ? 'COMPLIANT - All criteria passed' : 'NON-COMPLIANT - Some criteria failed',
        variant: data.overallCompliant ? "default" : "destructive",
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
      
      const res = await apiRequest("POST", "/api/nec-compliance", {
        projectId: selectedProject,
        ...analysisResult,
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nec-compliance"] });
      setSaveDialogOpen(false);
      setAnalysisResult(null);
      setNotes("");
      toast({
        title: "Assessment saved",
        description: "NEC compliance assessment has been saved successfully.",
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
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-nec-title">NEC Compliance</h1>
        <p className="text-muted-foreground">Automated contract compliance and programme requirements analysis</p>
      </div>

      {/* Run Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle>Run Automated Analysis</CardTitle>
          <CardDescription>Select a project to automatically analyze against NEC compliance criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {projects?.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`project-card-${project.id}`}
              >
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {project.description || "No description"}
                  </p>
                </div>
                <Button
                  onClick={() => analysisMutation.mutate(project.id)}
                  disabled={analysisMutation.isPending}
                  data-testid={`button-analyze-${project.id}`}
                >
                  {analysisMutation.isPending ? (
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
            ))}
            {!projects || projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No projects available. Create a project first.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-analysis-results">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {analysisResult?.overallCompliant ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
              NEC Compliance Analysis Results
            </DialogTitle>
            <DialogDescription>
              {analysisResult?.overallCompliant
                ? "All NEC criteria passed - Programme is compliant"
                : "Some NEC criteria failed - Programme needs improvement"}
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-4">
              {/* Overall Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Overall Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {analysisResult.overallCompliant ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-8 w-8" />
                          <div>
                            <div className="font-bold text-xl">COMPLIANT</div>
                            <div className="text-sm">All criteria passed</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-8 w-8" />
                          <div>
                            <div className="font-bold text-xl">NON-COMPLIANT</div>
                            <div className="text-sm">Some criteria require attention</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Findings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detailed Findings</CardTitle>
                  <CardDescription>Analysis results for each NEC criterion</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {necCriteria.map((criterion) => {
                      const finding = analysisResult.findings[criterion.key];
                      const passed = finding?.passed ?? false;
                      
                      return (
                        <AccordionItem key={criterion.key} value={criterion.key}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 text-left">
                              {passed ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-semibold">{criterion.label}</div>
                                <div className="text-sm text-muted-foreground">{criterion.description}</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-8 space-y-2">
                              <div className="p-3 bg-muted rounded-md">
                                <p className="text-sm font-medium mb-1">Analysis Result:</p>
                                <p className="text-sm">{finding?.details || "No details available"}</p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p className="font-medium mb-1">Criterion Details:</p>
                                <p>{criterion.details}</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Notes Section */}
              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Assessment Notes (Optional)
                </label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional observations or comments about this compliance assessment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-notes"
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSaveDialogOpen(false)}
              data-testid="button-cancel"
            >
              Close
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-assessment"
            >
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

      {/* Previous Assessments */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Previous Assessments</h2>
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
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
        ) : compliances && compliances.length > 0 ? (
          <div className="grid gap-4">
            {compliances.map((compliance) => {
              const project = projects?.find(p => p.id === compliance.projectId);
              return (
                <Card key={compliance.id} data-testid={`card-compliance-${compliance.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          {project?.name || `Project ${compliance.projectId}`}
                        </CardTitle>
                        <CardDescription>
                          Assessed on {formatDateUK(compliance.assessmentDate)}
                        </CardDescription>
                      </div>
                      <div>
                        {compliance.overallCompliant ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-semibold">Compliant</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-destructive">
                            <XCircle className="h-5 w-5" />
                            <span className="font-semibold">Non-compliant</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-3">
                      {necCriteria.map((criterion) => {
                        const value = compliance[criterion.key as keyof NecCompliance];
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
                            <span className="text-sm">{criterion.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {compliance.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Notes:</p>
                        <p className="text-sm mt-1">{compliance.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assessments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Run your first automated NEC compliance analysis</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
