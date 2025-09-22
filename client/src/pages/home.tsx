import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Brain, BarChart3, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';

export function Home() {
  const [, setLocation] = useLocation();

  const quickStats = {
    totalRequirements: 1247,
    newRequirements: 45,
    organizations: 12,
    lastImport: '2024-03-15'
  };

  const quickActions = [
    {
      title: 'Importera ny fil',
      description: 'Ladda upp en Excel-fil med krav för analys',
      icon: Upload,
      action: () => setLocation('/import'),
      variant: 'default' as const,
      testId: 'action-import'
    },
    {
      title: 'Visa kravsammanställning',
      description: 'Bläddra genom alla befintliga krav',
      icon: FileSpreadsheet,
      action: () => setLocation('/requirements'),
      variant: 'outline' as const,
      testId: 'action-requirements'
    },
    {
      title: 'AI-gruppering',
      description: 'Låt AI gruppera liknande krav automatiskt',
      icon: Brain,
      action: () => setLocation('/ai-grouping'),
      variant: 'outline' as const,
      testId: 'action-ai-grouping'
    },
    {
      title: 'Se statistik',
      description: 'Översikt över krav och organisationer',
      icon: BarChart3,
      action: () => setLocation('/statistics'),
      variant: 'outline' as const,
      testId: 'action-statistics'
    }
  ];

  const recentActivity = [
    {
      type: 'import',
      title: 'Ny fil importerad',
      description: 'Karolinska_krav_2024.xlsx - 67 nya krav',
      timestamp: '2 timmar sedan',
      status: 'success'
    },
    {
      type: 'grouping',
      title: 'AI-gruppering slutförd',
      description: '12 nya grupper identifierade',
      timestamp: '1 dag sedan', 
      status: 'success'
    },
    {
      type: 'update',
      title: 'Kravstatus uppdaterad',
      description: '23 krav markerade som "Under utveckling"',
      timestamp: '2 dagar sedan',
      status: 'pending'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Välkommen till ITSL Kravanalys</h1>
        <p className="text-lg text-muted-foreground">
          Hantera och analysera upphandlingskrav med AI-stödd gruppering och kategorisering.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt krav</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-requirements">
              {quickStats.totalRequirements.toLocaleString('sv-SE')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              I systemet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nya krav</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-new-requirements">
              {quickStats.newRequirements}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Senaste importen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organisationer</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-organizations">
              {quickStats.organizations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aktiva
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Senaste import</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-last-import">
              15 mar
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {quickStats.lastImport}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Snabbåtgärder</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="hover-elevate cursor-pointer" onClick={action.action}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {action.title}
                  </CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant={action.variant} 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.action();
                    }}
                    data-testid={action.testId}
                  >
                    Öppna
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Senaste aktivitet</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-3 rounded-lg hover-elevate">
                  <div className="mt-1">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{activity.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Kom igång</CardTitle>
          <CardDescription>
            Första gången du använder systemet? Här är några tips för att komma igång snabbt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Importera krav
              </div>
              <p className="text-muted-foreground ml-8">
                Börja med att ladda upp en Excel-fil med dina krav via Import-sektionen.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Kör AI-analys
              </div>
              <p className="text-muted-foreground ml-8">
                Använd AI-gruppering för att automatiskt identifiera och gruppera liknande krav.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                Granska och hantera
              </div>
              <p className="text-muted-foreground ml-8">
                Se kravsammanställningen för att granska, kommentera och sätta status på krav.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Home;