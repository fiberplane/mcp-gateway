import type {
  ConversationSummary,
  TimelineEvent,
} from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useHandler } from "../lib/use-handler";
import { Badge } from "./ui/badge";
import { ColorPill } from "./ui/color-pill";
import { EmptyState } from "./ui/empty-state";
import { LoadingIndicator } from "./ui/loading-indicator";

/**
 * Conversations component - displays LLM-MCP correlation data
 *
 * Shows list of conversations with ability to drill into timeline
 */
export function Conversations() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  // Fetch conversations list
  const {
    data: conversationsData,
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 5000, // Poll for updates
  });

  // Fetch timeline for selected conversation
  const {
    data: timelineData,
    isLoading: isLoadingTimeline,
    error: timelineError,
  } = useQuery({
    queryKey: ["conversation-timeline", selectedConversationId],
    queryFn: () => api.getConversationTimeline(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  const handleSelectConversation = useHandler((conversationId: string) => {
    setSelectedConversationId(conversationId);
  });

  const handleBackToList = useHandler(() => {
    setSelectedConversationId(null);
  });

  if (isLoadingConversations) {
    return (
      <div className="flex items-center justify-center p-10">
        <LoadingIndicator />
      </div>
    );
  }

  if (conversationsError) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
        Error loading conversations: {String(conversationsError)}
      </div>
    );
  }

  const conversations = conversationsData?.conversations ?? [];

  // Timeline view
  if (selectedConversationId) {
    if (isLoadingTimeline) {
      return (
        <div className="flex items-center justify-center p-10">
          <LoadingIndicator />
        </div>
      );
    }

    if (timelineError) {
      return (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          Error loading timeline: {String(timelineError)}
        </div>
      );
    }

    return (
      <ConversationTimeline
        conversationId={selectedConversationId}
        events={timelineData?.events ?? []}
        onBack={handleBackToList}
      />
    );
  }

  // List view
  return (
    <div className="bg-card rounded-lg border border-border">
      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Conversations will appear here when LLM requests are correlated with MCP tool calls"
        />
      ) : (
        <div className="divide-y divide-border">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.conversationId}
              conversation={conversation}
              onClick={() =>
                handleSelectConversation(conversation.conversationId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single conversation list item
 */
function ConversationListItem({
  conversation,
  onClick,
}: {
  conversation: ConversationSummary;
  onClick: () => void;
}) {
  const startDate = new Date(conversation.startTime);
  const endDate = new Date(conversation.endTime);
  const duration = endDate.getTime() - startDate.getTime();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-4 text-left hover:bg-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-muted-foreground truncate">
              {conversation.conversationId.slice(0, 8)}
            </span>
            {conversation.provider && (
              <Badge variant="secondary" className="shrink-0">
                {conversation.provider}
              </Badge>
            )}
            {conversation.model && (
              <span className="text-xs text-muted-foreground truncate">
                {conversation.model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{startDate.toLocaleString()}</span>
            <span>•</span>
            <span>{(duration / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-medium">
              {conversation.llmRequestCount}
            </div>
            <div className="text-xs text-muted-foreground">LLM</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              {conversation.mcpCallCount}
            </div>
            <div className="text-xs text-muted-foreground">MCP</div>
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * Conversation timeline view
 */
function ConversationTimeline({
  conversationId,
  events,
  onBack,
}: {
  conversationId: string;
  events: TimelineEvent[];
  onBack: () => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Conversation Timeline</h2>
        <span className="text-sm font-mono text-muted-foreground">
          {conversationId.slice(0, 8)}
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events"
          description="This conversation has no events"
        />
      ) : (
        <div className="p-3">
          <div className="space-y-1.5">
            {events.map((event, index) => (
              <TimelineEventItem key={index} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single timeline event item
 */
function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timestamp = new Date(event.timestamp);

  // Get event type color
  const getEventColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "llm-request":
        return "blue";
      case "llm-response":
        return "green";
      case "mcp-call":
        return "purple";
    }
  };

  // Get event label and details
  const getEventInfo = (event: TimelineEvent) => {
    switch (event.type) {
      case "llm-request":
        return {
          label: "LLM Request",
          details: null,
        };
      case "llm-response": {
        const data = event.data as any;
        const tokens = (data.inputTokens || 0) + (data.outputTokens || 0);
        const duration = data.durationMs;
        return {
          label: "LLM Response",
          details: [
            tokens > 0 && `${tokens} tokens`,
            duration && `${duration}ms`,
          ]
            .filter(Boolean)
            .join(" • "),
        };
      }
      case "mcp-call": {
        const data = event.data as any;
        const method = data.method;
        const hasRequest = !!data.request;
        const hasResponse = !!data.response;
        const direction = hasRequest
          ? "Request"
          : hasResponse
            ? "Response"
            : "";
        const status = data.metadata?.httpStatus;
        const duration = data.metadata?.durationMs;

        return {
          label: "MCP Call",
          details: [
            method,
            direction,
            status && `${status}`,
            duration && `${duration}ms`,
          ]
            .filter(Boolean)
            .join(" • "),
        };
      }
    }
  };

  const eventInfo = getEventInfo(event);

  return (
    <div className="border border-border rounded">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ColorPill color={getEventColor(event.type)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{eventInfo.label}</div>
              {eventInfo.details && (
                <div className="text-xs text-muted-foreground truncate">
                  {eventInfo.details}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground shrink-0 font-mono">
              {timestamp.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                fractionalSecondDigits: 3,
              })}
            </div>
          </div>
          <div className="text-muted-foreground shrink-0 text-xs">
            {isExpanded ? "▼" : "▶"}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
