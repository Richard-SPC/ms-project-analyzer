import { useQuery } from "@tanstack/react-query";
import { Clock, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateUK } from "@/lib/utils";

interface LiveProcurementTask {
  id: number;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  duration: number | null;
  percentComplete: number;
  projectId: number;
  projectName: string;
  workspaceName: string;
}

export default function LiveProcurementDates() {
  const { data: liveProcurement, isLoading } = useQuery<LiveProcurementTask[]>({
    queryKey: ["/api/live-procurement-dates"],
  });

  // Group by workspace and project
  const groupedData = liveProcurement?.reduce((acc, task) => {
    const workspaceKey = task.workspaceName;
    const projectKey = task.projectName;
    
    if (!acc[workspaceKey]) {
      acc[workspaceKey] = {};
    }
    if (!acc[workspaceKey][projectKey]) {
      acc[workspaceKey][projectKey] = [];
    }
    acc[workspaceKey][projectKey].push(task);
    return acc;
  }, {} as Record<string, Record<string, LiveProcurementTask[]>>) || {};

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-live-procurement-title">
          Live Procurement Dates
        </h1>
        <p className="text-muted-foreground mt-2">
          Latest procurement tasks across all projects (showing most recent programme version)
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted animate-pulse rounded w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(groupedData).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Procurement Data Available</h3>
            <p className="text-sm text-muted-foreground">
              Upload programmes with procurement tasks to see data here.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedData).map(([workspaceName, projects]) => (
          <div key={workspaceName} className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-xl font-semibold text-foreground" data-testid={`text-project-${workspaceName}`}>
                {workspaceName}
              </h2>
            </div>

            {Object.entries(projects).map(([projectName, tasks]) => (
              <Card key={`${workspaceName}-${projectName}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    {projectName}
                  </CardTitle>
                  <CardDescription>{tasks.length} procurement task(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-auto">
                          <TableHead className="text-sm" data-testid="header-task-name">
                            Task Name
                          </TableHead>
                          <TableHead className="text-sm" data-testid="header-start-date">
                            Start Date
                          </TableHead>
                          <TableHead className="text-sm" data-testid="header-finish-date">
                            Finish Date
                          </TableHead>
                          <TableHead className="text-right text-sm" data-testid="header-duration">
                            Duration (days)
                          </TableHead>
                          <TableHead className="text-right text-sm" data-testid="header-complete">
                            % Complete
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task.id} data-testid={`row-procurement-task-${task.id}`}>
                            <TableCell className="text-sm py-3" data-testid={`text-task-name-${task.id}`}>
                              {task.name}
                            </TableCell>
                            <TableCell className="text-sm py-3" data-testid={`text-start-date-${task.id}`}>
                              {task.startDate ? formatDateUK(task.startDate) : "N/A"}
                            </TableCell>
                            <TableCell className="text-sm py-3" data-testid={`text-finish-date-${task.id}`}>
                              {task.endDate ? formatDateUK(task.endDate) : "N/A"}
                            </TableCell>
                            <TableCell className="text-right text-sm py-3" data-testid={`text-duration-${task.id}`}>
                              {task.duration ?? "-"}
                            </TableCell>
                            <TableCell className="text-right text-sm py-3" data-testid={`text-complete-${task.id}`}>
                              {task.percentComplete.toFixed(0)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
