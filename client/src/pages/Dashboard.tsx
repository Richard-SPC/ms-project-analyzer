import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, FileCheck, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjects = projects?.filter(p => p.status === "active").length || 0;
  const completedProjects = projects?.filter(p => p.status === "completed").length || 0;
  const totalProjects = projects?.length || 0;

  const stats = [
    {
      title: "Total Projects",
      value: totalProjects,
      icon: FolderKanban,
      description: "All programmes",
    },
    {
      title: "Active Projects",
      value: activeProjects,
      icon: Activity,
      description: "Currently running",
    },
    {
      title: "Completed",
      value: completedProjects,
      icon: FileCheck,
      description: "Finished projects",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            Programme Dashboard
          </h1>
          <p className="text-muted-foreground">
            Microsoft Project Programme Analyser
          </p>
        </div>
        <Link href="/projects">
          <Button data-testid="button-view-projects">
            View All Projects
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm">Recent Projects</CardTitle>
            <CardDescription className="text-xs">Latest programme uploads and updates</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-2">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-1">
                {projects.slice(0, 5).map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-center justify-between p-2 hover-elevate rounded-md border text-xs" data-testid={`card-recent-project-${project.id}`}>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-xs">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.projectManager || "No manager"}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No projects yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Common tasks and assessments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-2 pb-2">
            <Link href="/projects">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-create-project">
                <FolderKanban className="mr-2 h-3 w-3" />
                Create New Project
              </Button>
            </Link>
            <Link href="/dcma">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-run-dcma">
                <FileCheck className="mr-2 h-3 w-3" />
                Run DCMA Assessment
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
