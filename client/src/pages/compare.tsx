import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, GitCompare, Search, FileText, MessageSquare, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Requirement } from '@shared/schema';

interface CompareResult {
  newRequirement: {
    text: string;
    requirement_type: string;
    categories: string[];
    originalIndex: number;
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

  const queryClient = useQueryClient();

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
            <CardDescription>
              Krav visas i den ordning de fanns i ursprungsfilen. Identiska krav visas först.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredResults
              .sort((a, b) => {
                // Show identical matches first
                if (a.isIdentical && !b.isIdentical) return -1;
                if (!a.isIdentical && b.isIdentical) return 1;
                // Then by original file order
                return a.newRequirement.originalIndex - b.newRequirement.originalIndex;
              })
              .map((result, index) => (
                <CompareResultCard 
                  key={index} 
                  result={result} 
                  getStatusIcon={getStatusIcon}
                />
              ))
            }
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
}

function CompareResultCard({ result, getStatusIcon }: CompareResultCardProps) {
  const [expanded, setExpanded] = useState(false);

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
                            <span>{new Date(req.import_date).toLocaleDateString('sv-SE')}</span>
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
        </div>
      </CardContent>
    </Card>
  );
}

export default ComparePage;