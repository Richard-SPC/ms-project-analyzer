import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCalendarExceptionSchema, type CalendarException } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK, calculateWorkingDays } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";

const formSchema = insertCalendarExceptionSchema.extend({
  name: z.string().min(1, "Name is required"),
  startDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? (val ? new Date(val) : undefined) : val
  ),
  endDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? (val ? new Date(val) : undefined) : val
  ),
});

type FormData = z.infer<typeof formSchema>;

export default function Exceptions({ projectId }: { projectId: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: exceptions, isLoading } = useQuery<CalendarException[]>({
    queryKey: [`/api/projects/${projectId}/exceptions`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<FormData, "projectId">) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/exceptions`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/exceptions`] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Exception added",
        description: "Holiday or non-working day has been added.",
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/exceptions/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/exceptions`] });
      toast({
        title: "Exception deleted",
        description: "Holiday or non-working day has been removed.",
      });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      startDate: undefined,
      endDate: undefined,
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({ 
      name: data.name, 
      startDate: data.startDate,
      endDate: data.endDate,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-exceptions">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Holidays & Non-Working Days</CardTitle>
          <CardDescription>Manage calendar exceptions for this programme</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-exception">
              <Plus className="h-4 w-4 mr-2" />
              Add Exception
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Holiday or Non-Working Day</DialogTitle>
              <DialogDescription>
                Add a date that should not be counted as a working day in the schedule
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          data-testid="input-exception-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          data-testid="input-exception-end-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Christmas Day, Bank Holiday"
                          data-testid="input-exception-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-exception">
                    {createMutation.isPending ? "Adding..." : "Add Exception"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {exceptions && exceptions.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Duration (Days)</TableHead>
                  <TableHead>Finish Date</TableHead>
                  <TableHead className="w-12">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => {
                  const startDate = new Date(exception.startDate);
                  const endDate = new Date(exception.endDate);
                  const duration = calculateWorkingDays(startDate, endDate);
                  return (
                    <TableRow key={exception.id} data-testid={`row-exception-${exception.id}`}>
                      <TableCell>{exception.name}</TableCell>
                      <TableCell className="font-medium">{formatDateUK(startDate)}</TableCell>
                      <TableCell>{duration}</TableCell>
                      <TableCell className="font-medium">{formatDateUK(endDate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(exception.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-exception-${exception.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No exceptions defined yet</p>
            <p className="text-xs mt-1">Add holidays and non-working days to help track project schedules</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
