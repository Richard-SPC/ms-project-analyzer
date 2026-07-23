import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/Dashboard";
import ProgrammeList from "@/pages/ProgrammeList";
import ProjectLibrary from "@/pages/ProjectLibrary";
import ProjectDetail from "@/pages/ProjectDetail";
import DcmaAssessment from "@/pages/DcmaAssessment";
import ProcurementDurations from "@/pages/ProcurementDurations";
import LiveProcurementDates from "@/pages/LiveProcurementDates";
import LiveDesignDates from "@/pages/LiveDesignDates";
import CompareProgrammes from "@/pages/CompareProgrammes";
import ProgrammeExceptions from "@/pages/ProgrammeExceptions";
import UserManagement from "@/pages/UserManagement";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-3 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.name || user.username}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto relative">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/projects" component={ProjectLibrary} />
              <Route path="/programmes" component={ProgrammeList} />
              <Route path="/programmes/:id" component={ProjectDetail} />
              <Route path="/dcma" component={DcmaAssessment} />
              <Route path="/procurement" component={ProcurementDurations} />
              <Route path="/live-procurement" component={LiveProcurementDates} />
              <Route path="/live-design" component={LiveDesignDates} />
              <Route path="/compare" component={CompareProgrammes} />
              <Route path="/exceptions" component={ProgrammeExceptions} />
              <Route path="/accounts" component={UserManagement} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
