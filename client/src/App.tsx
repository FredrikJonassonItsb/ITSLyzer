import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Suspense, lazy } from "react";

// Lazy load all pages for better performance
const HomePage = lazy(() => import("@/pages/home"));
const ImportPage = lazy(() => import("@/pages/import"));
const RequirementsPage = lazy(() => import("@/pages/requirements"));
const ComparePage = lazy(() => import("@/pages/compare"));
const AIGroupingPage = lazy(() => import("@/pages/ai-grouping"));
const StatisticsPage = lazy(() => import("@/pages/statistics"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading component for suspense fallback
function PageLoadingSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-64"></div>
      <div className="h-4 bg-muted rounded w-96"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-muted rounded"></div>
        ))}
      </div>
      <div className="h-64 bg-muted rounded"></div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/requirements" component={RequirementsPage} />
        <Route path="/compare" component={ComparePage} />
        <Route path="/ai-grouping" component={AIGroupingPage} />
        <Route path="/statistics" component={StatisticsPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  // Custom sidebar width for Swedish requirements application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-2 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-2">
                    {/* Theme toggle would go here if we had one */}
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;