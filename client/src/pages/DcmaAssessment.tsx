import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDcmaAssessmentSchema, type Project, type DcmaAssessment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Plus, CheckCircle2, XCircle, Info, AlertCircle } from "lucide-react";
import { z } from "zod";

const formSchema = insertDcmaAssessmentSchema.extend({
  projectId: z.number().min(1, "Project is required"),
});

type FormData = z.infer<typeof formSchema>;

const dcmaCriteria = [
  { 
    key: "logicComplete", 
    label: "1. Logic is complete",
    description: "All activities (except start/finish milestones) must have at least one predecessor and one successor relationship.",
    details: "Ensures schedule logic flow is complete with no 'dangling' activities. Activities without predecessors may start too early; activities without successors may not drive the end date. Industry standard: ≤5% of total activities may lack logic.",
    threshold: "≤5% of activities missing predecessors/successors"
  },
  { 
    key: "leadLagsValid", 
    label: "2. Leads & lags are valid",
    description: "Lead and lag durations on dependencies should be minimal, justified, and properly documented.",
    details: "Excessive leads/lags can mask scheduling issues or create unrealistic dependencies. Leads allow successors to start before predecessors finish; lags delay the start of successors. Best practice: ≤10% of relationships should have leads/lags.",
    threshold: "≤10% of relationships with leads/lags"
  },
  { 
    key: "hardConstraintsValid", 
    label: "3. Hard constraints are valid",
    description: "Minimize use of hard date constraints (Must Start On, Must Finish On, Start No Earlier Than, etc.).",
    details: "Hard constraints override logic-driven scheduling and reduce schedule flexibility. They prevent the schedule from responding dynamically to changes. Acceptable constraints include project start/finish and externally imposed milestones.",
    threshold: "≤5% of activities with hard constraints"
  },
  { 
    key: "negativeLagsValid", 
    label: "4. Negative lags are valid",
    description: "Negative lag relationships (leads) should be minimized and properly justified with documentation.",
    details: "Negative lags are mathematically equivalent to leads but can indicate unrealistic assumptions about task overlap or parallel work. They often hide poor planning or overly optimistic estimates. Industry best practice is to eliminate them entirely.",
    threshold: "0% of relationships with negative lags (ideal)"
  },
  { 
    key: "highDurationValid", 
    label: "5. High duration activities are valid",
    description: "Activities should not have excessively long durations that prevent meaningful status tracking.",
    details: "Tasks longer than 44 working days (approximately 2 months) are difficult to track accurately and may hide problems. Long-duration tasks should be broken into smaller, measurable work packages. Exceptions may include level-of-effort activities.",
    threshold: "≤5% of activities with duration >44 days"
  },
  { 
    key: "invalidDatesValid", 
    label: "6. Invalid dates are valid",
    description: "All activity dates should be realistic, fall within the project timeline, and use proper calendars.",
    details: "Checks for activities with dates outside the project start/finish window, weekend/holiday work on non-working calendars, or illogical sequences. Invalid dates often indicate data entry errors or calendar misconfigurations.",
    threshold: "0% of activities with invalid dates"
  },
  { 
    key: "resourcesAssigned", 
    label: "7. Resources are assigned",
    description: "All activities should have resources (labor, equipment, materials) assigned to enable resource analysis.",
    details: "Resource assignments enable resource loading analysis, identification of over-allocation, and cost tracking. Activities without resources cannot be analyzed for resource conflicts. Industry standard: ≥95% of activities should have resource assignments.",
    threshold: "≥95% of activities with resources assigned"
  },
  { 
    key: "missedTasksValid", 
    label: "8. Missed tasks are valid",
    description: "Activities scheduled in the past should be 100% complete or have valid explanations for delays.",
    details: "Incomplete tasks with finish dates in the past indicate schedule slippage and require corrective action. The schedule must accurately reflect current project status. Missed tasks affect critical path validity and forecast accuracy.",
    threshold: "≤5% of past-due activities incomplete"
  },
  { 
    key: "highFloatValid", 
    label: "9. High float tasks are valid",
    description: "Activities with excessive total float (slack time) should be reviewed for logic errors or improper constraints.",
    details: "Tasks with >44 days of float may indicate missing logic relationships, incorrect calendars, or activities not properly integrated into the schedule network. High float can also indicate tasks that don't drive project completion.",
    threshold: "≤5% of activities with float >44 days"
  },
  { 
    key: "criticalPathTest", 
    label: "10. Critical path test",
    description: "Verify that a valid critical path exists and is properly identified throughout the schedule network.",
    details: "The critical path defines the longest sequence of dependent activities driving project completion. The longest path test ensures the critical path is properly calculated with no logic breaks. Critical path should be continuous from project start to finish.",
    threshold: "Continuous critical path from start to finish"
  },
  { 
    key: "criticalPathLength", 
    label: "11. Critical path length is valid",
    description: "The critical path duration should be reasonable and consistent with project scope and constraints.",
    details: "Validates that the critical path length aligns with contract milestones, project objectives, and historical performance data. An unrealistically short critical path may indicate overly optimistic planning; an excessively long path suggests inefficient planning.",
    threshold: "Critical path aligns with contract milestones ±10%"
  },
  { 
    key: "baselineExists", 
    label: "12. Baseline exists",
    description: "A performance measurement baseline must exist for schedule variance analysis and earned value management.",
    details: "The baseline schedule represents the approved plan against which progress is measured. Without a baseline, schedule variance analysis and trend forecasting are impossible. Baseline should be established before work begins and maintained throughout the project.",
    threshold: "Baseline exists and is properly maintained"
  },
  { 
    key: "sviBvValid", 
    label: "13. SVI/BV is valid",
    description: "Schedule Variance Index (SVI) and Budget Variance (BV) should be within acceptable thresholds.",
    details: "SVI measures schedule efficiency (SV/PV). SVI <0.95 indicates behind schedule; >1.0 indicates ahead. BV tracks budget variance. Acceptable range: SVI 0.95-1.05. These metrics are critical for earned value management and forecasting.",
    threshold: "0.95 ≤ SVI ≤ 1.05"
  },
  { 
    key: "bcwsValid", 
    label: "14. BCWS is valid",
    description: "Budgeted Cost of Work Scheduled (BCWS/PV) must be properly configured for earned value calculations.",
    details: "BCWS represents the time-phased budget baseline. It must equal the total project budget (BAC) and align with the schedule. Proper BCWS configuration enables accurate earned value analysis, variance tracking, and forecasting of estimate at completion.",
    threshold: "BCWS = BAC with proper time-phasing"
  },
];

export default function DcmaAssessment() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: assessments, isLoading } = useQuery<DcmaAssessment[]>({
    queryKey: ["/api/dcma-assessments"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: 0,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const criteriaValues = dcmaCriteria.map(c => form.getValues(c.key as keyof FormData));
      const score = criteriaValues.filter(v => v === true).length;
      const passed = score >= 10;

      const res = await apiRequest("POST", "/api/dcma-assessments", {
        ...data,
        overallScore: score,
        passed,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dcma-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Assessment created",
        description: "DCMA 14-point assessment has been completed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dcma-title">DCMA 14-Point Assessment</h1>
          <p className="text-muted-foreground">Schedule health and quality metrics</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-assessment">
              <Plus className="mr-2 h-4 w-4" />
              New Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Run DCMA Assessment</DialogTitle>
              <DialogDescription>Evaluate project schedule quality using 14-point criteria</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <FormLabel>Assessment Criteria</FormLabel>
                  {dcmaCriteria.map((criterion) => (
                    <FormField
                      key={criterion.key}
                      control={form.control}
                      name={criterion.key as keyof FormData}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              data-testid={`checkbox-${criterion.key}`}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none flex-1">
                            <div className="flex items-center gap-2">
                              <FormLabel className="text-sm font-normal cursor-pointer flex-1">
                                {criterion.label}
                              </FormLabel>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-sm">
                                  <p className="font-semibold mb-1">{criterion.label}</p>
                                  <p className="text-sm mb-2">{criterion.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-semibold">Threshold:</span> {criterion.threshold}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional observations or comments"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormDescription>Optional notes about the assessment</FormDescription>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "Saving..." : "Save Assessment"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

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
      ) : assessments && assessments.length > 0 ? (
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
                        Assessed on {new Date(assessment.assessmentDate).toLocaleDateString()}
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
                  
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="details">
                      <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          View Detailed Criteria Information
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {dcmaCriteria.map((criterion) => {
                            const value = assessment[criterion.key as keyof DcmaAssessment];
                            return (
                              <div key={criterion.key} className="border-l-2 pl-3 py-2" 
                                   style={{ borderColor: value ? '#16a34a' : '#ef4444' }}>
                                <div className="flex items-start gap-2 mb-1">
                                  {value ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="flex-1">
                                    <h4 className="text-sm font-semibold">{criterion.label}</h4>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 ml-6">
                                  {criterion.description}
                                </p>
                                <p className="text-xs text-muted-foreground ml-6">
                                  {criterion.details}
                                </p>
                                <div className="mt-2 ml-6 bg-muted/50 rounded-md px-3 py-2">
                                  <p className="text-xs">
                                    <span className="font-semibold">Industry Threshold:</span> {criterion.threshold}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
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
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No assessments yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Run your first DCMA 14-point assessment</p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-first-assessment">
              <Plus className="mr-2 h-4 w-4" />
              New Assessment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
