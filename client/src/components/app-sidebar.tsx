import { Home, Upload, FileSpreadsheet, Brain, BarChart3, GitCompare, Settings } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';

const menuItems = [
  {
    title: 'Hem',
    url: '/',
    icon: Home,
    testId: 'nav-home'
  },
  {
    title: 'Importera',
    url: '/import',
    icon: Upload,
    testId: 'nav-import'
  },
  {
    title: 'Kravsammanställning',
    url: '/requirements',
    icon: FileSpreadsheet,
    testId: 'nav-requirements'
  },
  {
    title: 'Jämföra',
    url: '/compare',
    icon: GitCompare,
    testId: 'nav-compare'
  },
  {
    title: 'AI-gruppering',
    url: '/ai-grouping',
    icon: Brain,
    testId: 'nav-ai-grouping'
  },
  {
    title: 'Statistik',
    url: '/statistics',
    icon: BarChart3,
    testId: 'nav-statistics'
  }
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === '/') {
      return location === '/';
    }
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">ITSL Kravanalys</h2>
            <p className="text-xs text-muted-foreground">Svenska kravverktyget</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Huvudnavigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    data-active={isActive(item.url)}
                    data-testid={item.testId}
                  >
                    <a href={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}