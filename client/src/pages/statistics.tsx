import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BarChart3, PieChart, TrendingUp, Download, Building, FileText, Users, Calendar, Trash2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { Statistics, Requirement } from '@shared/schema';

export function StatisticsPage() {
  const { toast } = useToast();

  // Fetch statistics
  const { data: statistics, isLoading } = useQuery<Statistics>({
    queryKey: ['/api/statistics'],
    enabled: true
  });

  // Fetch requirements for additional analysis
  const { data: requirements = [] } = useQuery<Requirement[]>({
    queryKey: ['/api/requirements'],
    enabled: true
  });

  // Delete all requirements mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/requirements', {
        confirmToken: "DELETE_ALL_REQUIREMENTS_CONFIRMED"
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });
      
      toast({
        title: "Databas nollställd",
        description: data.message || "Alla krav har raderats från databasen",
      });
    },
    onError: (error) => {
      console.error('Error deleting all requirements:', error);
      toast({
        title: "Fel vid nollställning",
        description: "Kunde inte radera alla krav från databasen",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!statistics || !requirements) return;

    // Helper function to escape CSV values to prevent injection
    const escapeCSV = (value: string | number): string => {
      const str = String(value);
      // Escape values that start with dangerous characters to prevent formula injection
      if (str.match(/^[=+\-@]/)) {
        return `"'${str.replace(/"/g, '""')}"`;
      }
      // Quote values containing commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Calculate correct metrics using grouped requirements
    const groupedCount = requirements.filter(req => req.group_id).length;
    const groupingEffectiveness = statistics.totalRequirements > 0 
      ? Math.round((groupedCount / statistics.totalRequirements) * 100) 
      : 0;
    const averageGroupSize = statistics.groups > 0 
      ? Math.round(groupedCount / statistics.groups) 
      : 0;

    // Create comprehensive statistics report
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRequirements: statistics.totalRequirements,
        mustRequirements: statistics.mustRequirements,
        shouldRequirements: statistics.shouldRequirements,
        organizations: statistics.organizations,
        groups: statistics.groups,
        newRequirements: statistics.newRequirements
      },
      categories: statistics.categories,
      organizationStats: statistics.organizationStats,
      statusStats: statistics.statusStats,
      analysisMetrics: {
        groupingEffectiveness,
        averageGroupSize,
        criticalRequirementsPercent: statistics.totalRequirements > 0 ? Math.round((statistics.mustRequirements / statistics.totalRequirements) * 100) : 0,
        newRequirementsPercent: statistics.totalRequirements > 0 ? Math.round((statistics.newRequirements / statistics.totalRequirements) * 100) : 0
      }
    };

    // Generate CSV content with proper escaping
    const csvContent = [
      'Svenskt Kravanalysverktyg - Statistikrapport',
      `Genererad: ${new Date().toLocaleString('sv-SE')}`,
      '',
      'SAMMANFATTNING',
      `Totalt antal krav,${statistics.totalRequirements}`,
      `Skall-krav,${statistics.mustRequirements}`,
      `Bör-krav,${statistics.shouldRequirements}`,
      `Organisationer,${statistics.organizations}`,
      `AI-grupper,${statistics.groups}`,
      `Nya krav,${statistics.newRequirements}`,
      '',
      'KATEGORIER',
      'Kategori,Antal',
      ...statistics.categories.map(cat => `${escapeCSV(cat.name)},${cat.count}`),
      '',
      'ORGANISATIONER',
      'Organisation,Antal',
      ...statistics.organizationStats.map(org => `${escapeCSV(org.name)},${org.count}`),
      '',
      'STATUS',
      'Status,Antal',
      ...statistics.statusStats.map(status => `${escapeCSV(status.status)},${status.count}`),
      '',
      'ANALYSMÅTT',
      `Grupperingseffektivitet,${reportData.analysisMetrics.groupingEffectiveness}%`,
      `Genomsnittlig gruppstorlek,${reportData.analysisMetrics.averageGroupSize}`,
      `Kritiska krav (Skall),${reportData.analysisMetrics.criticalRequirementsPercent}%`,
      `Nya krav,${reportData.analysisMetrics.newRequirementsPercent}%`
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `kravanalys-rapport-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Exportera rapport
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={deleteAllMutation.isPending || stats.totalRequirements === 0}
                data-testid="button-reset-database"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Nollställ databas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Nollställ hela databasen</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p className="text-destructive font-medium">
                    VARNING: Denna åtgärd raderar ALLA krav permanent och kan inte ångras!
                  </p>
                  <div className="bg-muted p-3 rounded">
                    <p className="text-sm">
                      Detta kommer att radera:
                    </p>
                    <ul className="text-sm mt-2 space-y-1">
                      <li>• <strong>{stats.totalRequirements}</strong> krav totalt</li>
                      <li>• <strong>{stats.groups}</strong> AI-grupper</li>
                      <li>• Data från <strong>{stats.organizations}</strong> organisationer</li>
                      <li>• Alla kommentarer och status</li>
                    </ul>
                  </div>
                  <p className="text-sm">
                    Är du absolut säker på att du vill fortsätta?
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteAllMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-reset"
                >
                  {deleteAllMutation.isPending ? "Raderar..." : "Ja, radera allt"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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

      {/* Interactive Charts Section */}
      {stats.totalRequirements > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Category Distribution Chart */}
          {stats.categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Kravkategorier
                </CardTitle>
                <CardDescription>
                  Interaktiv fördelning av kravkategorier
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.categories.slice(0, 10)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [value, 'Antal krav']}
                        labelFormatter={(label) => `Kategori: ${label}`}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requirements Type Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Kravtypsfördelning
              </CardTitle>
              <CardDescription>
                Visuell fördelning mellan Skall- och Bör-krav
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: 'Skall-krav', value: stats.mustRequirements, color: '#ef4444' },
                        { name: 'Bör-krav', value: stats.shouldRequirements, color: '#eab308' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#eab308" />
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [value, 'Antal krav']}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Organization Distribution Chart */}
          {stats.organizationStats.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Organisationsfördelning
                </CardTitle>
                <CardDescription>
                  Antal krav per organisation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.organizationStats.slice(0, 10)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [value, 'Antal krav']}
                        labelFormatter={(label) => `Organisation: ${label}`}
                      />
                      <Bar dataKey="count" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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