import { useRef, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import {
  NewThreadEmptyStateCenter,
  NewThreadEmptyStateSuggestions,
} from "./NewThreadEmptyState";
import { cn } from "@/lib/utils";

function StatusChip({ phase, toolName }) {
  if (!phase) return null;
  const label =
    phase === "thinking"
      ? "Thinking..."
      : phase === "calling_tool"
        ? toolName
          ? `Using tool: ${toolName}`
          : "Using tool..."
        : phase === "writing"
          ? "Writing response..."
          : null;
  if (!label) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      <span>{label}</span>
    </div>
  );
}

const REASONING_PLACEHOLDER = "[structured reasoning hidden]";

/** Detect if a single line looks like JSON (key/value, array, object). */
function lineLooksLikeJson(line) {
  const t = line.trim();
  if (t.length === 0) return false;
  if (/^[{\[]/.test(t) || /^["']?\w+["']?\s*:\s*/.test(t)) return true;
  if (/^["'][^"']*["']\s*,?\s*$/.test(t)) return true;
  if (/^\d+\s*,?\s*$/.test(t) && t.length < 20) return true;
  return false;
}

/** Remove fenced and plain JSON from reasoning; show only natural-language bits; replace JSON with placeholder. */
function sanitizeReasoning(text) {
  if (!text || typeof text !== "string") return "";
  let out = text;
  // 1) Fenced ```json ... ``` or ```\n{ ... }\n```
  out = out.replace(/```\s*json\s*[\s\S]*?```/gi, "\n" + REASONING_PLACEHOLDER + "\n");
  out = out.replace(/```\s*json\s*[\s\S]*$/i, "\n" + REASONING_PLACEHOLDER + "\n");
  out = out.replace(/```\s*(\s*[\[{][\s\S]*?)```/g, (_, inner) =>
    /^\s*[\[{]/.test(inner) ? "\n" + REASONING_PLACEHOLDER + "\n" : "```" + inner + "```"
  );
  out = out.replace(/```\s*(\s*[\[{][\s\S]*)$/g, "\n" + REASONING_PLACEHOLDER + "\n");
  // 2) Line-by-line: hide lines that look like raw JSON
  const lines = out.split("\n");
  const result = [];
  let lastWasPlaceholder = false;
  for (const line of lines) {
    if (lineLooksLikeJson(line)) {
      if (!lastWasPlaceholder) result.push(REASONING_PLACEHOLDER);
      lastWasPlaceholder = true;
    } else {
      result.push(line);
      lastWasPlaceholder = false;
    }
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function ReasoningBlock({ content, defaultExpanded = true, phase = null }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const displayContent = sanitizeReasoning(content ?? "");
  const isOnlyPlaceholders =
    !displayContent ||
    displayContent.split("\n").every((l) => l.trim() === "" || l.trim() === REASONING_PLACEHOLDER);
  const phaseLabel =
    phase === "thinking"
      ? "Planning"
      : phase === "calling_tool"
        ? "Checking"
        : phase === "writing"
          ? "Writing"
          : null;
  const showPhaseOnly = isOnlyPlaceholders && phaseLabel;
  if (!displayContent && !showPhaseOnly) return null;
  return (
    <div className="border-b border-border/50 bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/30"
      >
        {expanded ? (
          <IconChevronDown size={14} stroke={1.5} />
        ) : (
          <IconChevronRight size={14} stroke={1.5} />
        )}
        <span>Reasoning</span>
        <span className="text-muted-foreground/80">
          {showPhaseOnly ? phaseLabel : `(${displayContent.length} chars)`}
        </span>
      </button>
      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-border/30 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {showPhaseOnly ? (
            <span className="italic text-muted-foreground">{phaseLabel}…</span>
          ) : (
            displayContent
          )}
        </div>
      )}
    </div>
  );
}

export function ChatView({
  messages = [],
  isLoading = false,
  streamPhase = null,
  streamToolName = null,
  streamingReasoning = "",
  showReasoning = false,
  onSend,
  chatError,
  hasActiveThread = false,
  onOpenSettings,
  projectName = "this repo",
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const handleSuggestionClick = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;
  const showReasoningBlock = showReasoning && streamingReasoning && isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto",
          isEmpty && "flex items-center justify-center",
        )}
      >
        <div className="max-w-4xl mx-auto flex flex-col">
          {showReasoningBlock && (
            <ReasoningBlock
              content={streamingReasoning}
              defaultExpanded={true}
              phase={streamPhase}
            />
          )}
          {isEmpty ? (
            <NewThreadEmptyStateCenter
              projects={[{ id: "default", name: projectName }]}
              selectedProjectId="default"
            />
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>
      </div>
      <div className="max-w-4xl mx-auto w-full shrink-0 flex flex-col">
        {isEmpty && (
          <NewThreadEmptyStateSuggestions
            onSuggestionClick={handleSuggestionClick}
          />
        )}
        <ChatInput
          ref={inputRef}
          value={input}
          onChange={setInput}
          onSend={onSend}
          disabled={isLoading || !hasActiveThread}
          chatError={chatError}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
}
