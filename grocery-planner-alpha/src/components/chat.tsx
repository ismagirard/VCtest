"use client";

import { useChat, type Message } from "ai/react";
import { useRef, useEffect, createElement } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SendHorizonal, Loader2, RotateCcw } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatProps {
  avatarBase64: string | null;
  firstName: string | null;
  lastName: string | null;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0]?.toUpperCase() || "";
  const l = lastName?.[0]?.toUpperCase() || "";
  return f + l || "?";
}

export function Chat({ avatarBase64, firstName, lastName }: ChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, reload, error } =
    useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] max-w-3xl mx-auto w-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🥕</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">{t("chat.heading")}</h1>
              <p className="text-muted-foreground max-w-md">
                {t("chat.description")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full max-w-lg">
              {[
                t("chat.suggestion1"),
                t("chat.suggestion2"),
                t("chat.suggestion3"),
                t("chat.suggestion4"),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    const fakeEvent = {
                      target: { value: suggestion },
                    } as React.ChangeEvent<HTMLTextAreaElement>;
                    handleInputChange(fakeEvent);
                    setTimeout(() => {
                      const form = document.getElementById("chat-form") as HTMLFormElement;
                      form?.requestSubmit();
                    }, 0);
                  }}
                  className="text-left text-sm border rounded-lg px-4 py-3 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message: Message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm">🥕</span>
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <FormattedMessage content={message.content} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <Avatar className="size-8">
                      <AvatarImage src={avatarBase64 ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(firstName, lastName)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm">🥕</span>
                  </div>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 justify-center text-sm text-destructive">
                <span>{t("chat.error")}</span>
                <Button variant="ghost" size="xs" onClick={() => reload()}>
                  <RotateCcw className="size-3" />
                  {t("chat.retry")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background px-4 py-3">
        <form
          id="chat-form"
          onSubmit={handleSubmit}
          className="flex items-end gap-2 max-w-3xl mx-auto"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground min-h-[44px] max-h-[120px]"
            style={{
              height: "auto",
              overflow: input.split("\n").length > 3 ? "auto" : "hidden",
            }}
            onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="rounded-xl h-[44px] w-[44px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizonal className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={elements.length}>
          {listItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    const olMatch = line.match(/^\d+[.)]\s+(.+)/);
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
    } else if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
    } else {
      flushList();
      if (headingMatch) {
        const level = headingMatch[1].length;
        const tag = `h${Math.min(level + 2, 6)}`;
        elements.push(
          createElement(
            tag,
            { key: elements.length, className: "font-semibold mt-3 mb-1" },
            formatInline(headingMatch[2])
          )
        );
      } else if (line.trim() === "") {
        elements.push(<br key={elements.length} />);
      } else {
        elements.push(<p key={elements.length}>{formatInline(line)}</p>);
      }
    }
  }
  flushList();

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
