import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Brain, BarChart3, ArrowRight, CheckCircle, Zap, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function HomePage() {
  // Fetch recent statistics
  const { data: statistics } = useQuery({
    queryKey: ['/api/statistics'],
    enabled: true
  });

  const stats = statistics || {
    totalRequirements: 0,
    mustRequirements: 0,
    shouldRequirements: 0,
    organizations: 0,
    groups: 0,
    newRequirements: 0
  };

  const quickActions = [
    {
      title: 'Importera Excel',
      description: 'Ladda upp en ny Excel-fil med krav',
      icon: Upload,
      href: '/import',
      variant: 'default' as const,
      testId: 'action-import'
    },
    {
      title: 'Kravsammanställning',
      description: 'Granska och hantera alla krav',
      icon: FileSpreadsheet,
      href: '/requirements',
      variant: 'outline' as const,
      testId: 'action-requirements'
    },
    {
      title: 'AI-gruppering',
      description: 'Kör AI-analys för att gruppera krav',
      icon: Brain,
      href: '/ai-grouping',
      variant: 'outline' as const,
      testId: 'action-ai-grouping'
    },
    {
      title: 'Statistik',
      description: 'Se rapporter och analyser',
      icon: BarChart3,
      href: '/statistics',
      variant: 'outline' as const,
      testId: 'action-statistics'
    }
  ];

  const features = [
    {
      icon: Upload,
      title: 'Excel-import',
      description: 'Intelligent parsing av svenska Excel-filer med automatisk kolumnidentifiering'
    },
    {
      icon: Brain,
      title: 'AI-gruppering',
      description: 'Använder GPT-5 för att automatiskt gruppera liknande krav och identifiera duplikater'
    },
    {
      icon: Shield,
      title: 'Svensk support',
      description: 'Fullständigt stöd för svenska tecken (åäö) och terminologi genom hela systemet'
    },
    {
      icon: BarChart3,
      title: 'Djup analys',
      description: 'Omfattande statistik och rapporter för att förstå era kravprocesser'
    }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
          <Zap className="h-4 w-4" />
          Svenskt Kravanalysverktyg för ITSL
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">
          Intelligent kravhantering för svenska organisationer
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Automatisera analys av kravspecifikationer med AI-driven gruppering, 
          dubblettdetektering och omfattande statistik. Designat för svenska 
          upphandlingsprocesser.
        </p>
      </div>

      {/* Quick Stats */}
      {stats.totalRequirements > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600" data-testid="stat-total">
                {stats.totalRequirements.toLocaleString('sv-SE')}
              </p>
              <p className="text-sm text-muted-foreground">Totalt krav</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600" data-testid="stat-must">
                {stats.mustRequirements}
              </p>
              <p className="text-sm text-muted-foreground">Skall-krav</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600" data-testid="stat-organizations">
                {stats.organizations}
              </p>
              <p className="text-sm text-muted-foreground">Organisationer</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600" data-testid="stat-groups">
                {stats.groups}
              </p>
              <p className="text-sm text-muted-foreground">AI-grupper</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Kom igång</CardTitle>
          <CardDescription>
            Välj en åtgärd för att börja arbeta med krav
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                variant={action.variant}
                size="lg"
                onClick={() => window.location.href = action.href}
                className="h-auto p-4 justify-start"
                data-testid={action.testId}
              >
                <div className="flex items-center gap-4 w-full">
                  <action.icon className="h-6 w-6 flex-shrink-0" />
                  <div className="text-left flex-1">
                    <div className="font-medium">{action.title}</div>
                    <div className="text-sm opacity-70">{action.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0" />
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting Started Guide */}
      {stats.totalRequirements === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Kom igång i 3 steg
            </CardTitle>
            <CardDescription>
              Så här börjar du använda kravanalysverktyget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Importera Excel-fil</h4>
                  <p className="text-sm text-muted-foreground">
                    Ladda upp en Excel-fil med krav från er organisation. 
                    Systemet identifierar automatiskt svenska kolumnnamn.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Kör AI-gruppering</h4>
                  <p className="text-sm text-muted-foreground">
                    Låt AI:n analysera och gruppera liknande krav automatiskt. 
                    Detta sparar tid och ger bättre översikt.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Analysera resultat</h4>
                  <p className="text-sm text-muted-foreground">
                    Se statistik, rapporter och detaljerade analyser av era krav. 
                    Exportera resultat för vidare bearbetning.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <Button 
                onClick={() => window.location.href = '/import'}
                className="w-full"
                data-testid="button-get-started"
              >
                <Upload className="h-4 w-4 mr-2" />
                Börja med att importera en fil
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>Om systemet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Filformat som stöds:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Microsoft Excel (.xlsx, .xls)</li>
                <li>• Automatisk kolumnidentifiering</li>
                <li>• Svenska headers och värden</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">AI-funktioner:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• GPT-5 textanalys</li>
                <li>• Automatisk kategorisering</li>
                <li>• Dubblettdetektering</li>
                <li>• Semantisk gruppering</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Rapporter:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Organisationsstatistik</li>
                <li>• Kravtypsanalys</li>
                <li>• Trendrapporter</li>
                <li>• Excel-export</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;