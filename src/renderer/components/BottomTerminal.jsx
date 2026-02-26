import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { Button } from "./ui/button";

// Strip ANSI escape sequences so output is readable in plain text
function stripAnsi(str) {
  if (typeof str !== "string") return "";
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-Zf-ql-ny=]/g,
    "",
  );
}

const ARROW_KEYS = {
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",
  Home: "\x1b[H",
  End: "\x1b[F",
  Delete: "\x1b[3~",
};

function getTerminalKey(key, ctrlKey, metaKey) {
  if (metaKey) return null; // Cmd key - don't send to terminal
  if (key === "Enter") return "\r";
  if (key === "Backspace") return "\x7f";
  if (key === "Tab") return "\t";
  if (key === "Escape") return "\x1b";
  if (ARROW_KEYS[key]) return ARROW_KEYS[key];
  if (ctrlKey && key.length === 1) {
    const c = key.toLowerCase().charCodeAt(0);
    if (c >= 97 && c <= 122) return String.fromCharCode(c - 96); // Ctrl+A = 1, etc.
    if (key === "[") return "\x1b"; // Ctrl+[
  }
  if (key.length === 1 && !ctrlKey) return key;
  return null;
}

export function BottomTerminal({ open = false, onClose }) {
  const [output, setOutput] = useState("");
  const [shell, setShell] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let unsubData, unsubExit;
    window.api.terminal
      .start({})
      .then((info) => {
        if (info?.started) setShell(info.shell || "");
      })
      .catch(() => setShell(""));

    unsubData = window.api.terminal.onData((chunk) => {
      setOutput((prev) => prev + stripAnsi(chunk));
    });
    unsubExit = window.api.terminal.onExit(() => {
      setOutput((prev) => prev + "\n[Process exited]\n");
    });

    return () => {
      unsubData?.();
      unsubExit?.();
      window.api.terminal.stop();
    };
  }, [open]);

  useEffect(() => {
    if (output && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  // Focus the hidden input when terminal opens so typing works immediately
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const handleKeyDown = (e) => {
    if (!open) return;
    const raw = getTerminalKey(e.key, e.ctrlKey, e.metaKey);
    if (raw !== null) {
      e.preventDefault();
      e.stopPropagation();
      window.api.terminal.write(raw);
    }
  };

  const handlePaste = (e) => {
    if (!open) return;
    e.preventDefault();
    const text = e.clipboardData?.getData("text") ?? "";
    if (text) window.api.terminal.write(text);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <section
      className={[
        "border-t border-border/50 bg-muted/20 rounded-t-xl transition-all duration-200 ease-out",
        open ? "h-64 opacity-100" : "h-0 opacity-0",
      ].join(" ")}
      aria-hidden={!open}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Terminal</span>
            {shell && (
              <span className="pl-1 text-muted-foreground">{shell}</span>
            )}
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-label="Close terminal"
              onClick={onClose}
            >
              <IconX size={14} stroke={1.6} />
            </Button>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-hidden flex flex-col font-mono text-sm leading-relaxed bg-background rounded-b-xl relative"
          onClick={focusInput}
        >
          <div
            ref={scrollRef}
            className="flex-1 min-h-[140px] overflow-auto px-5 py-3 whitespace-pre-wrap break-all text-foreground"
          >
            {output ? (
              output
            ) : (
              <span className="text-muted-foreground">boson % </span>
            )}
          </div>
          {/* Full-size invisible input so it's focusable in Electron; pointer-events: none so scroll still works */}
          <input
            ref={inputRef}
            type="text"
            aria-label="Terminal input"
            className="absolute inset-0 w-full h-full opacity-0 cursor-default"
            style={{ caretColor: "transparent", pointerEvents: "none" }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            readOnly
          />
        </div>
      </div>
    </section>
  );
}
