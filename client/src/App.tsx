import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/Dashboard";
import ProgrammeList from "@/pages/ProgrammeList";
import ProjectLibrary from "@/pages/ProjectLibrary";
import ProjectDetail from "@/pages/ProjectDetail";
import DcmaAssessment from "@/pages/DcmaAssessment";
import ProcurementDurations from "@/pages/ProcurementDurations";
import LiveProcurementDates from "@/pages/LiveProcurementDates";
import CompareProgrammes from "@/pages/CompareProgrammes";
import ProgrammeExceptions from "@/pages/ProgrammeExceptions";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={ProjectLibrary} />
      <Route path="/programmes" component={ProgrammeList} />
      <Route path="/programmes/:id" component={ProjectDetail} />
      <Route path="/dcma" component={DcmaAssessment} />
      <Route path="/procurement" component={ProcurementDurations} />
      <Route path="/live-procurement" component={LiveProcurementDates} />
      <Route path="/compare" component={CompareProgrammes} />
      <Route path="/exceptions" component={ProgrammeExceptions} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-3 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto relative">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
