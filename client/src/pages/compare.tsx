import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, GitCompare, Search, FileText, MessageSquare, CheckCircle, AlertCircle, Clock, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Requirement } from '@shared/schema';
import { generateRequirementKey } from '@shared/generateRequirementKey';

interface CompareResult {
  newRequirement: {
    text: string;
    requirement_type: string;
    categories: string[];
    originalIndex: number;
    sheetOrder: number;
    sheetRowIndex: number;
  };
  matchedRequirements: Requirement[];
  isIdentical: boolean;
  similarityScore?: number;
}

export function ComparePage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [organization, setOrganization] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [requirementChanges, setRequirementChanges] = useState<Map<string, { comment: string; status: string }>>(new Map());
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [currentSheetPages, setCurrentSheetPages] = useState<Map<string, number>>(new Map());
  const [resultsPerPage] = useState(10); // Configurable per-page count

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Generate stable key for requirement tracking across sheets using shared helper
  const getRequirementKey = (result: CompareResult) => {
    const sheet = result.newRequirement.categories[0] || 'unknown';
    return generateRequirementKey(
      sheet,
      result.newRequirement.sheetOrder,
      result.newRequirement.sheetRowIndex,
      result.newRequirement.text
    );
  };


  // Get safe current page for a sheet with clamping
  const getCurrentPage = (sheetName: string, totalPages: number) => {
    const currentPage = currentSheetPages.get(sheetName) || 1;
    return Math.max(1, Math.min(currentPage, totalPages || 1));
  };

  // Set page for a sheet  
  const setSheetPage = (sheetName: string, page: number) => {
    const newPages = new Map(currentSheetPages);
    newPages.set(sheetName, page);
    setCurrentSheetPages(newPages);
  };

  // Get total pages for a sheet
  const getTotalPages = (sheetResults: CompareResult[]) => {
    return Math.ceil(sheetResults.length / resultsPerPage) || 1;
  };

  // Get paginated results for a sheet with safe pagination
  const getPaginatedSheetResults = (sheetName: string, sheetResults: CompareResult[]) => {
    const totalPages = getTotalPages(sheetResults);
    const currentPage = getCurrentPage(sheetName, totalPages);
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    return sheetResults.slice(startIndex, endIndex);
  };

  // Reset pagination when results change
  useEffect(() => {
    setCurrentSheetPages(new Map());
  }, [compareResults, searchQuery]);

  // Handle saving changes for a requirement
  const handleSaveChanges = async (requirementKey: string, comment: string, status: string) => {
    const newChanges = new Map(requirementChanges);
    newChanges.set(requirementKey, { comment, status });
    setRequirementChanges(newChanges);
    console.log('Changes stored for requirement:', { requirementKey, comment, status });
  };

  // Save the entire comparison file to database with all changes
  const handleSaveToDatabase = async () => {
    if (!uploadedFile || !organization) return;

    setIsSavingToDatabase(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('organization', organization);
      
      // Include all the changes made during comparison
      const changesArray = Array.from(requirementChanges.entries()).map(([requirementKey, changes]) => ({
        requirementKey,
        ...changes
      }));
      formData.append('changes', JSON.stringify(changesArray));

      const response = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to save to database');
      }

      const result = await response.json();
      console.log('File saved to database:', result);
      
      // Refresh requirements data
      await queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      
      // Clear changes after successful save
      setRequirementChanges(new Map());
      
      // Show success message
      toast({
        title: "Framgång!",
        description: "Kravfilen har sparats till databasen med dina ändringar.",
      });
      
    } catch (error) {
      console.error('Error saving to database:', error);
      toast({
        title: "Fel",
        description: "Fel vid sparning till databas. Försök igen.",
        variant: "destructive",
      });
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  // Fetch all existing requirements for comparison
  const { data: existingRequirements = [], isLoading } = useQuery<Requirement[]>({
    queryKey: ['/api/requirements'],
    enabled: true
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const uploadAndCompareMutation = useMutation({
    mutationFn: async (data: { file: File; organization: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('organization', data.organization);

      const response = await fetch('/api/compare', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload and compare file');
      }

      return response.json();
    },
    onSuccess: (results: CompareResult[]) => {
      setCompareResults(results);
      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
    },
    onError: (error) => {
      console.error('Upload and compare failed:', error);
      setIsUploading(false);
    }
  });

  const handleUploadAndCompare = () => {
    if (!uploadedFile || !organization.trim()) {
      return;
    }

    setIsUploading(true);
    uploadAndCompareMutation.mutate({ file: uploadedFile, organization: organization.trim() });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Under utveckling': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Senare': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const filteredResults = compareResults.filter(result => 
    searchQuery === '' || 
    result.newRequirement.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Memoized group results by sheet for pagination  
  const groupedResults = useMemo(() => {
    const sortedResults = [...filteredResults].sort((a, b) => {
      if (a.newRequirement.sheetOrder !== b.newRequirement.sheetOrder) {
        return a.newRequirement.sheetOrder - b.newRequirement.sheetOrder;
      }
      return a.newRequirement.sheetRowIndex - b.newRequirement.sheetRowIndex;
    });

    const grouped = new Map<string, CompareResult[]>();
    sortedResults.forEach(result => {
      const sheetName = result.newRequirement.categories[0] || 'unknown';
      if (!grouped.has(sheetName)) {
        grouped.set(sheetName, []);
      }
      grouped.get(sheetName)!.push(result);
    });
    
    return grouped;
  }, [filteredResults]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Jämföra krav</h1>
          <p className="text-muted-foreground">
            Importera en ny fil och jämför krav mot tidigare identifierade krav.
          </p>
        </div>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ladda upp ny kravfil för jämförelse
          </CardTitle>
          <CardDescription>
            Välj en Excel-fil med krav som ska jämföras mot tidigare importerade krav.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="file" className="text-sm font-medium">
              Excel-fil
            </label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid="input-compare-file"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="organization" className="text-sm font-medium">
              Organisation
            </label>
            <Input
              id="organization"
              type="text"
              placeholder="Ange organisationens namn..."
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              disabled={isUploading}
              data-testid="input-compare-organization"
            />
          </div>

          <Button
            onClick={handleUploadAndCompare}
            disabled={!uploadedFile || !organization.trim() || isUploading}
            className="w-full"
            data-testid="button-start-compare"
          >
            {isUploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Jämför krav...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Starta jämförelse
              </>
            )}
          </Button>

          {existingRequirements.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Jämförelsen kommer att göras mot {existingRequirements.length} tidigare identifierade krav.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {compareResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Jämförelseresultat ({compareResults.length} krav)
              </CardTitle>
              <div className="flex items-center gap-4">
                {/* Save to Database Button */}
                <Button
                  onClick={handleSaveToDatabase}
                  disabled={isSavingToDatabase || !uploadedFile || !organization}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-save-to-database"
                >
                  {isSavingToDatabase ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Sparar till databas...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Spara till databas ({requirementChanges.size} ändringar)
                    </>
                  )}
                </Button>
                
                {/* Search */}
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input
                    placeholder="Sök i krav..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                    data-testid="input-search-results"
                  />
                </div>
              </div>
            </div>
            <CardDescription>
              Krav visas i exakt samma ordning som i den uppladdade Excel-filen.
              {requirementChanges.size > 0 && (
                <span className="text-blue-600 font-medium">
                  {' '}Du har gjort {requirementChanges.size} ändringar som kan sparas till databasen.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(() => {
              const elements: JSX.Element[] = [];
              
              Array.from(groupedResults.entries()).forEach(([sheetName, sheetResults]) => {
                const totalPages = getTotalPages(sheetResults);
                const currentPage = getCurrentPage(sheetName, totalPages);
                const paginatedResults = getPaginatedSheetResults(sheetName, sheetResults);
                
                // Sheet header with pagination info
                elements.push(
                  <div key={`sheet-header-${sheetName}`} className="space-y-4">
                    {/* Sheet separator */}
                    <div className="flex items-center gap-4 py-2">
                      <div className="flex-1 h-px bg-border"></div>
                      <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg border-l-4 border-blue-500">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Flik: {sheetName}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {sheetResults.length} krav totalt
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                    
                    {/* Pagination controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-2 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Sida {currentPage} av {totalPages}</span>
                          <span>•</span>
                          <span>Visar {paginatedResults.length} av {sheetResults.length} krav</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSheetPage(sheetName, currentPage - 1)}
                            disabled={currentPage === 1}
                            data-testid={`button-prev-page-${sheetName}`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSheetPage(sheetName, currentPage + 1)}
                            disabled={currentPage === totalPages}
                            data-testid={`button-next-page-${sheetName}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                
                // Requirement cards for current page
                const cardElements = paginatedResults.map(result => {
                  const requirementKey = getRequirementKey(result);
                  return (
                    <CompareResultCard 
                      key={requirementKey}
                      result={result} 
                      getStatusIcon={getStatusIcon}
                      onSaveChanges={handleSaveChanges}
                      requirementKey={requirementKey}
                    />
                  );
                });
                
                elements.push(
                  <div key={`sheet-cards-${sheetName}`} className="space-y-3">
                    {cardElements}
                  </div>
                );
              });
              
              return elements;
            })()}
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {compareResults.length === 0 && !isUploading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <GitCompare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Jämför nya krav</h3>
                <p className="text-muted-foreground">
                  Ladda upp en Excel-fil för att jämföra dess krav mot tidigare identifierade krav och se historik.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CompareResultCardProps {
  result: CompareResult;
  getStatusIcon: (status: string) => JSX.Element;
  onSaveChanges: (requirementKey: string, comment: string, status: string) => void;
  requirementKey: string;
}

function CompareResultCard({ result, getStatusIcon, onSaveChanges, requirementKey }: CompareResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('OK');
  const [isSaving, setIsSaving] = useState(false);

  // Get the most recent status from matched requirements based on date
  const getMostRecentStatus = () => {
    if (result.matchedRequirements.length === 0) return 'OK';
    
    const mostRecent = result.matchedRequirements.reduce((latest, req) => {
      const reqDate = new Date(req.import_date || '');
      const latestDate = new Date(latest.import_date || '');
      return reqDate > latestDate ? req : latest;
    });
    
    return mostRecent.user_status || 'OK';
  };

  // Initialize status with most recent using useEffect
  useEffect(() => {
    setNewStatus(getMostRecentStatus());
  }, [result.matchedRequirements]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveChanges(requirementKey, newComment.trim(), newStatus);
      setNewComment(''); // Clear comment after saving
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions = [
    { value: 'OK', label: 'OK' },
    { value: 'Granskas', label: 'Granskas' },
    { value: 'Godkänd', label: 'Godkänd' },
    { value: 'Avvisad', label: 'Avvisad' },
    { value: 'Behöver förtydligande', label: 'Behöver förtydligande' }
  ];

  return (
    <Card className={`${result.isIdentical ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* New Requirement */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Badge variant={result.isIdentical ? 'default' : 'outline'}>
                {result.isIdentical ? 'Identiskt' : 'Liknande'}
              </Badge>
              <Badge variant="secondary">
                {result.newRequirement.requirement_type}
              </Badge>
              {result.newRequirement.categories.map((category, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
            
            <p className="text-sm leading-relaxed font-medium">
              {result.newRequirement.text}
            </p>
          </div>

          {/* Matched Requirements Summary */}
          {result.matchedRequirements.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-auto p-0 font-normal justify-start"
                data-testid={`button-expand-matches-${result.newRequirement.originalIndex}`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Hittades {result.matchedRequirements.length} gång(er) tidigare
                {expanded ? ' (göm)' : ' (visa)'}
              </Button>

              {expanded && (
                <div className="mt-3 space-y-2">
                  {result.matchedRequirements.map((req, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm mb-2">{req.text}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{req.organizations?.join(', ')}</span>
                            <span>•</span>
                            <span>{new Date(req.import_date || '').toLocaleDateString('sv-SE')}</span>
                            <span>•</span>
                            <span>{req.occurrences} förekomster</span>
                          </div>
                          {req.user_comment && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                              <strong>Kommentar:</strong> {req.user_comment}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(req.user_status || 'OK')}
                          <span className="text-xs">{req.user_status || 'OK'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editable Comment and Status Section */}
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Lägg till kommentar och sätt status</h4>
            
            <div className="space-y-3">
              {/* Comment Input */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Kommentar</label>
                <Textarea
                  placeholder="Ange din kommentar för detta krav..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                  data-testid={`textarea-comment-${result.newRequirement.originalIndex}`}
                />
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Status</label>
                <Select 
                  value={newStatus} 
                  onValueChange={setNewStatus}
                >
                  <SelectTrigger 
                    className="text-sm"
                    data-testid={`select-status-${result.newRequirement.originalIndex}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="w-full"
                data-testid={`button-save-changes-${result.newRequirement.originalIndex}`}
              >
                {isSaving ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Sparar...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Spara ändringar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ComparePage;