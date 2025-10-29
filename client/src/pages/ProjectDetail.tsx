import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, AlertTriangle, Calendar } from "lucide-react";
import type { Project, Task, DcmaAssessment, NecCompliance } from "@shared/schema";

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
                {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">End Date:</span>
              <span className="text-sm font-medium">
                {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
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
                    {new Date(dcmaAssessment.assessmentDate).toLocaleDateString()}
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
                    {new Date(necCompliance.assessmentDate).toLocaleDateString()}
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

      {tasks && tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Task List</CardTitle>
            <CardDescription>All tasks in this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                  data-testid={`task-item-${task.id}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{task.name}</span>
                      {task.wbsCode && (
                        <span className="text-xs text-muted-foreground">WBS: {task.wbsCode}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {task.isCriticalPath && (
                      <Badge variant="destructive">Critical</Badge>
                    )}
                    {task.isMilestone && (
                      <Badge variant="secondary">Milestone</Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {task.percentComplete}% complete
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
