import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, Users, Calendar, Building, MessageSquare, CheckCircle, AlertCircle, Clock, Trash2, Brain } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Requirement } from '@shared/schema';

interface RequirementsTableProps {
  requirements: Requirement[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function RequirementsTable({ requirements, isLoading, onRefresh }: RequirementsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [statusValue, setStatusValue] = useState('');

  const queryClient = useQueryClient();

  // Update requirement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Requirement> }) => {
      const response = await fetch(`/api/requirements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update requirement');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      onRefresh?.();
    }
  });

  // Delete requirement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/requirements/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete requirement');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      onRefresh?.();
    }
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const startEditComment = (req: Requirement) => {
    setEditingComment(req.id);
    setCommentText(req.user_comment || '');
  };

  const saveComment = async (id: string) => {
    await updateMutation.mutateAsync({
      id,
      updates: { user_comment: commentText }
    });
    setEditingComment(null);
    setCommentText('');
  };

  const cancelEditComment = () => {
    setEditingComment(null);
    setCommentText('');
  };

  const startEditStatus = (req: Requirement) => {
    setEditingStatus(req.id);
    setStatusValue(req.user_status || 'OK');
  };

  const saveStatus = async (id: string) => {
    await updateMutation.mutateAsync({
      id,
      updates: { user_status: statusValue }
    });
    setEditingStatus(null);
  };

  const cancelEditStatus = () => {
    setEditingStatus(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Under utveckling': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Senare': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeVariant = (type: string) => {
    return type === 'Skall' ? 'destructive' : 'secondary';
  };

  // Gruppera krav efter group_id
  const groupedRequirements = () => {
    const groups = new Map<string, Requirement[]>();
    const ungrouped: Requirement[] = [];

    requirements.forEach(req => {
      if (req.group_id) {
        if (!groups.has(req.group_id)) {
          groups.set(req.group_id, []);
        }
        groups.get(req.group_id)!.push(req);
      } else {
        ungrouped.push(req);
      }
    });

    return { groups, ungrouped };
  };

  // Hitta representativ text för en grupp (mest vanliga eller från group_representative)
  const getGroupRepresentativeText = (groupRequirements: Requirement[]) => {
    // Först, försök hitta den som är markerad som group_representative
    const representative = groupRequirements.find(req => req.group_representative);
    if (representative) {
      return representative.text;
    }

    // Annars ta den första (de är redan sorterade efter relevans)
    return groupRequirements[0]?.text || 'Ingen text tillgänglig';
  };

  // Räkna statistik för en grupp
  const getGroupStats = (groupRequirements: Requirement[]) => {
    const totalReqs = groupRequirements.length;
    const mustReqs = groupRequirements.filter(req => req.requirement_type === 'Skall').length;
    const shouldReqs = groupRequirements.filter(req => req.requirement_type === 'Bör').length;
    const newReqs = groupRequirements.filter(req => req.is_new).length;

    return { totalReqs, mustReqs, shouldReqs, newReqs };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (requirements.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Inga krav att visa med nuvarande filter.</p>
        </CardContent>
      </Card>
    );
  }

  // Organisera kraven i grupper
  const { groups, ungrouped } = groupedRequirements();

  // Funktion för att rendera individuella krav
  const renderRequirement = (req: Requirement) => (
    <Card key={req.id} className="relative">
      <CardContent className="p-0">
        <div className="p-4">
          {/* Header Row */}
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(req.id)}
              className="mt-1 p-1 h-6 w-6"
              data-testid={`button-expand-${req.id}`}
            >
              {expandedRows.has(req.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex-1 space-y-3">
              {/* Requirement Text */}
              <div>
                <p className="text-sm leading-relaxed" data-testid={`text-requirement-${req.id}`}>
                  {req.text}
                </p>
              </div>
              
              {/* Badges and Info */}
              <div className="flex items-center flex-wrap gap-2">
                <Badge 
                  variant={getTypeVariant(req.requirement_type || 'Skall')}
                  data-testid={`badge-type-${req.id}`}
                >
                  {req.requirement_type || 'Skall'}
                </Badge>
                
                {req.group_id && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    Grupp {req.group_id.slice(-4)}
                  </Badge>
                )}
                
                {req.is_new && (
                  <Badge variant="secondary">NYA</Badge>
                )}
                
                {req.occurrences > 1 && (
                  <Badge variant="outline">
                    {req.occurrences} förekomster
                  </Badge>
                )}
              </div>
            </div>

            {/* Status Column */}
            <div className="flex flex-col items-end gap-2 min-w-[120px]">
              {editingStatus === req.id ? (
                <div className="space-y-2">
                  <Select value={statusValue} onValueChange={setStatusValue}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">OK</SelectItem>
                      <SelectItem value="Under utveckling">Under utveckling</SelectItem>
                      <SelectItem value="Senare">Senare</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      onClick={() => saveStatus(req.id)}
                      disabled={updateMutation.isPending}
                    >
                      Spara
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={cancelEditStatus}
                    >
                      Avbryt
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditStatus(req)}
                    className="flex items-center gap-2 h-auto p-2"
                    data-testid={`button-status-${req.id}`}
                  >
                    {getStatusIcon(req.user_status || 'OK')}
                    <span className="text-xs">{req.user_status || 'OK'}</span>
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleteMutation.isPending}
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-delete-${req.id}`}
                        title="Ta bort krav"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bekräfta borttagning</AlertDialogTitle>
                        <AlertDialogDescription>
                          Är du säker på att du vill ta bort detta krav? Denna åtgärd kan inte ångras.
                          <br /><br />
                          <strong>Krav:</strong> {req.text.length > 100 ? req.text.substring(0, 100) + '...' : req.text}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(req.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid={`button-confirm-delete-${req.id}`}
                        >
                          Ta bort
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          <Collapsible open={expandedRows.has(req.id)}>
            <CollapsibleContent className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Details */}
                <div className="space-y-4">
                  {/* Organizations */}
                  {req.organizations && req.organizations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Building className="h-4 w-4" />
                        Organisationer ({req.organizations.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {req.organizations.map(org => (
                          <Badge key={org} variant="outline" className="text-xs">
                            {org}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categories */}
                  {req.categories && req.categories.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Kategorier</h4>
                      <div className="flex flex-wrap gap-1">
                        {req.categories.map(cat => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  {req.dates && req.dates.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4" />
                        Datum
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {req.dates.map(date => (
                          <Badge key={date} variant="outline" className="text-xs">
                            {date}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statistics */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Statistik</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                        <span className="font-medium">Skall:</span> {req.must_count}
                      </div>
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                        <span className="font-medium">Bör:</span> {req.should_count}
                      </div>
                      <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                        <span className="font-medium">Uppfyllt:</span> {req.fulfilled_yes}
                      </div>
                      <div className="p-2 bg-gray-50 dark:bg-gray-950 rounded">
                        <span className="font-medium">Ej uppfyllt:</span> {req.fulfilled_no}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Comments */}
                <div className="space-y-4">
                  {/* Sample Response */}
                  {req.sample_response && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Exempel på svar</h4>
                      <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
                        {req.sample_response}
                      </p>
                    </div>
                  )}

                  {/* User Comment */}
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      Kommentar
                    </h4>
                    
                    {editingComment === req.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Lägg till kommentar..."
                          className="min-h-20"
                          data-testid={`textarea-comment-${req.id}`}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => saveComment(req.id)}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-comment-${req.id}`}
                          >
                            Spara
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={cancelEditComment}
                          >
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEditComment(req)}
                        className="min-h-20 p-3 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                        data-testid={`div-comment-${req.id}`}
                      >
                        {req.user_comment ? (
                          <p className="text-sm">{req.user_comment}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Klicka för att lägga till kommentar...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* AI-grupperade krav */}
      {Array.from(groups.entries()).map(([groupId, groupRequirements]) => {
        const representativeText = getGroupRepresentativeText(groupRequirements);
        const stats = getGroupStats(groupRequirements);
        const isExpanded = expandedGroups.has(groupId);
        
        return (
          <Card key={groupId} className="relative border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroupExpanded(groupId)}
                    className="mt-1 p-1 h-6 w-6"
                    data-testid={`button-expand-group-${groupId}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-base">
                        AI-Grupp {groupId.slice(-4)}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {stats.totalReqs} krav
                      </Badge>
                    </div>
                    
                    {/* Representativ text */}
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {representativeText}
                    </p>
                    
                    {/* Grupp-statistik */}
                    <div className="flex items-center flex-wrap gap-2">
                      {stats.mustReqs > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {stats.mustReqs} Skall
                        </Badge>
                      )}
                      {stats.shouldReqs > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {stats.shouldReqs} Bör
                        </Badge>
                      )}
                      {stats.newReqs > 0 && (
                        <Badge variant="outline" className="text-xs text-green-600">
                          {stats.newReqs} Nya
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <Collapsible open={isExpanded}>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {groupRequirements.map(req => renderRequirement(req))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Ej grupperade krav */}
      {ungrouped.length > 0 && (
        <Card className="relative border-l-4 border-l-gray-400">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-600" />
              <CardTitle className="text-base">Ej grupperade krav</CardTitle>
              <Badge variant="outline" className="text-xs">
                {ungrouped.length} krav
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-4">
              {ungrouped.map(req => renderRequirement(req))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}