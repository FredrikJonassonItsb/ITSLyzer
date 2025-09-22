import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, PieChart, TrendingUp, Download, Building, FileText, Users, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function StatisticsPage() {
  // Fetch statistics
  const { data: statistics, isLoading } = useQuery({
    queryKey: ['/api/statistics'],
    enabled: true
  });

  // Fetch requirements for additional analysis
  const { data: requirements = [] } = useQuery({
    queryKey: ['/api/requirements'],
    enabled: true
  });

  const handleExport = () => {
    console.log('Exporting statistics...');
    // TODO: Implement export functionality
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = statistics || {
    totalRequirements: 0,
    mustRequirements: 0,
    shouldRequirements: 0,
    organizations: 0,
    groups: 0,
    newRequirements: 0,
    categories: [],
    organizationStats: [],
    statusStats: []
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Statistik och analys</h1>
          <p className="text-muted-foreground">
            Översikt över krav, organisationer och grupperingar i systemet.
          </p>
        </div>
        
        <Button variant="outline" onClick={handleExport} data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Exportera rapport
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totalt krav</p>
                <p className="text-3xl font-bold" data-testid="stat-total">
                  {stats.totalRequirements.toLocaleString('sv-SE')}
                </p>
              </div>
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              I hela systemet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Organisationer</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="stat-organizations">
                  {stats.organizations}
                </p>
              </div>
              <Building className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Unika källor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI-grupper</p>
                <p className="text-3xl font-bold text-purple-600" data-testid="stat-groups">
                  {stats.groups}
                </p>
              </div>
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Identifierade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nya krav</p>
                <p className="text-3xl font-bold text-green-600" data-testid="stat-new">
                  {stats.newRequirements}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Senaste importen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Requirement Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Kravtyper
            </CardTitle>
            <CardDescription>
              Fördelning mellan Skall-krav och Bör-krav
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{stats.mustRequirements}</p>
                <p className="text-sm text-red-700 dark:text-red-300">Skall-krav</p>
                <Badge variant="destructive" className="mt-2">OBLIGATORISKA</Badge>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{stats.shouldRequirements}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">Bör-krav</p>
                <Badge variant="secondary" className="mt-2">REKOMMENDERADE</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Status översikt
            </CardTitle>
            <CardDescription>
              Fördelning av kravstatus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.statusStats.map((status, index) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="font-medium">{status.status}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{status.count}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({Math.round((status.count / stats.totalRequirements) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      {stats.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Populäraste kategorier
            </CardTitle>
            <CardDescription>
              De mest förekommande kravkategorierna
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.categories.slice(0, 8).map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <span className="font-medium">{category.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(category.count / Math.max(...stats.categories.map(c => c.count))) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold w-8 text-right">{category.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organizations */}
      {stats.organizationStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organisationer med flest krav
            </CardTitle>
            <CardDescription>
              Fördelning av krav per organisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.organizationStats.slice(0, 6).map((org, index) => (
                <div key={org.name} className="flex items-center justify-between">
                  <span className="font-medium">{org.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ 
                          width: `${(org.count / Math.max(...stats.organizationStats.map(o => o.count))) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold w-8 text-right">{org.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grupperingseffektivitet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {stats.totalRequirements > 0 
                  ? Math.round((requirements.filter(req => req.group_id).length / stats.totalRequirements) * 100)
                  : 0}%
              </p>
              <p className="text-sm text-muted-foreground">
                av kraven är grupperade
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Genomsnittlig gruppstorlek</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                {stats.groups > 0 
                  ? Math.round(requirements.filter(req => req.group_id).length / stats.groups)
                  : 0}
              </p>
              <p className="text-sm text-muted-foreground">
                krav per grupp
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kvalitetsmått</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {Math.round((stats.mustRequirements / (stats.totalRequirements || 1)) * 100)}%
              </p>
              <p className="text-sm text-muted-foreground">
                är kritiska Skall-krav
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {stats.totalRequirements === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Ingen statistik tillgänglig</h3>
                <p className="text-muted-foreground">
                  Importera krav för att se statistik och analyser.
                </p>
              </div>
              <Button onClick={() => window.location.href = '/import'}>
                Importera första filen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StatisticsPage;