import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Play, CheckCircle, AlertCircle, Clock, FileText, Users, BarChart3 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface GroupingResult {
  success: boolean;
  message: string;
  groups: any[];
  totalRequirements: number;
  groupedRequirements: number;
  ungroupedRequirements: number;
  summary: string;
}

export function AIGroupingPage() {
  const [isGrouping, setIsGrouping] = useState(false);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch requirements for grouping
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['/api/requirements/grouping'],
    enabled: true
  });

  // AI Grouping mutation
  const groupingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/requirements/grouping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI-gruppering misslyckades');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setGroupingResult(data);
      setIsGrouping(false);
      // Invalidate requirements cache to show updated groupings
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
    },
    onError: (error) => {
      console.error('AI grouping failed:', error);
      setIsGrouping(false);
    }
  });

  const startGrouping = async () => {
    setIsGrouping(true);
    setGroupingResult(null);
    groupingMutation.mutate();
  };

  const resetGrouping = () => {
    setGroupingResult(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">AI-gruppering av krav</h1>
        <p className="text-muted-foreground">
          Använd artificiell intelligens för att automatiskt gruppera liknande krav baserat på innehåll och funktionalitet.
        </p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tillgängliga krav</p>
                <p className="text-2xl font-bold" data-testid="stat-available">
                  {requirements.length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Redo för AI-analys
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Redan grupperade</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-grouped">
                  {requirements.filter(req => req.group_id).length}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Från tidigare körningar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ogrouperade</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-ungrouped">
                  {requirements.filter(req => !req.group_id).length}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Behöver analyseras
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Grouping Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            AI-driven kravgruppering
          </CardTitle>
          <CardDescription>
            Kör en AI-analys för att automatiskt identifiera och gruppera liknande krav. 
            Detta kan ta några minuter beroende på antalet krav.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isGrouping && !groupingResult && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Vad kommer att hända:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• AI analyserar textinnehållet i alla krav</li>
                  <li>• Identifierar liknande funktionalitet och teknikområden</li>
                  <li>• Grupperar krav med hög likhet tillsammans</li>
                  <li>• Väljer representativa krav för varje grupp</li>
                  <li>• Föreslår kategorier och betygsätter likhetsgrad</li>
                </ul>
              </div>

              <Button 
                onClick={startGrouping} 
                disabled={requirements.length === 0 || isLoading}
                className="w-full"
                data-testid="button-start-grouping"
              >
                <Play className="h-4 w-4 mr-2" />
                Starta AI-gruppering ({requirements.length} krav)
              </Button>
            </div>
          )}

          {isGrouping && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 animate-pulse text-primary" />
                <span className="font-medium">AI-analys pågår...</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Analyserar {requirements.length} krav</span>
                  <span>Detta kan ta 1-3 minuter</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                AI:n läser igenom alla krav och identifierar mönster och likheter...
              </p>
            </div>
          )}

          {groupingResult && (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">
                    AI-gruppering slutförd!
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {groupingResult.message}
                  </p>
                </div>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600" data-testid="result-groups">
                      {groupingResult.groups.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Grupper skapade</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600" data-testid="result-grouped">
                      {groupingResult.groupedRequirements}
                    </p>
                    <p className="text-sm text-muted-foreground">Krav grupperade</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600" data-testid="result-ungrouped">
                      {groupingResult.ungroupedRequirements}
                    </p>
                    <p className="text-sm text-muted-foreground">Kvar ogrouperade</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round((groupingResult.groupedRequirements / groupingResult.totalRequirements) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Grupperingsgrad</p>
                  </CardContent>
                </Card>
              </div>

              {/* AI Summary */}
              {groupingResult.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI-sammanfattning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="ai-summary">
                      {groupingResult.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Groups Details */}
              {groupingResult.groups && groupingResult.groups.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Identifierade grupper</CardTitle>
                    <CardDescription>
                      AI:n identifierade följande grupper av liknande krav:
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {groupingResult.groups.map((group, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{group.category || `Grupp ${index + 1}`}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {group.members?.length || 0} krav
                              </Badge>
                              <Badge variant="outline">
                                {group.similarityScore}% likhet
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Grupp-ID: {group.groupId}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button 
                  onClick={() => window.location.href = '/requirements?tab=grouped'}
                  className="flex-1"
                  data-testid="button-view-grouped"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Se grupperade krav
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={resetGrouping}
                  data-testid="button-run-again"
                >
                  Kör igen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      {requirements.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Inga krav att gruppera</h3>
                <p className="text-muted-foreground">
                  Du behöver importera krav innan AI-gruppering kan köras.
                </p>
              </div>
              <Button onClick={() => window.location.href = '/import'}>
                Importera krav först
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>Om AI-gruppering</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Så fungerar det:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Använder avancerad AI (GPT-5) för textanalys</li>
                <li>• Identifierar semantiska likheter mellan krav</li>
                <li>• Grupperar krav inom samma teknikområde</li>
                <li>• Skapar kategorier på svenska</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Fördelar:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Snabbare översikt över kravområden</li>
                <li>• Identifierar dubbletter och likheter</li>
                <li>• Hjälper med strukturerad analys</li>
                <li>• Sparar tid vid större kravsamlingar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIGroupingPage;