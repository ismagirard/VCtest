"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { LoadingMascot } from "./loading-mascot";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, X, Menu, Trash2, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}

interface ChatInterfaceProps {
  initialConversations: Conversation[];
}

function groupConversationsByDate(
  conversations: Conversation[]
): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const buckets: Record<string, Conversation[]> = {
    today: [],
    yesterday: [],
    previous7: [],
    previous30: [],
    older: [],
  };

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) buckets.today.push(conv);
    else if (d >= yesterday) buckets.yesterday.push(conv);
    else if (d >= sevenDaysAgo) buckets.previous7.push(conv);
    else if (d >= thirtyDaysAgo) buckets.previous30.push(conv);
    else buckets.older.push(conv);
  }

  const result: ConversationGroup[] = [];
  if (buckets.today.length)
    result.push({
      label: t("chat.dateGroup.today"),
      conversations: buckets.today,
    });
  if (buckets.yesterday.length)
    result.push({
      label: t("chat.dateGroup.yesterday"),
      conversations: buckets.yesterday,
    });
  if (buckets.previous7.length)
    result.push({
      label: t("chat.dateGroup.previous7"),
      conversations: buckets.previous7,
    });
  if (buckets.previous30.length)
    result.push({
      label: t("chat.dateGroup.previous30"),
      conversations: buckets.previous30,
    });
  if (buckets.older.length)
    result.push({
      label: t("chat.dateGroup.older"),
      conversations: buckets.older,
    });

  return result;
}

export function ChatInterface({ initialConversations }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState(initialConversations);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pendingTitleRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Create transport with custom fetch to capture conversation ID from headers
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: conversationIdRef.current,
        }),
        fetch: async (url, options) => {
          const response = await globalThis.fetch(
            url as string,
            options as RequestInit
          );
          // Capture conversation ID from response header (for new conversations)
          const newConvId = response.headers.get("X-Conversation-Id");
          if (newConvId && !conversationIdRef.current) {
            conversationIdRef.current = newConvId;
            setConversationId(newConvId);
            // Add to sidebar
            const title =
              pendingTitleRef.current ?? t("chat.newConversation");
            setConversations((prev) => [
              {
                id: newConvId,
                title,
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ]);
            pendingTitleRef.current = null;
          }
          return response;
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load a past conversation
  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${id}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    setConversationId(id);
    conversationIdRef.current = id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uiMessages = conversation.messages.map((msg: Record<string, any>) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: msg.parts,
    }));
    setMessages(uiMessages);
    setSidebarOpen(false);
  };

  // Start a new conversation
  const newConversation = useCallback(() => {
    setConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setSidebarOpen(false);
  }, [setMessages]);

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (conversationId === id) {
            newConversation();
          }
        }
      } finally {
        setDeletingId(null);
      }
    },
    [conversationId, newConversation]
  );

  const handleSend = (text: string) => {
    // Store the text for sidebar title (before the message is sent)
    if (!conversationIdRef.current) {
      pendingTitleRef.current = text.slice(0, 60);
    }
    sendMessage({ text });
  };

  const isStreaming = status === "streaming" || status === "submitted";

  // Show thinking mascot when streaming but no assistant content yet
  const showThinking =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user";

  const groups = groupConversationsByDate(conversations);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-[73px] left-3 z-40 p-1.5 rounded-lg bg-background border shadow-sm"
        aria-label="Open sidebar"
      >
        <Menu className="size-5" />
      </button>

      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "w-64 border-r bg-muted/30 flex flex-col h-full shrink-0 z-50",
          "fixed md:relative inset-y-0 left-0 md:inset-auto",
          "transition-transform duration-200 ease-out",
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Sidebar header */}
        <div className="p-3 flex items-center gap-2">
          <Button
            onClick={newConversation}
            variant="outline"
            className="flex-1 justify-start gap-2 text-sm"
          >
            <Plus className="size-4" />
            {t("chat.newConversation")}
          </Button>
          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Grouped conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {groups.map((group) => (
            <div key={group.label} className="mt-4 first:mt-0">
              {/* Group label */}
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              {/* Conversations */}
              <div className="space-y-0.5">
                {group.conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group relative w-full rounded-lg transition-colors",
                      conversationId === conv.id
                        ? "bg-accent"
                        : "hover:bg-muted"
                    )}
                  >
                    <button
                      onClick={() => loadConversation(conv.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs flex items-center gap-2 pr-8",
                        conversationId === conv.id
                          ? "text-accent-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      <MessageSquare className="size-3 shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </button>
                    {/* Delete button — appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      disabled={deletingId === conv.id}
                      className={cn(
                        "absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
                        deletingId === conv.id && "opacity-100"
                      )}
                      aria-label={t("chat.deleteConversation")}
                    >
                      {deletingId === conv.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <h2 className="text-lg font-semibold mb-1">
                  {t("chat.welcome")}
                </h2>
                <p className="text-sm max-w-md">
                  {t("chat.welcomeSubtext")}
                </p>
              </div>
            </div>
          ) : (
            <MessageList messages={messages} isStreaming={isStreaming} />
          )}
          {/* Thinking mascot — before first assistant token */}
          {showThinking && (
            <div className="max-w-3xl mx-auto mt-4">
              <LoadingMascot text={`${t("chat.thinking")}...`} size="md" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          placeholder={t("chat.placeholder")}
        />
      </div>
    </div>
  );
}
