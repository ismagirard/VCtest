"use client";

import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ProductCard, type ProductCardProps } from "./product-card";
import { LoadingMascot } from "./loading-mascot";
import { t } from "@/lib/i18n";

interface MessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] space-y-2 ${
              message.role === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2"
                : ""
            }`}
          >
            {message.parts?.map((part, i) => {
              if (part.type === "text") {
                // User messages: plain text. Assistant messages: render markdown.
                if (message.role === "user") {
                  return (
                    <div
                      key={i}
                      className="text-sm whitespace-pre-wrap leading-relaxed"
                    >
                      {part.text}
                    </div>
                  );
                }
                // Strip image markdown and clean up leftover empty list items
                const cleaned = part.text
                  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")  // remove ![alt](url)
                  .replace(/^[ \t]*[-*][ \t]*$/gm, "")    // remove empty list items
                  .replace(/\n{3,}/g, "\n\n");             // collapse triple+ newlines
                return (
                  <div key={i} className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Open links in new tab
                        a: ({ children, href, ...props }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {cleaned}
                    </ReactMarkdown>
                  </div>
                );
              }

              // Tool parts have type "tool-{name}" in AI SDK v6
              if (part.type.startsWith("tool-")) {
                const toolName = part.type.slice(5); // Remove "tool-" prefix
                const toolPart = part as unknown as {
                  state: string;
                  output?: unknown;
                  errorText?: string;
                };

                // Tool is executing
                if (
                  toolPart.state === "input-streaming" ||
                  toolPart.state === "input-available"
                ) {
                  return (
                    <LoadingMascot
                      key={i}
                      text={`${getToolLoadingText(toolName)}...`}
                      size="sm"
                    />
                  );
                }

                // Tool result available
                if (toolPart.state === "output-available") {
                  return (
                    <div key={i}>
                      {renderToolResult(
                        toolName,
                        toolPart.output as Record<string, unknown>
                      )}
                    </div>
                  );
                }

                // Tool error
                if (toolPart.state === "output-error") {
                  return (
                    <div
                      key={i}
                      className="text-xs text-red-500 italic"
                    >
                      Error: {toolPart.errorText ?? "Unknown error"}
                    </div>
                  );
                }
              }

              return null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderToolResult(toolName: string, result: Record<string, any>) {
  if (!result) return null;

  switch (toolName) {
    case "searchProducts":
    case "findCheapest": {
      const products = result.products ?? result.cheapest ?? [];
      if (products.length === 0) {
        return (
          <p className="text-xs text-muted-foreground italic">
            Aucun resultat / No results
          </p>
        );
      }
      return (
        <div className="grid gap-1.5 mt-1">
          {products.map((product: ProductCardProps["product"]) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      );
    }

    case "getWeeklySales": {
      const sales = result.sales ?? [];
      if (sales.length === 0) {
        return (
          <p className="text-xs text-muted-foreground italic">
            Aucun solde / No sales
          </p>
        );
      }
      return (
        <div className="grid gap-1.5 mt-1">
          {sales.map((product: ProductCardProps["product"]) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      );
    }

    case "createGroceryList":
      return (
        <div className="text-sm border border-green-200 bg-green-50 rounded-lg px-3 py-2 mt-1">
          ✓ Liste créée: <strong>{result.name}</strong>
        </div>
      );

    case "addToGroceryList":
      return (
        <div className="text-sm border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 mt-1">
          ✓ {result.added} item(s) ajouté(s) à {result.listName}
        </div>
      );

    case "getUserGroceryLists": {
      const lists = result.lists ?? [];
      if (lists.length === 0) {
        return (
          <p className="text-xs text-muted-foreground italic">
            Aucune liste active / No active lists
          </p>
        );
      }
      return (
        <div className="space-y-1 mt-1">
          {lists.map((list: { id: string; name: string; itemCount: number }) => (
            <div
              key={list.id}
              className="text-sm bg-muted rounded-lg px-3 py-2 flex justify-between"
            >
              <span>{list.name}</span>
              <span className="text-muted-foreground">
                {list.itemCount} items
              </span>
            </div>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

function getToolLoadingText(toolName: string): string {
  const map: Record<string, string> = {
    searchProducts: t("chat.loading.searchProducts"),
    findCheapest: t("chat.loading.findCheapest"),
    getWeeklySales: t("chat.loading.getWeeklySales"),
    createGroceryList: t("chat.loading.createGroceryList"),
    addToGroceryList: t("chat.loading.addToGroceryList"),
    getUserGroceryLists: t("chat.loading.getUserGroceryLists"),
  };
  return map[toolName] ?? t("chat.loading.default");
}
