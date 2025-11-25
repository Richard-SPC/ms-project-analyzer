import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, AlertTriangle, Calendar } from "lucide-react";
import { formatDateUK } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Project, Task, DcmaAssessment, NecCompliance } from "@shared/schema";

function formatGanttData(tasks: Task[], projectStart: string | Date) {
  if (!tasks || !projectStart) return [];
  
  const startDate = new Date(projectStart);
  const criticalTasks = tasks.filter(t => t.isCriticalPath);
  
  return criticalTasks.map(task => {
    const taskStart = task.startDate ? new Date(task.startDate) : startDate;
    const taskEnd = task.endDate ? new Date(task.endDate) : new Date(taskStart);
    
    const daysFromStart = Math.floor((taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      name: task.name.substring(0, 30),
      start: Math.max(0, daysFromStart),
      duration: Math.max(1, duration),
      fullName: task.name,
      percentComplete: parseFloat(task.percentComplete || "0"),
    };
  }).sort((a, b) => a.start - b.start);
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id ? parseInt(params.id) : 0;

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const { data: dcmaAssessment } = useQuery<DcmaAssessment>({
    queryKey: ["/api/projects", projectId, "dcma-assessments", "latest"],
    enabled: !!projectId,
  });

  const { data: necCompliance } = useQuery<NecCompliance>({
    queryKey: ["/api/projects", projectId, "nec-compliance", "latest"],
    enabled: !!projectId,
  });

  const ganttData = project && tasks && project.startDate ? formatGanttData(tasks, project.startDate) : [];

  if (projectLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
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
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Project not found</h1>
        <Link href="/projects">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-project-name">{project.name}</h1>
            <p className="text-muted-foreground">{project.description || "No description"}</p>
          </div>
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"} data-testid="badge-project-status">
          {project.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic details and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Project Manager:</span>
              <span className="text-sm font-medium">{project.projectManager || "Not assigned"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Start Date:</span>
              <span className="text-sm font-medium">
                {formatDateUK(project.startDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">End Date:</span>
              <span className="text-sm font-medium">
                {formatDateUK(project.endDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">NEC Compliant:</span>
              <span className="text-sm font-medium">
                {project.necCompliant === true ? "Yes" : project.necCompliant === false ? "No" : "Not assessed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tasks Overview
            </CardTitle>
            <CardDescription>Project activities and milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Tasks:</span>
              <span className="text-sm font-medium">{tasks?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Critical Path Tasks:</span>
              <span className="text-sm font-medium">
                {tasks?.filter(t => t.isCriticalPath).length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Milestones:</span>
              <span className="text-sm font-medium">
                {tasks?.filter(t => t.isMilestone).length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg. Completion:</span>
              <span className="text-sm font-medium">
                {tasks && tasks.length > 0
                  ? `${Math.round(tasks.reduce((sum, t) => sum + parseFloat(t.percentComplete || "0"), 0) / tasks.length)}%`
                  : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              DCMA Assessment
            </CardTitle>
            <CardDescription>14-point schedule health check</CardDescription>
          </CardHeader>
          <CardContent>
            {dcmaAssessment ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overall Score:</span>
                  <span className="text-2xl font-bold">
                    {dcmaAssessment.overallScore || 0}/14
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={dcmaAssessment.passed ? "default" : "destructive"}>
                    {dcmaAssessment.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assessment Date:</span>
                  <span className="text-sm font-medium">
                    {formatDateUK(dcmaAssessment.assessmentDate)}
                  </span>
                </div>
                <Link href="/dcma">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-view-dcma">
                    View Full Assessment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">No assessment available</p>
                <Link href="/dcma">
                  <Button data-testid="button-run-dcma-assessment">Run Assessment</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              NEC Compliance
            </CardTitle>
            <CardDescription>Contract compliance check</CardDescription>
          </CardHeader>
          <CardContent>
            {necCompliance ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={necCompliance.overallCompliant ? "default" : "destructive"}>
                    {necCompliance.overallCompliant ? "Compliant" : "Non-compliant"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assessment Date:</span>
                  <span className="text-sm font-medium">
                    {formatDateUK(necCompliance.assessmentDate)}
                  </span>
                </div>
                {necCompliance.notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes:</span>
                    <p className="text-sm mt-1">{necCompliance.notes}</p>
                  </div>
                )}
                <Link href="/nec">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-view-nec">
                    View Full Compliance
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">No compliance check available</p>
                <Link href="/nec">
                  <Button data-testid="button-run-nec-check">Run Compliance Check</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {ganttData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Critical Path Timeline</CardTitle>
            <CardDescription>Gantt chart showing critical tasks schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={ganttData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => `${value} days`}
                    labelFormatter={(label) => `Task: ${label}`}
                    cursor={{ fill: "rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="duration" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Shows {ganttData.length} critical path task{ganttData.length !== 1 ? "s" : ""} from project start date</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
