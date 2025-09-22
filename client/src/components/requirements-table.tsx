import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, MessageSquare, Edit, Check, X, Building, Calendar, Tag } from 'lucide-react';
import type { Requirement } from '@shared/schema';

interface RequirementsTableProps {
  requirements: Requirement[];
  onUpdateComment?: (id: string, comment: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  showGrouped?: boolean;
}

export function RequirementsTable({ 
  requirements, 
  onUpdateComment, 
  onUpdateStatus,
  showGrouped = false 
}: RequirementsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [commentValue, setCommentValue] = useState('');
  const [statusValue, setStatusValue] = useState('');

  // Group requirements if showGrouped is true
  const groupedRequirements = showGrouped 
    ? requirements.reduce((acc, req) => {
        const groupId = req.group_id || 'ungrouped';
        if (!acc[groupId]) acc[groupId] = [];
        acc[groupId].push(req);
        return acc;
      }, {} as Record<string, Requirement[]>)
    : { all: requirements };

  const toggleGroup = (groupId: string) => {
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
    setCommentValue(req.user_comment || '');
  };

  const startEditStatus = (req: Requirement) => {
    setEditingStatus(req.id);
    setStatusValue(req.user_status || 'OK');
  };

  const saveComment = (id: string) => {
    if (onUpdateComment) {
      onUpdateComment(id, commentValue);
    }
    setEditingComment(null);
    setCommentValue('');
  };

  const saveStatus = (id: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(id, statusValue);
    }
    setEditingStatus(null);
    setStatusValue('');
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditingStatus(null);
    setCommentValue('');
    setStatusValue('');
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'OK': return 'default';
      case 'Under utveckling': return 'secondary';
      case 'Senare': return 'outline';
      default: return 'default';
    }
  };

  const getRequirementTypeBadge = (type: string | null) => {
    switch (type) {
      case 'Skall': return <Badge variant="destructive">Skall</Badge>;
      case 'Bör': return <Badge variant="secondary">Bör</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedRequirements).map(([groupId, groupReqs]) => {
        const isExpanded = expandedGroups.has(groupId);
        const representativeReq = groupReqs.find(r => r.group_representative) || groupReqs[0];
        const groupSize = groupReqs.length;

        return (
          <Card key={groupId} className="w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showGrouped && groupId !== 'all' && groupSize > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleGroup(groupId)}
                      data-testid={`button-toggle-group-${groupId}`}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
                  <CardTitle className="text-base flex-1">
                    {showGrouped && groupId !== 'all' && groupSize > 1 
                      ? `Grupperat krav (${groupSize} varianter)` 
                      : 'Kravlista'}
                  </CardTitle>
                </div>
                {showGrouped && groupId !== 'all' && groupSize > 1 && (
                  <div className="flex gap-2">
                    {getRequirementTypeBadge(representativeReq.requirement_type)}
                    <Badge variant="outline">{groupSize} krav</Badge>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Show representative requirement or all requirements */}
              {(showGrouped && groupId !== 'all' && !isExpanded 
                ? [representativeReq] 
                : groupReqs
              ).map((req) => (
                <div key={req.id} className="border rounded-lg p-4 space-y-3" data-testid={`requirement-${req.id}`}>
                  {/* Requirement Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getRequirementTypeBadge(req.requirement_type)}
                        {req.is_new && <Badge variant="outline" className="text-xs">NY</Badge>}
                        <span className="text-sm text-muted-foreground">#{req.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{req.text}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {editingStatus === req.id ? (
                        <div className="flex items-center gap-2">
                          <Select value={statusValue} onValueChange={setStatusValue}>
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OK">OK</SelectItem>
                              <SelectItem value="Under utveckling">Under utveckling</SelectItem>
                              <SelectItem value="Senare">Senare</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" onClick={() => saveStatus(req.id)} data-testid={`button-save-status-${req.id}`}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit} data-testid={`button-cancel-status-${req.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge 
                          variant={getStatusBadgeVariant(req.user_status)}
                          className="cursor-pointer hover-elevate"
                          onClick={() => startEditStatus(req)}
                          data-testid={`badge-status-${req.id}`}
                        >
                          {req.user_status || 'OK'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Requirement Metadata */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      <span>Organisationer: {req.organizations.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Senast sedd: {req.last_seen_date || 'Okänd'}</span>
                    </div>
                    {req.requirement_category && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        <span>{req.requirement_category}</span>
                      </div>
                    )}
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-semibold">{req.occurrences}</div>
                      <div className="text-xs text-muted-foreground">Förekomster</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-semibold">{req.must_count}/{req.should_count}</div>
                      <div className="text-xs text-muted-foreground">Skall/Bör</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-semibold">{req.fulfilled_yes}</div>
                      <div className="text-xs text-muted-foreground">Uppfylls</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-semibold">{req.fulfilled_no}</div>
                      <div className="text-xs text-muted-foreground">Uppfylls ej</div>
                    </div>
                  </div>

                  {/* Historical Response */}
                  {req.sample_response && (
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Tidigare svar:</h4>
                      <p className="text-sm">{req.sample_response}</p>
                    </div>
                  )}

                  {/* User Comment */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Intern kommentar
                      </h4>
                      {!editingComment && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditComment(req)}
                          data-testid={`button-edit-comment-${req.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    {editingComment === req.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={commentValue}
                          onChange={(e) => setCommentValue(e.target.value)}
                          placeholder="Lägg till intern kommentar..."
                          rows={3}
                          data-testid={`textarea-comment-${req.id}`}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveComment(req.id)} data-testid={`button-save-comment-${req.id}`}>
                            Spara
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} data-testid={`button-cancel-comment-${req.id}`}>
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded min-h-[2rem] flex items-center">
                        {req.user_comment || 'Ingen kommentar tillagd...'}\n                      </p>
                    )}\n                  </div>\n                </div>\n              ))}\n            </CardContent>\n          </Card>\n        );\n      })}\n    </div>\n  );\n}\n\nexport default RequirementsTable;