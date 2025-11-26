import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";

interface ProcurementTask {
  id: number;
  name: string;
  duration: number | null;
  projectId: number;
  projectName: string;
}

export default function ProcurementDurations() {
  const { data: procurementTasks, isLoading } = useQuery<ProcurementTask[]>({
    queryKey: ["/api/procurement-tasks"],
  });

  const totalDuration = procurementTasks?.reduce((sum, task) => sum + (task.duration || 0), 0) || 0;
  const taskCount = procurementTasks?.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-procurement-title">
          Procurement Durations
        </h1>
        <p className="text-muted-foreground">
          Tasks containing "procurement" across all programmes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-stat-task-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-task-count">
              {taskCount}
            </div>
            <p className="text-xs text-muted-foreground">Procurement items found</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-total-duration">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total-duration">
              {totalDuration} days
            </div>
            <p className="text-xs text-muted-foreground">Combined duration</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Procurement Tasks</CardTitle>
          <CardDescription>Complete list of procurement-related tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : procurementTasks && procurementTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-programme">Programme</TableHead>
                    <TableHead data-testid="header-task-name">Task Name</TableHead>
                    <TableHead className="text-right" data-testid="header-duration">
                      Duration (days)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procurementTasks.map((task) => (
                    <TableRow key={task.id} data-testid={`row-procurement-task-${task.id}`}>
                      <TableCell className="font-medium" data-testid={`text-programme-${task.id}`}>
                        {task.projectName}
                      </TableCell>
                      <TableCell data-testid={`text-task-name-${task.id}`}>
                        {task.name}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-duration-${task.id}`}>
                        {task.duration ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No procurement tasks found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
