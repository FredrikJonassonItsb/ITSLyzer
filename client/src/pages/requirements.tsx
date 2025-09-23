import { useState } from 'react';
import { RequirementsTable } from '@/components/requirements-table';
import { CreateRequirementDialog } from '@/components/create-requirement-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Download, Upload, Brain, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { FilterOptions, Requirement } from '@shared/schema';

export function RequirementsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['all']);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [showGrouped, setShowGrouped] = useState(false);
  const [selectedSheetCategory, setSelectedSheetCategory] = useState<string>('all');
  const [selectedSectionCategory, setSelectedSectionCategory] = useState<string>('all');

  // Fetch requirements with filters
  const { data: requirements = [], isLoading, refetch } = useQuery<Requirement[]>({
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

  // Get unique sheet categories (first category level)
  const uniqueSheetCategories = Array.from(new Set(
    requirements.map(req => req.categories?.[0]).filter(Boolean)
  ));

  // Get unique section categories (second category level)
  const uniqueSectionCategories = Array.from(new Set(
    requirements.map(req => req.categories?.[1]).filter(Boolean)
  ));

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
    setSelectedSheetCategory('all');
    setSelectedSectionCategory('all');
  };

  const filteredRequirements = requirements.filter(req => {
    // Category filtering
    if (selectedSheetCategory !== 'all' && req.categories?.[0] !== selectedSheetCategory) return false;
    if (selectedSectionCategory !== 'all' && req.categories?.[1] !== selectedSectionCategory) return false;
    
    return true;
  });

  const getCategoryCount = (categoryType: 'sheet' | 'section', category: string) => {
    if (category === 'all') return requirements.length;
    
    if (categoryType === 'sheet') {
      return requirements.filter(req => req.categories?.[0] === category).length;
    } else {
      return requirements.filter(req => req.categories?.[1] === category).length;
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
          <CreateRequirementDialog onRefresh={refetch} />
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

      {/* Category-based filtering */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-3">Filtrera efter kategorier</h3>
              
              {/* Sheet Category (First Level) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Flik / Avsnitt</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedSheetCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSheetCategory('all')}
                    data-testid="category-sheet-all"
                  >
                    Alla ({getCategoryCount('sheet', 'all')})
                  </Button>
                  {uniqueSheetCategories.map(category => (
                    <Button
                      key={category}
                      variant={selectedSheetCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSheetCategory(category)}
                      data-testid={`category-sheet-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {category} ({getCategoryCount('sheet', category)})
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Section Category (Second Level) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Sektion / Kategori</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedSectionCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSectionCategory('all')}
                    data-testid="category-section-all"
                  >
                    Alla ({getCategoryCount('section', 'all')})
                  </Button>
                  {uniqueSectionCategories.slice(0, 10).map(category => (
                    <Button
                      key={category}
                      variant={selectedSectionCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSectionCategory(category)}
                      data-testid={`category-section-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {category} ({getCategoryCount('section', category)})
                    </Button>
                  ))}
                  {uniqueSectionCategories.length > 10 && (
                    <Badge variant="outline" className="ml-2">
                      +{uniqueSectionCategories.length - 10} fler
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
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