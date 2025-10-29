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
import { insertNecComplianceSchema, type Project, type NecCompliance } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";

const formSchema = insertNecComplianceSchema.extend({
  projectId: z.number().min(1, "Project is required"),
});

type FormData = z.infer<typeof formSchema>;

const necCriteria = [
  { key: "programmeDefined", label: "Is there a defined programme?" },
  { key: "acceptedProgramme", label: "Has the programme been accepted?" },
  { key: "regularUpdates", label: "Are regular updates provided?" },
  { key: "earlyWarningsManaged", label: "Are early warnings properly managed?" },
  { key: "compensationEventsTracked", label: "Are compensation events tracked?" },
  { key: "keyDatesIdentified", label: "Are key dates identified?" },
  { key: "completionDateRealistic", label: "Is the completion date realistic?" },
  { key: "resourcesAdequate", label: "Are resources adequate?" },
];

export default function NecCompliance() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: compliances, isLoading } = useQuery<NecCompliance[]>({
    queryKey: ["/api/nec-compliance"],
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
      const criteriaValues = necCriteria.map(c => form.getValues(c.key as keyof FormData));
      const allPassed = criteriaValues.every(v => v === true);

      const res = await apiRequest("POST", "/api/nec-compliance", {
        ...data,
        overallCompliant: allPassed,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nec-compliance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Compliance check created",
        description: "NEC compliance assessment has been completed.",
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
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-nec-title">NEC Compliance</h1>
          <p className="text-muted-foreground">Contract compliance and programme requirements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-compliance">
              <Plus className="mr-2 h-4 w-4" />
              New Check
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Run NEC Compliance Check</DialogTitle>
              <DialogDescription>Assess programme compliance with NEC contract requirements</DialogDescription>
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
                  <FormLabel>NEC Compliance Criteria</FormLabel>
                  {necCriteria.map((criterion) => (
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
                      <FormDescription>Optional notes about the compliance check</FormDescription>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending ? "Saving..." : "Save Compliance Check"}
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
                        Checked on {new Date(compliance.assessmentDate).toLocaleDateString()}
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
            <h3 className="text-lg font-semibold mb-2">No compliance checks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Run your first NEC compliance check</p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-first-compliance">
              <Plus className="mr-2 h-4 w-4" />
              New Check
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
