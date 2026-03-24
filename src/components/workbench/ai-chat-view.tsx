import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPhotoPlus,
  IconPlus,
  IconSend2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
  agent?: string;
  imageNames?: string[];
};

type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
};

const THREADS_KEY = "boson.ai.threads";
const ACTIVE_THREAD_KEY = "boson.ai.activeThread";
const OPEN_THREADS_KEY = "boson.ai.openThreads";
const AGENTS_KEY = "boson.ai.agents";
const SHOW_HISTORY_KEY = "boson.ai.showHistory";
const THREADS_CHANGED_EVENT = "boson.aiChat.threadsChanged";
const SELECT_THREAD_EVENT = "boson.aiChat.selectThread";
const NEW_THREAD_EVENT = "boson.aiChat.newThread";
const CLOSE_THREAD_EVENT = "boson.aiChat.closeThread";

const defaultMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    time: "9:41 AM",
    agent: "Default",
    text: "Hi! I can help with this workspace. Pick an agent, ask a question, or attach an image for context.",
  },
];

const defaultAgents = ["Default", "Code", "Architect"];

function nowLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function createDefaultThread(): ChatThread {
  const id = String(Date.now());
  return {
    id,
    title: "New Chat",
    createdAt: Date.now(),
    messages: defaultMessages,
  };
}

export function AiChatView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [agents, setAgents] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultAgents;
    try {
      const parsed = JSON.parse(localStorage.getItem(AGENTS_KEY) ?? "[]");
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultAgents;
      return parsed.filter((a) => typeof a === "string");
    } catch {
      return defaultAgents;
    }
  });
  const [selectedAgent, setSelectedAgent] = useState("Default");
  const [newAgentName, setNewAgentName] = useState("");
  const [recording, setRecording] = useState(false);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    if (typeof window === "undefined") return [createDefaultThread()];
    try {
      const parsed = JSON.parse(localStorage.getItem(THREADS_KEY) ?? "[]");
      if (!Array.isArray(parsed) || parsed.length === 0)
        return [createDefaultThread()];
      return parsed as ChatThread[];
    } catch {
      return [createDefaultThread()];
    }
  });
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(ACTIVE_THREAD_KEY) ?? "";
  });
  const [openThreadIds, setOpenThreadIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(OPEN_THREADS_KEY) ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem(SHOW_HISTORY_KEY);
    if (raw == null) return true;
    return raw === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    window.dispatchEvent(
      new CustomEvent(THREADS_CHANGED_EVENT, {
        detail: { threads, activeThreadId, openThreadIds },
      }),
    );
  }, [threads, activeThreadId, openThreadIds]);

  useEffect(() => {
    if (threads.length === 0) {
      const initial = createDefaultThread();
      setThreads([initial]);
      setActiveThreadId(initial.id);
      return;
    }
    if (!activeThreadId || !threads.some((t) => t.id === activeThreadId)) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeThreadId) return;
    localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OPEN_THREADS_KEY, JSON.stringify(openThreadIds));
  }, [openThreadIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SHOW_HISTORY_KEY, showHistory ? "1" : "0");
  }, [showHistory]);

  useEffect(() => {
    const onToggle = () => setShowHistory((v) => !v);
    window.addEventListener(
      "boson.aiChat.toggleHistory",
      onToggle as EventListener,
    );
    return () => {
      window.removeEventListener(
        "boson.aiChat.toggleHistory",
        onToggle as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      if (threads.some((t) => t.id === id)) {
        setActiveThreadId(id);
        setOpenThreadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
    };
    const onNew = () => {
      createNewChat();
    };
    const onClose = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      setOpenThreadIds((prev) => {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) {
          return prev;
        }
        if (activeThreadId === id) {
          setActiveThreadId(next[next.length - 1]);
        }
        return next;
      });
    };
    window.addEventListener(SELECT_THREAD_EVENT, onSelect as EventListener);
    window.addEventListener(NEW_THREAD_EVENT, onNew as EventListener);
    window.addEventListener(CLOSE_THREAD_EVENT, onClose as EventListener);
    return () => {
      window.removeEventListener(
        SELECT_THREAD_EVENT,
        onSelect as EventListener,
      );
      window.removeEventListener(NEW_THREAD_EVENT, onNew as EventListener);
      window.removeEventListener(CLOSE_THREAD_EVENT, onClose as EventListener);
    };
  }, [threads, activeThreadId]);

  useEffect(() => {
    const valid = new Set(threads.map((t) => t.id));
    setOpenThreadIds((prev) => {
      const filtered = prev.filter((id) => valid.has(id));
      if (filtered.length > 0) return filtered;
      const fallback = activeThreadId || threads[0]?.id;
      return fallback ? [fallback] : [];
    });
  }, [threads, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    setOpenThreadIds((prev) =>
      prev.includes(activeThreadId) ? prev : [...prev, activeThreadId],
    );
  }, [activeThreadId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const activeMessages = activeThread?.messages ?? [];

  const sendPrompt = () => {
    const text = draft.trim();
    if (!text && imageNames.length === 0) return;
    if (!activeThread) return;
    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      text: text || "(image attachment)",
      time: nowLabel(),
      imageNames: imageNames.length > 0 ? [...imageNames] : undefined,
    };
    const assistantMessage: ChatMessage = {
      id: String(Date.now() + 1),
      role: "assistant",
      agent: selectedAgent,
      text: `(${selectedAgent}) Not connected yet. This is UI-ready for model integration.`,
      time: nowLabel(),
    };
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              title:
                thread.messages.length === 0
                  ? text.slice(0, 32) || "Image Prompt"
                  : thread.title,
              messages: [...thread.messages, userMessage, assistantMessage],
            }
          : thread,
      ),
    );
    setDraft("");
    setImageNames([]);
  };

  const createNewChat = () => {
    const thread: ChatThread = {
      id: String(Date.now()),
      title: "New Chat",
      createdAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setOpenThreadIds((prev) => [...prev, thread.id]);
  };

  const addAgent = () => {
    const next = newAgentName.trim();
    if (!next) return;
    if (agents.some((a) => a.toLowerCase() === next.toLowerCase())) {
      setSelectedAgent(
        agents.find((a) => a.toLowerCase() === next.toLowerCase()) ?? "Default",
      );
      setNewAgentName("");
      return;
    }
    setAgents((prev) => [...prev, next]);
    setSelectedAgent(next);
    setNewAgentName("");
  };

  const removeAgent = (name: string) => {
    if (name === "Default") return;
    setAgents((prev) => prev.filter((a) => a !== name));
    if (selectedAgent === name) setSelectedAgent("Default");
  };

  const handleVoiceToggle = () => {
    const speechCtor =
      typeof window !== "undefined"
        ? ((
            window as Window & {
              webkitSpeechRecognition?: new () => {
                continuous: boolean;
                interimResults: boolean;
                lang: string;
                onresult:
                  | ((event: {
                      results: ArrayLike<ArrayLike<{ transcript: string }>>;
                    }) => void)
                  | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
              SpeechRecognition?: new () => {
                continuous: boolean;
                interimResults: boolean;
                lang: string;
                onresult:
                  | ((event: {
                      results: ArrayLike<ArrayLike<{ transcript: string }>>;
                    }) => void)
                  | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
            }
          ).SpeechRecognition ??
          (
            window as Window & {
              webkitSpeechRecognition?: new () => {
                continuous: boolean;
                interimResults: boolean;
                lang: string;
                onresult:
                  | ((event: {
                      results: ArrayLike<ArrayLike<{ transcript: string }>>;
                    }) => void)
                  | null;
                onend: (() => void) | null;
                start: () => void;
                stop: () => void;
              };
            }
          ).webkitSpeechRecognition)
        : undefined;

    if (!speechCtor) {
      // Keep the control available even where browser speech APIs are missing.
      setRecording((r) => !r);
      return;
    }

    if (recording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setRecording(false);
      return;
    }

    try {
      const rec = new speechCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const part = event.results[i]?.[0]?.transcript ?? "";
          text += part;
        }
        setDraft(text.trim());
      };
      rec.onend = () => {
        recognitionRef.current = null;
        setRecording(false);
      };
      rec.start();
      recognitionRef.current = { stop: () => rec.stop() };
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          {activeMessages.length === 0 ? (
            <div className="rounded border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Start a new conversation. Pick an agent and ask your first prompt.
            </div>
          ) : null}
          {activeMessages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <div
                className={cn(
                  "rounded-md text-xs leading-relaxed",
                  m.role === "assistant"
                    ? "bg-background text-foreground px-1"
                    : "border border-border/80 w-full bg-muted/20 px-2 py-1",
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70"></div>
                <p>{m.text}</p>
                {m.imageNames && m.imageNames.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.imageNames.map((name) => (
                      <span
                        key={`${m.id}-${name}`}
                        className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 bg-background p-2">
          {imageNames.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {imageNames.map((name) => (
                <span
                  key={name}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="rounded-md border border-border bg-background p-2 shadow-xs">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message Boson..."
              className="!max-h-24 !min-h-12 w-full resize-y bg-transparent !text-xs outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendPrompt();
                }
              }}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7"
                title="Attach image"
                aria-label="Attach image"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPhotoPlus size={14} />
              </Button>
              <Button
                type="button"
                variant={recording ? "secondary" : "ghost"}
                size="icon-xs"
                className="h-7 w-7"
                title={recording ? "Stop voice input" : "Start voice input"}
                aria-label={
                  recording ? "Stop voice input" : "Start voice input"
                }
                onClick={handleVoiceToggle}
              >
                {recording ? (
                  <IconMicrophoneOff size={14} />
                ) : (
                  <IconMicrophone size={14} />
                )}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Agent: <strong>{selectedAgent}</strong>
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="h-7 w-7"
                  aria-label="Send"
                  onClick={sendPrompt}
                >
                  <IconSend2 size={14} />
                </Button>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setImageNames(files.map((f) => f.name));
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-l border-border bg-background transition-[width,opacity] duration-150",
          showHistory
            ? "w-44 opacity-100"
            : "w-0 overflow-hidden border-l-0 opacity-0",
        )}
        aria-hidden={!showHistory}
      >
        <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6"
            title="New chat"
            aria-label="New chat"
            onClick={createNewChat}
          >
            <IconPlus size={13} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto p-1.5">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setActiveThreadId(thread.id)}
              className={cn(
                "w-full truncate rounded px-2 py-1.5 text-left text-xs",
                thread.id === activeThread?.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground",
              )}
              title={thread.title}
            >
              {thread.title}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
