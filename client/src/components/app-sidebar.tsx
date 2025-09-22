import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { 
  Upload, 
  FileSpreadsheet, 
  Search, 
  BarChart3, 
  GitCompare, 
  Brain,
  Building,
  Settings
} from "lucide-react";
import { ThemeToggle } from "./theme-provider";

const navigationItems = [
  {
    title: "Importera",
    url: "/import",
    icon: Upload,
    description: "Ladda upp ny Excel-fil"
  },
  {
    title: "Kravsammanställning", 
    url: "/requirements",
    icon: FileSpreadsheet,
    description: "Visa alla krav"
  },
  {
    title: "AI-gruppering",
    url: "/ai-grouping", 
    icon: Brain,
    description: "Gruppera liknande krav"
  },
  {
    title: "Jämförelse",
    url: "/comparison",
    icon: GitCompare, 
    description: "Jämför med befintliga krav"
  },
  {
    title: "Statistik",
    url: "/statistics",
    icon: BarChart3,
    description: "Översikt och rapporter"
  }
];

const toolsItems = [
  {
    title: "Sök",
    url: "/search",
    icon: Search,
    description: "Avancerad sökning"
  },
  {
    title: "Organisationer", 
    url: "/organizations",
    icon: Building,
    description: "Hantera organisationer"
  },
  {
    title: "Inställningar",
    url: "/settings", 
    icon: Settings,
    description: "Applikationsinställningar"
  }
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <Sidebar>
      <SidebarContent>
        {/* Header */}
        <SidebarGroup>
          <div className="px-3 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">ITSL</h2>
                <p className="text-xs text-muted-foreground">Kravanalys</p>
              </div>
            </div>
          </div>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Huvudfunktioner</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <a href={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>Verktyg</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <a href={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between p-3">
          <div className="text-xs text-muted-foreground">
            Version 1.0.0
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;