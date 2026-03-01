"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Message...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t p-4">
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-xl border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        {isStreaming ? (
          <Button onClick={onStop} variant="destructive" size="icon">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!input.trim()} size="icon">
            <SendHorizonal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
