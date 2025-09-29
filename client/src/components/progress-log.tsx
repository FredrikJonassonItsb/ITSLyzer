import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProgressMessage {
  type: string;
  message: string;
  step?: number;
  total?: number;
  timestamp: string;
}

interface ProgressLogProps {
  isGrouping: boolean;
  onComplete?: () => void;
}

export function ProgressLog({ isGrouping, onComplete }: ProgressLogProps) {
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isGrouping) {
      setMessages([]);
      setIsConnected(false);
      return;
    }

    // Connect to SSE endpoint
    const eventSource = new EventSource('/api/requirements/grouping/progress');
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressMessage = JSON.parse(event.data);
        
        // Skip heartbeat messages
        if (data.type === 'heartbeat') return;
        
        setMessages(prev => {
          const newMessages = [...prev, data];
          // Keep only the last 3 messages for clean UI
          return newMessages.slice(-3);
        });

        // If process is complete, notify parent
        if (data.type === 'success' || data.type === 'error') {
          setTimeout(() => {
            onComplete?.();
          }, 2000); // Give user time to see final message
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection failed');
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [isGrouping, onComplete]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'start': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'retry': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'info': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'start': return '🚀';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'retry': return '🔄';
      case 'progress': return '⏳';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  if (!isGrouping && messages.length === 0) {
    return null;
  }

  return (
    <Card className="w-full" data-testid="card-progress-log">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium" data-testid="text-progress-title">
            AI-gruppering Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge variant="outline" className="text-xs" data-testid="badge-connection-status">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Ansluten
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-24">
          <div className="space-y-2">
            {messages.length === 0 && isGrouping && (
              <div className="text-sm text-muted-foreground italic" data-testid="text-waiting-progress">
                Väntar på progress-uppdateringar...
              </div>
            )}
            {messages.map((message, index) => (
              <div 
                key={`${message.timestamp}-${index}`} 
                className="flex items-start gap-2 text-sm"
                data-testid={`row-progress-message-${index}`}
              >
                <span className="text-base leading-none mt-0.5">
                  {getTypeIcon(message.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground leading-tight break-words">
                      {message.message}
                    </span>
                    {message.step && message.total && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs px-1.5 py-0.5 ${getTypeColor(message.type)}`}
                        data-testid={`badge-progress-step-${index}`}
                      >
                        {message.step}/{message.total}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(message.timestamp).toLocaleTimeString('sv-SE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}