import { useState } from "react";
import { IconCheck, IconCopy, IconLoader2 } from "@tabler/icons-react";
import { Highlight, themes, Prism } from "prism-react-renderer";
import { toast } from "sonner";

// Must run before prismjs component imports so they register on prism-react-renderer's Prism
import "./prism-init";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import { cn } from "@/lib/utils";

// Prism language alias for fence label (e.g. "js" -> "javascript")
const PRISM_LANG_ALIAS = {
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  json: "json",
  html: "markup",
  xml: "markup",
  css: "css",
  scss: "scss",
  md: "markdown",
};

/** Extract and parse JSON from ```json ... ``` block in content. Returns null if not found or invalid. */
function parseStructuredContent(content) {
  if (!content || typeof content !== "string") return null;
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

/** Inline formatting: bold (**) and code (`). Returns array of { type: "text"|"bold"|"code", value }. */
function formatContent(text) {
  if (!text) return [];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    const backtick = remaining.indexOf("`");
    const bold = remaining.indexOf("**");
    let next = -1;
    let type = null;
    let end = -1;
    if (backtick >= 0 && (bold < 0 || backtick < bold)) {
      next = backtick;
      type = "code";
      end = remaining.indexOf("`", next + 1);
    } else if (bold >= 0) {
      next = bold;
      type = "bold";
      end = remaining.indexOf("**", next + 2);
    }
    if (type === null || end < 0) {
      parts.push({ type: "text", value: remaining });
      break;
    }
    if (next > 0) {
      parts.push({ type: "text", value: remaining.slice(0, next) });
    }
    if (type === "code") {
      parts.push({ type: "code", value: remaining.slice(next + 1, end) });
    } else {
      parts.push({ type: "bold", value: remaining.slice(next + 2, end) });
    }
    remaining = remaining.slice(end + (type === "code" ? 1 : 2));
  }
  return parts;
}

function renderInlineFormatted(parts) {
  return parts.map((part, i) =>
    part.type === "text" ? (
      <span key={i}>{part.value}</span>
    ) : part.type === "code" ? (
      <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        {part.value}
      </code>
    ) : (
      <strong key={i}>{part.value}</strong>
    ),
  );
}

/** Parse content into blocks: code (fenced), table, or paragraph. */
function parseBlocks(content) {
  if (!content || typeof content !== "string") return [];
  const blocks = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block: ```optionalLang
    const codeOpen = line.match(/^```(\w*)\s*$/);
    if (codeOpen) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({
        type: "code",
        language: codeOpen[1] || "",
        value: codeLines.join("\n"),
      });
      continue;
    }
    // Table row: | cell | cell |
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const tableRows = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        const row = lines[i]
          .split(/\|/)
          .slice(1, -1)
          .map((c) => c.trim());
        tableRows.push(row);
        i++;
      }
      blocks.push({ type: "table", rows: tableRows });
      continue;
    }
    // List: consecutive - or * lines
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      const listItems = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (m) {
          listItems.push(m[1]);
          i++;
        } else break;
      }
      blocks.push({ type: "list", items: listItems });
      continue;
    }
    // Paragraph: collect until ``` or table row or list line
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i];
      if (/^```(\w*)\s*$/.test(l)) break;
      if (/^\s*\|.+\|\s*$/.test(l)) break;
      if (/^\s*[-*]\s+/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    const paraText = paraLines.join("\n").trim();
    if (paraText) blocks.push({ type: "para", text: paraText });
  }
  return blocks;
}

/** Theme-aware Prism theme (dark vs light). */
function getPrismTheme() {
  if (typeof document === "undefined") return themes.oneDark;
  return document.documentElement.classList.contains("dark")
    ? themes.oneDark
    : themes.oneLight;
}

/** Code block with header row (language + copy) and syntax highlighting. */
function CodeBlock({ block, blockIndex }) {
  const [copied, setCopied] = useState(false);
  const lang = (block.language || "").toLowerCase();
  const prismLang =
    PRISM_LANG_ALIAS[lang] || (Prism.languages[lang] ? lang : "plaintext");

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(block.value);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  return (
    <div
      key={blockIndex}
      className="my-3 overflow-hidden rounded-md bg-muted/50"
    >
      <div className="flex items-center justify-between px-3 py-1.5 pb-0">
        <span className="text-xs font-medium text-muted-foreground">
          {block.language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
          title={copied ? "Copied" : "Copy code"}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <IconCheck size={14} stroke={2} />
          ) : (
            <IconCopy size={14} stroke={1.5} />
          )}
        </button>
      </div>
      <Highlight
        theme={getPrismTheme()}
        code={block.value}
        language={prismLang}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              "overflow-x-auto p-3 pt-2 text-xs leading-relaxed font-mono whitespace-pre",
              className,
            )}
            style={{
              ...style,
              fontFamily: "var(--code-font, ui-monospace, monospace)",
              margin: 0,
              background: "transparent",
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/** Render a single block (code, table, or para with inline formatting). */
function renderBlock(block, blockIndex) {
  if (block.type === "code") {
    return <CodeBlock key={blockIndex} block={block} blockIndex={blockIndex} />;
  }
  if (block.type === "table") {
    const rows = block.rows;
    const isSeparator = (row) => row.every((c) => /^[\s\-:]+$/.test(c));
    const headerRow = rows[0];
    const sepIndex = rows.findIndex((r, i) => i > 0 && isSeparator(r));
    const bodyStart = sepIndex >= 0 ? sepIndex + 1 : 1;
    const bodyRows = headerRow ? rows.slice(bodyStart) : rows;
    const hasHeader = headerRow && bodyRows.length > 0 && sepIndex >= 0;
    return (
      <div
        key={blockIndex}
        className="my-2 overflow-x-auto rounded-md border border-border"
      >
        <table className="w-full min-w-[200px] border-collapse text-sm">
          {hasHeader && (
            <thead>
              <tr>
                {headerRow.map((cell, c) => (
                  <th
                    key={c}
                    className="border-b border-border bg-muted/50 px-3 py-2 text-left font-medium text-foreground"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {(hasHeader ? bodyRows : rows).map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border-b border-border/50 px-3 py-2 text-foreground last:border-b-0"
                  >
                    {renderInlineFormatted(formatContent(cell))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "para") {
    return (
      <div key={blockIndex} className="whitespace-pre-wrap break-words">
        {block.text.split("\n").map((line, idx) => (
          <span key={idx}>
            {idx > 0 && <br />}
            {renderInlineFormatted(formatContent(line))}
          </span>
        ))}
      </div>
    );
  }
  if (block.type === "list") {
    return (
      <ul
        key={blockIndex}
        className="list-disc list-inside space-y-0.5 pl-1 my-1"
      >
        {block.items.map((item, j) => (
          <li key={j}>{renderInlineFormatted(formatContent(item))}</li>
        ))}
      </ul>
    );
  }
  return null;
}

/** Render answer_markdown with code blocks, tables, lists, and inline formatting. */
function StructuredSections({ data }) {
  const answer =
    data.answer_markdown != null ? String(data.answer_markdown).trim() : "";
  if (!answer) return null;
  const blocks = parseBlocks(answer);
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

function phaseLabel(phase, toolName) {
  if (phase === "thinking") return "Thinking...";
  if (phase === "calling_tool")
    return toolName ? `Using tool: ${toolName}` : "Using tool...";
  if (phase === "writing") return "Writing response...";
  return null;
}

export function ChatMessage({ role, content, messageId, meta }) {
  const isUser = role === "user";
  const isStreaming = messageId === "streaming";
  const inProgress = meta?.inProgress === true;
  const phase = meta?.phase ?? null;
  const toolName = meta?.toolName ?? null;
  const showCopy = !isUser && content && !isStreaming;
  const [copied, setCopied] = useState(false);
  const parts = formatContent(content ?? "");
  const progressLabel = phaseLabel(phase, toolName);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const structured =
    !isUser && content ? parseStructuredContent(content) : null;
  const hasStructuredShape =
    structured &&
    typeof structured === "object" &&
    structured.answer_markdown != null &&
    String(structured.answer_markdown).trim();

  return (
    <div
      className={cn("flex w-full flex-col px-4 py-3", isUser && "items-end")}
    >
      {!isUser && inProgress && progressLabel && (
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <IconLoader2 size={14} className="animate-spin shrink-0" />
          <span>{progressLabel}</span>
        </div>
      )}
      <div
        className={cn(
          "max-w-full rounded-lg px-4 py-2.5 text-sm",
          isUser
            ? "bg-muted text-foreground"
            : "bg-transparent text-foreground",
        )}
      >
        {!isUser && hasStructuredShape ? (
          <StructuredSections data={structured} />
        ) : !isUser && content ? (
          <div className="leading-relaxed space-y-1">
            {parseBlocks(content).map((block, i) => renderBlock(block, i))}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {parts.map((part, i) =>
              part.type === "text" ? (
                <span key={i}>{part.value}</span>
              ) : part.type === "code" ? (
                <code
                  key={i}
                  className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
                >
                  {part.value}
                </code>
              ) : (
                <strong key={i}>{part.value}</strong>
              ),
            )}
          </div>
        )}
      </div>
      {showCopy && (
        <div className="mt-0 flex w-full max-w-[85%] justify-start">
          <button
            type="button"
            onClick={handleCopy}
            className="flex size-7 items-center justify-center ml-3 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
            title={copied ? "Copied" : "Copy response"}
            aria-label={copied ? "Copied" : "Copy response"}
          >
            {copied ? (
              <IconCheck size={14} stroke={2} />
            ) : (
              <IconCopy size={14} stroke={1.5} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
