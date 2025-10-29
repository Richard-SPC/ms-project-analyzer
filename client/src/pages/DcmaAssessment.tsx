import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDcmaAssessmentSchema, type Project, type DcmaAssessment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";

const formSchema = insertDcmaAssessmentSchema.extend({
  projectId: z.number().min(1, "Project is required"),
});

type FormData = z.infer<typeof formSchema>;

const dcmaCriteria = [
  { key: "logicComplete", label: "1. Logic is complete" },
  { key: "leadLagsValid", label: "2. Leads & lags are valid" },
  { key: "hardConstraintsValid", label: "3. Hard constraints are valid" },
  { key: "negativeLagsValid", label: "4. Negative lags are valid" },
  { key: "highDurationValid", label: "5. High duration activities are valid" },
  { key: "invalidDatesValid", label: "6. Invalid dates are valid" },
  { key: "resourcesAssigned", label: "7. Resources are assigned" },
  { key: "missedTasksValid", label: "8. Missed tasks are valid" },
  { key: "highFloatValid", label: "9. High float tasks are valid" },
  { key: "criticalPathTest", label: "10. Critical path test" },
  { key: "criticalPathLength", label: "11. Critical path length is valid" },
  { key: "baselineExists", label: "12. Baseline exists" },
  { key: "sviBvValid", label: "13. SVI/BV is valid" },
  { key: "bcwsValid", label: "14. BCWS is valid" },
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
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {criterion.label}
                            </FormLabel>
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
