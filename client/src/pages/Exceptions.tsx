import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { insertCalendarExceptionSchema, type CalendarException } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateUK, calculateWorkingDays } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function Exceptions({ projectId }: { projectId: number }) {
  const { toast } = useToast();

  const { data: exceptions, isLoading } = useQuery<CalendarException[]>({
    queryKey: [`/api/projects/${projectId}/exceptions`],
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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 py-2">
        <div className="space-y-0">
          <CardTitle className="text-sm">Holidays & Non-Working Days</CardTitle>
          <CardDescription className="text-xs">Manage calendar exceptions for this programme</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-2">
        {exceptions && exceptions.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="h-4 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold py-0">Name</TableHead>
                  <TableHead className="text-xs font-semibold py-0">Calendar</TableHead>
                  <TableHead className="text-xs font-semibold py-0">Duration (Days)</TableHead>
                  <TableHead className="text-xs font-semibold py-0">Start Date</TableHead>
                  <TableHead className="text-xs font-semibold py-0">Finish Date</TableHead>
                  <TableHead className="w-12 text-xs font-semibold py-0">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => {
                  const startDate = new Date(exception.startDate);
                  const endDate = new Date(exception.endDate);
                  const duration = calculateWorkingDays(startDate, endDate);
                  return (
                    <TableRow key={exception.id} data-testid={`row-exception-${exception.id}`} className="h-4">
                      <TableCell className="text-xs py-0">{exception.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-0">{exception.calendarName || 'Standard Calendar'}</TableCell>
                      <TableCell className="text-xs py-0">{duration}</TableCell>
                      <TableCell className="text-xs font-medium py-0">{formatDateUK(startDate)}</TableCell>
                      <TableCell className="text-xs font-medium py-0">{formatDateUK(endDate)}</TableCell>
                      <TableCell className="py-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteMutation.mutate(exception.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-exception-${exception.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
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
