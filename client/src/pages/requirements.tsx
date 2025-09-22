import { useState } from 'react';
import { RequirementsTable } from '@/components/requirements-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Download, Upload, Brain, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { FilterOptions } from '@shared/schema';

export function RequirementsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['all']);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [showGrouped, setShowGrouped] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch requirements with filters
  const { data: requirements = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/requirements', { 
      searchQuery, 
      requirementTypes: selectedTypes,
      organizations: selectedOrganizations,
      categories: selectedCategories,
      userStatus: selectedStatus,
      showOnlyNew,
      showGrouped 
    }],
    enabled: true
  });

  // Get unique values for filters
  const uniqueOrganizations = Array.from(new Set(
    requirements.flatMap(req => req.organizations || [])
  )).filter(Boolean);

  const uniqueCategories = Array.from(new Set(
    requirements.flatMap(req => req.categories || [])
  )).filter(Boolean);

  const handleExport = () => {
    console.log('Exporting requirements...', { 
      count: requirements.length,
      filters: { searchQuery, selectedOrganizations, selectedCategories }
    });
    // TODO: Implement export functionality
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedOrganizations([]);
    setSelectedCategories([]);
    setSelectedTypes(['all']);
    setSelectedStatus(['all']);
    setShowOnlyNew(false);
    setShowGrouped(false);
  };

  const filteredRequirements = requirements.filter(req => {
    // Tab filtering
    if (activeTab === 'new' && !req.is_new) return false;
    if (activeTab === 'grouped' && !req.group_id) return false;
    if (activeTab === 'mustHave' && req.requirement_type !== 'Skall') return false;
    if (activeTab === 'shouldHave' && req.requirement_type !== 'Bör') return false;
    
    return true;
  });

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'all': return requirements.length;
      case 'new': return requirements.filter(req => req.is_new).length;
      case 'grouped': return requirements.filter(req => req.group_id).length;
      case 'mustHave': return requirements.filter(req => req.requirement_type === 'Skall').length;
      case 'shouldHave': return requirements.filter(req => req.requirement_type === 'Bör').length;
      default: return 0;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Kravsammanställning</h1>
          <p className="text-muted-foreground">
            Hantera och analysera alla krav i systemet.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleExport}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportera
          </Button>
          <Button 
            onClick={() => window.location.href = '/import'}
            data-testid="button-import"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importera
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totalt krav</p>
                <p className="text-2xl font-bold" data-testid="stat-total">
                  {requirements.length}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Skall-krav</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-must">
                  {requirements.filter(req => req.requirement_type === 'Skall').length}
                </p>
              </div>
              <Badge variant="destructive" className="text-xs">SKALL</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bör-krav</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-should">
                  {requirements.filter(req => req.requirement_type === 'Bör').length}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">BÖR</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Grupperade</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-grouped">
                  {requirements.filter(req => req.group_id).length}
                </p>
              </div>
              <Brain className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter och sökning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök i kravtext..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Rensa filter
            </Button>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kravtyp</label>
              <Select 
                value={selectedTypes[0] || 'all'} 
                onValueChange={(value) => setSelectedTypes([value])}
              >
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="Alla typer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla typer</SelectItem>
                  <SelectItem value="Skall">Skall-krav</SelectItem>
                  <SelectItem value="Bör">Bör-krav</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={selectedStatus[0] || 'all'} 
                onValueChange={(value) => setSelectedStatus([value])}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla status</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                  <SelectItem value="Under utveckling">Under utveckling</SelectItem>
                  <SelectItem value="Senare">Senare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Organisationer</label>
              <Select 
                value={selectedOrganizations[0] || 'all'} 
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedOrganizations([]);
                  } else {
                    setSelectedOrganizations([value]);
                  }
                }}
              >
                <SelectTrigger data-testid="select-organization">
                  <SelectValue placeholder="Alla organisationer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla organisationer</SelectItem>
                  {uniqueOrganizations.map(org => (
                    <SelectItem key={org} value={org}>{org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kategorier</label>
              <Select 
                value={selectedCategories[0] || 'all'} 
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedCategories([]);
                  } else {
                    setSelectedCategories([value]);
                  }
                }}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Alla kategorier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kategorier</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showOnlyNew" 
                checked={showOnlyNew}
                onCheckedChange={(checked) => setShowOnlyNew(checked as boolean)}
                data-testid="checkbox-only-new"
              />
              <label htmlFor="showOnlyNew" className="text-sm">
                Visa endast nya krav
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showGrouped" 
                checked={showGrouped}
                onCheckedChange={(checked) => setShowGrouped(checked as boolean)}
                data-testid="checkbox-grouped"
              />
              <label htmlFor="showGrouped" className="text-sm">
                Visa endast grupperade krav
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Tabs */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" data-testid="tab-all">
                Alla ({getTabCount('all')})
              </TabsTrigger>
              <TabsTrigger value="new" data-testid="tab-new">
                Nya ({getTabCount('new')})
              </TabsTrigger>
              <TabsTrigger value="grouped" data-testid="tab-grouped">
                Grupperade ({getTabCount('grouped')})
              </TabsTrigger>
              <TabsTrigger value="mustHave" data-testid="tab-must">
                Skall ({getTabCount('mustHave')})
              </TabsTrigger>
              <TabsTrigger value="shouldHave" data-testid="tab-should">
                Bör ({getTabCount('shouldHave')})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <RequirementsTable 
            requirements={filteredRequirements}
            isLoading={isLoading}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      {/* Help */}
      {requirements.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Inga krav importerade än</h3>
                <p className="text-muted-foreground">
                  Börja med att importera en Excel-fil med krav för att se dem här.
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

export default RequirementsPage;