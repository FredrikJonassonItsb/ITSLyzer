import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users, Calendar, Building, MessageSquare, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Requirement } from '@shared/schema';

interface RequirementsTableProps {
  requirements: Requirement[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function RequirementsTable({ requirements, isLoading, onRefresh }: RequirementsTableProps) {
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

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
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

  return (
    <div className="space-y-4">
      {requirements.map((req) => (
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
                      variant={getTypeVariant(req.requirement_type)}
                      data-testid={`badge-type-${req.id}`}
                    >
                      {req.requirement_type}
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
      ))}
    </div>
  );
}