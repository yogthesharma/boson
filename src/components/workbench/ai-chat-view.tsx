import { useState } from "react";
import { IconRobot, IconSend2, IconSparkles, IconUser } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
  code?: string;
};

const sampleMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    time: "9:41 AM",
    text: "Hi — I'm your Boson assistant. I can help with this workspace, explain code, or sketch refactors. (UI-only for now; plug in your model when you're ready.)",
  },
  {
    id: "2",
    role: "user",
    time: "9:42 AM",
    text: "How is the workbench layout structured?",
  },
  {
    id: "3",
    role: "assistant",
    time: "9:42 AM",
    text: "Roughly: title bar → primary sidebar (activity icons + views) → editor → optional right auxiliary (this chat) → bottom panel (terminal / output). Each region is fed by registries so extensions can contribute.",
    code: `// Example: register a view\nworkbenchViewRegistry.register({\n  id: \"my.chat\",\n  location: \"auxiliary\",\n  containerId: \"workbench.auxiliary\",\n  order: 20,\n  title: \"MY TOOL\",\n  render: () => <MyView />,\n});`,
  },
  {
    id: "4",
    role: "user",
    time: "9:43 AM",
    text: "Add a dark-mode friendly terminal placeholder?",
  },
  {
    id: "5",
    role: "assistant",
    time: "9:43 AM",
    text: "Already in the bottom TERMINAL tab — zinc background, prompt colors, and a pulse cursor. You can swap in xterm or a Tauri PTY later.",
  },
];

const quickActions = ["Explain selection", "Generate tests", "Summarize file"];

export function AiChatView() {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="shrink-0 space-y-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <IconSparkles size={14} className="text-primary" aria-hidden />
          Suggestions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {sampleMessages.map((m) => (
          <div
            key={m.id}
            className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border border-border",
                m.role === "assistant"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {m.role === "assistant" ? <IconRobot size={16} /> : <IconUser size={16} />}
            </div>
            <div className={cn("min-w-0 max-w-[min(100%,20rem)]", m.role === "user" && "flex flex-col items-end")}>
              <div className="mb-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{m.role === "assistant" ? "Assistant" : "You"}</span>
                <span>{m.time}</span>
              </div>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "assistant"
                    ? "bg-muted border border-border text-foreground"
                    : "bg-primary text-primary-foreground",
                )}
              >
                <p>{m.text}</p>
                {m.code ? (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-border/80 bg-background/80 p-2 font-mono text-[11px] leading-snug text-foreground/90 dark:bg-black/40">
                    {m.code}
                  </pre>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-muted/50 p-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about your project…"
            className="h-8 flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setDraft("");
              }
            }}
          />
          <Button type="button" size="icon-sm" variant="secondary" className="h-8 w-8 shrink-0" aria-label="Send">
            <IconSend2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
