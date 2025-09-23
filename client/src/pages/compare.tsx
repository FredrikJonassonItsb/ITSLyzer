import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  aiGroupedRequirements?: Requirement[];
}

export function ComparePage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [organization, setOrganization] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [requirementChanges, setRequirementChanges] = useState<Map<string, { comment: string; status: string }>>(new Map());
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(''); // Currently active sheet tab

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



  // Reset active tab when results change
  useEffect(() => {
    setActiveTab('');
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

  // Set default active tab when results change
  useEffect(() => {
    if (compareResults.length > 0 && !activeTab) {
      const firstSheetName = Array.from(groupedResults.keys())[0];
      setActiveTab(firstSheetName || '');
    }
  }, [compareResults, activeTab, groupedResults]);

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
        <div className="p-6 pb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ladda upp ny kravfil för jämförelse
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Välj en Excel-fil med krav som ska jämföras mot tidigare importerade krav.
          </p>
        </div>
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
        <div className="bg-card border rounded-lg shadow-sm">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Jämförelseresultat ({compareResults.length} krav)
              </h2>
              <div className="flex items-center gap-4">
                {/* Save to Database Button */}
                <Button
                  onClick={handleSaveToDatabase}
                  disabled={isSavingToDatabase || !uploadedFile || !organization}
                  variant="default"
                  className="bg-green-600 dark:bg-green-700"
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
            <p className="text-sm text-muted-foreground mt-2">
              Krav visas i exakt samma ordning som i den uppladdade Excel-filen.
              {requirementChanges.size > 0 && (
                <span className="text-blue-600 font-medium">
                  {' '}Du har gjort {requirementChanges.size} ändringar som kan sparas till databasen.
                </span>
              )}
            </p>
          </div>
          <div className="px-6 pb-6 space-y-6">
            {/* Tab Navigation */}
            {groupedResults.size > 0 && (
              <div className="flex flex-wrap gap-2 border-b pb-4">
                {Array.from(groupedResults.entries()).map(([sheetName, sheetResults]) => (
                  <Button
                    key={sheetName}
                    variant={activeTab === sheetName ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(sheetName)}
                    className="flex items-center gap-2"
                    data-testid={`tab-${sheetName}`}
                  >
                    <FileText className="h-4 w-4" />
                    {sheetName}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {sheetResults.length}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}

            {/* Active Tab Content */}
            {activeTab && groupedResults.has(activeTab) && (
              <div className="space-y-4">
                {/* Sheet Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Flik: {activeTab}
                    </span>
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      {groupedResults.get(activeTab)?.length || 0} krav totalt
                    </span>
                  </div>
                </div>

                {/* All Requirements for Active Tab */}
                <div className="space-y-3">
                  {groupedResults.get(activeTab)?.map(result => {
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
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
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
    <Card className={`${result.isIdentical ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'} hover-elevate transition-all duration-200`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header with badges and requirement text */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={result.isIdentical ? 'default' : 'outline'} className="text-xs">
                {result.isIdentical ? 'Identiskt' : 'Liknande'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {result.newRequirement.requirement_type}
              </Badge>
              {result.matchedRequirements.length > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {result.matchedRequirements.length} träff{result.matchedRequirements.length > 1 ? 'ar' : ''}
                </Badge>
              )}
              <div className="flex-1"></div>
              {result.newRequirement.categories.slice(0, 1).map((category, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
            
            <p className="text-sm leading-snug font-medium text-gray-900 dark:text-gray-100">
              {result.newRequirement.text}
            </p>
          </div>

          {/* Matched Requirements Summary */}
          {result.matchedRequirements.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="font-medium text-blue-700 dark:text-blue-300"
                data-testid={`button-expand-matches-${result.newRequirement.originalIndex}`}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {result.matchedRequirements.length} tidigare träff{result.matchedRequirements.length > 1 ? 'ar' : ''}
                {expanded ? ' ↑' : ' ↓'}
              </Button>

              {expanded && (
                <div className="mt-2 space-y-1">
                  {result.matchedRequirements.map((req, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-md p-2 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs mb-1 text-gray-800 dark:text-gray-200 line-clamp-2">{req.text}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                            <span className="truncate">{req.organizations?.slice(0, 1).join(', ')}{req.organizations && req.organizations.length > 1 ? '...' : ''}</span>
                            <span>•</span>
                            <span>{new Date(req.import_date || '').toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</span>
                            <span>•</span>
                            <span>{req.occurrences}x</span>
                          </div>
                          {req.user_comment && (
                            <div className="mt-1 p-1 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                              <span className="text-blue-800 dark:text-blue-200">{req.user_comment}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {getStatusIcon(req.user_status || 'OK')}
                          <span className="text-xs font-medium">{req.user_status || 'OK'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI-Grouped Similar Requirements */}
          {!result.isIdentical && result.aiGroupedRequirements && result.aiGroupedRequirements.length > 0 && (
            <div className="border-t border-yellow-200 dark:border-yellow-700 pt-2 bg-yellow-50/50 dark:bg-yellow-950/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                    AI-grupperade liknande krav
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {result.aiGroupedRequirements.length} förslag
                </Badge>
              </div>
              
              <div className="space-y-1">
                {result.aiGroupedRequirements.slice(0, 3).map((req, i) => (
                  <div key={i} className="bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md p-2 border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs mb-1 text-yellow-900 dark:text-yellow-100 line-clamp-2">{req.text}</p>
                        <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-300 flex-wrap">
                          <span className="truncate">{req.organizations?.slice(0, 1).join(', ')}{req.organizations && req.organizations.length > 1 ? '...' : ''}</span>
                          <span>•</span>
                          <span>{new Date(req.import_date || '').toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</span>
                          {req.similarity_score && (
                            <>
                              <span>•</span>
                              <span>AI: {req.similarity_score}%</span>
                            </>
                          )}
                        </div>
                        {req.user_comment && (
                          <div className="mt-1 p-1 bg-yellow-200/50 dark:bg-yellow-800/30 rounded text-xs">
                            <span className="text-yellow-800 dark:text-yellow-200">{req.user_comment}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {getStatusIcon(req.user_status || 'OK')}
                        <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">{req.user_status || 'OK'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {result.aiGroupedRequirements.length > 3 && (
                  <div className="text-center pt-1">
                    <span className="text-xs text-yellow-700 dark:text-yellow-300">
                      +{result.aiGroupedRequirements.length - 3} fler liknande krav
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                💡 Dessa krav har identifierats som liknande av AI inom samma kategori
              </div>
            </div>
          )}

          {/* Editable Comment and Status Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {/* Comment Input */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Kommentar</label>
                <Textarea
                  placeholder="Ange kommentar..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                  data-testid={`textarea-comment-${result.newRequirement.originalIndex}`}
                />
              </div>

              {/* Status and Save in one row */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Status</label>
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

                {/* Compact Save Button */}
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  data-testid={`button-save-changes-${result.newRequirement.originalIndex}`}
                >
                  {isSaving ? (
                    <>
                      <Clock className="h-3 w-3 mr-1 animate-spin" />
                      Sparar
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Spara
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ComparePage;