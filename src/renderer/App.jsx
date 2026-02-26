import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { ChatView } from "@/components/chat/ChatView";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Toaster } from "@/components/ui/sonner";
import { useSettingsStore } from "@/stores/settingsStore";

const { getTheme, getThemeSource, setTheme, onThemeChange } = window.api;
const DEFAULT_PROJECT_ID = "default";

const CODING_SYSTEM_PROMPT = `You are a concise coding assistant. Follow these rules:
- Be concise; prefer concrete file paths and exact code snippets.
- If suggesting code, provide the full snippet ready to apply.
- Always include validation/check commands (e.g. how to run tests or verify).
- Never dump long prose before actionable output.
- Prefer clear markdown: use **bold**, lists (- item), and code blocks (\`\`\`) as needed.
- Only when the user asks for a structured breakdown (code changes, commands, checks), you may reply with a \`\`\`json code block containing: answer_markdown (main explanation), and optionally code_changes, commands, checks. Otherwise reply in plain markdown.`;

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyAppearance(appearance) {
  if (!appearance) return;
  const root = document.documentElement;
  root.style.setProperty("--sans-font", appearance.sansFontFamily ?? "system-ui, sans-serif");
  root.style.setProperty("--code-font", appearance.codeFontFamily ?? "ui-monospace, monospace");
  root.style.setProperty("--sans-size-px", `${appearance.sansFontSizePx ?? 13}px`);
  root.style.setProperty("--code-size-px", `${appearance.codeFontSizePx ?? 12}px`);
  root.classList.toggle("pointer-cursors", appearance.pointerCursors !== false);
}

export default function App() {
  const [view, setView] = useState("chat"); // "chat" | "settings"
  const [settingsSection, setSettingsSection] = useState("general");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessagesById, setThreadMessagesById] = useState({});
  const [chatLoadingByThreadId, setChatLoadingByThreadId] = useState({});
  const [chatError, setChatError] = useState(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamPhase, setStreamPhase] = useState(null); // "thinking" | "calling_tool" | "writing" | null
  const [streamToolName, setStreamToolName] = useState(null);
  const [streamingReasoning, setStreamingReasoning] = useState("");
  const streamContentBufRef = useRef("");
  const streamReasoningBufRef = useRef("");
  const streamRafRef = useRef(null);
  const appearance = useSettingsStore((s) => s.appearance);
  const loaded = useSettingsStore((s) => s._loaded);
  const showReasoning = useSettingsStore((s) => s.general?.showReasoning === true);

  const flushStreamBuffers = useCallback(() => {
    streamRafRef.current = null;
    const content = streamContentBufRef.current;
    const reasoning = streamReasoningBufRef.current;
    if (content) {
      streamContentBufRef.current = "";
      setStreamingContent((prev) => prev + content);
    }
    if (reasoning) {
      streamReasoningBufRef.current = "";
      setStreamingReasoning((prev) => prev + reasoning);
    }
  }, []);

  useEffect(() => {
    useSettingsStore.getState().load();
  }, []);

  useEffect(() => {
    const unsubStart = window.api.chat?.onStreamStart?.(() => {
      setStreamPhase("thinking");
      setStreamToolName(null);
      setStreamingReasoning("");
      streamContentBufRef.current = "";
      streamReasoningBufRef.current = "";
      if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    });
    const unsubStatus = window.api.chat?.onStreamStatus?.((data) => {
      setStreamPhase(data.status ?? null);
      if (data.status !== "calling_tool") setStreamToolName(null);
    });
    const unsubDelta = window.api.chat?.onStreamDelta?.((data) => {
      if (data.chunk) {
        streamContentBufRef.current += data.chunk;
        if (streamRafRef.current === null) {
          streamRafRef.current = requestAnimationFrame(flushStreamBuffers);
        }
      }
    });
    const unsubTool = window.api.chat?.onStreamToolEvent?.((data) => {
      if (data.type === "tool_start") {
        setStreamPhase("calling_tool");
        setStreamToolName(data.toolName ?? null);
      } else if (data.type === "tool_end") {
        setStreamPhase("writing");
        setStreamToolName(null);
      }
    });
    const unsubDone = window.api.chat?.onStreamDone?.(() => {
      if (streamContentBufRef.current || streamReasoningBufRef.current) {
        flushStreamBuffers();
      }
    });
    const unsubError = window.api.chat?.onStreamError?.(() => {});
    const unsubReasoning = window.api.chat?.onStreamReasoning?.((data) => {
      if (data.chunk) {
        streamReasoningBufRef.current += data.chunk;
        if (streamRafRef.current === null) {
          streamRafRef.current = requestAnimationFrame(flushStreamBuffers);
        }
      }
    });
    const unsubReasoningDone = window.api.chat?.onStreamReasoningDone?.(() => {});
    return () => {
      unsubStart?.();
      unsubStatus?.();
      unsubDelta?.();
      unsubTool?.();
      unsubDone?.();
      unsubError?.();
      unsubReasoning?.();
      unsubReasoningDone?.();
      if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current);
    };
  }, [flushStreamBuffers]);

  // Fetch thread list on mount, when project changes, and when returning to chat (e.g. after unarchiving in settings)
  useEffect(() => {
    window.api.threads.list(activeProjectId).then(setThreads).catch(() => setThreads([]));
  }, [activeProjectId]);

  useEffect(() => {
    if (view === "chat") {
      window.api.threads.list(activeProjectId).then(setThreads).catch(() => setThreads([]));
    }
  }, [view, activeProjectId]);

  // Update thread title when main process generates an AI title (sidebar + refetch so list stays in sync)
  useEffect(() => {
    const unsub = window.api.threads?.onTitleUpdated?.(({ threadId, title }) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title } : t))
      );
      window.api.threads?.list?.(activeProjectId)?.then(setThreads).catch(() => {});
    });
    return () => unsub?.();
  }, [activeProjectId]);

  const loadThreadMessages = useCallback(async (threadId) => {
    const existing = threadMessagesById[threadId];
    if (existing !== undefined) return;
    try {
      const thread = await window.api.threads.get(threadId);
      if (thread?.messages) {
        setThreadMessagesById((prev) => ({ ...prev, [threadId]: thread.messages }));
      } else {
        setThreadMessagesById((prev) => ({ ...prev, [threadId]: [] }));
      }
    } catch {
      setThreadMessagesById((prev) => ({ ...prev, [threadId]: [] }));
    }
  }, [threadMessagesById]);

  useEffect(() => {
    if (activeThreadId) loadThreadMessages(activeThreadId);
  }, [activeThreadId, loadThreadMessages]);

  /** Navigate to new-thread view; thread is created when user sends first message */
  const handleCreateThread = useCallback(() => {
    setActiveThreadId(null);
  }, []);

  const handleSelectThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
  }, []);

  const handleArchiveThread = useCallback(
    async (threadId) => {
      try {
        const ok = await window.api.threads.archive(threadId);
        if (!ok) return;
        const list = await window.api.threads.list(activeProjectId);
        setThreads(list);
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
        }
        toast.success("Thread archived");
      } catch (e) {
        toast.error(e?.message || "Failed to archive thread");
      }
    },
    [activeProjectId, activeThreadId]
  );

  const handleSendMessage = useCallback(
    async (text, modelProfileId) => {
      if (!modelProfileId) return;
      let threadId = activeThreadId;
      if (!threadId) {
        try {
          const thread = await window.api.threads.create(activeProjectId, "New thread");
          setThreads((prev) => [thread, ...prev]);
          setThreadMessagesById((prev) => ({ ...prev, [thread.id]: [] }));
          setActiveThreadId(thread.id);
          threadId = thread.id;
        } catch (e) {
          toast.error(e.message || "Failed to create thread");
          return;
        }
      }
      const tempUserMsg = {
        id: "temp-user",
        role: "user",
        content: text,
      };
      setThreadMessagesById((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), tempUserMsg],
      }));
      setStreamingContent("");
      setStreamPhase("thinking");
      setStreamToolName(null);
      setChatLoadingByThreadId((prev) => ({ ...prev, [threadId]: true }));
      setChatError(null);
      const threadMsgs = (threadMessagesById[threadId] || [])
        .filter((m) => m.id !== "temp-user")
        .map((m) => ({ role: m.role, content: m.content }));
      const messages = [
        { role: "system", content: CODING_SYSTEM_PROMPT },
        ...threadMsgs,
        { role: "user", content: text },
      ];
      const payload = { modelProfileId, messages };
      try {
        await window.api.chat.startStream(payload, threadId);
      } catch (e) {
        setChatError({
          code: "NETWORK_ERROR",
          message: e.message || "Request failed",
          modelProfileId,
        });
        setThreadMessagesById((prev) => ({
          ...prev,
          [threadId]: (prev[threadId] || []).filter(
            (m) => m.id !== "temp-user"
          ),
        }));
        setStreamPhase(null);
        setStreamToolName(null);
        setStreamingContent("");
        setStreamingReasoning("");
        setChatLoadingByThreadId((prev) => ({ ...prev, [threadId]: false }));
      }
    },
    [activeThreadId, activeProjectId, threadMessagesById]
  );

  useEffect(() => {
    const unsubDone = window.api.chat?.onStreamDone?.((data) => {
      const tid = data.threadId;
      if (data.userMessage && data.assistantMessage && tid) {
        setThreadMessagesById((prev) => ({
          ...prev,
          [tid]: [
            ...(prev[tid] || []).filter((m) => m.id !== "temp-user"),
            data.userMessage,
            data.assistantMessage,
          ],
        }));
      }
      setStreamPhase(null);
      setStreamToolName(null);
      setStreamingContent("");
      setStreamingReasoning("");
      setChatLoadingByThreadId((prev) =>
        tid ? { ...prev, [tid]: false } : prev
      );
    });
    const unsubError = window.api.chat?.onStreamError?.((data) => {
      setChatError({
        code: data.error || "ERROR",
        message: data.message || data.error,
        modelProfileId: null,
      });
      setStreamPhase(null);
      setStreamToolName(null);
      setStreamingContent("");
      setStreamingReasoning("");
      setChatLoadingByThreadId((prev) => {
        const tid = Object.keys(prev).find((k) => prev[k]);
        return tid ? { ...prev, [tid]: false } : prev;
      });
      setThreadMessagesById((prev) => {
        const tid = Object.keys(prev).find((k) =>
          (prev[k] || []).some((m) => m.id === "temp-user")
        );
        if (!tid) return prev;
        return {
          ...prev,
          [tid]: (prev[tid] || []).filter((m) => m.id !== "temp-user"),
        };
      });
    });
    return () => {
      unsubDone?.();
      unsubError?.();
    };
  }, []);

  useEffect(() => {
    getTheme().then(applyTheme);
    getThemeSource().then(() => {});
    const unsubscribe = onThemeChange((theme) => {
      applyTheme(theme);
      getThemeSource().then(() => {});
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const theme = appearance?.theme;
    if (theme && theme !== "system") {
      setTheme(theme);
    }
  }, [loaded, appearance?.theme]);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (
      !chatError ||
      chatError.code === "MISSING_API_KEY" ||
      chatError.code === "INVALID_API_KEY"
    )
      return;
    const message =
      chatError.code === "RATE_LIMITED"
        ? "Rate limited. Try again in a moment."
        : chatError.code === "MODEL_NOT_FOUND"
          ? "Model or endpoint not found. Edit model profile in Settings."
          : chatError.message;
    toast.error(message);
    setChatError(null);
  }, [chatError]);

  const activeMessages = activeThreadId ? threadMessagesById[activeThreadId] || [] : [];
  const isChatLoading = activeThreadId ? chatLoadingByThreadId[activeThreadId] : false;
  const displayedMessages =
    isChatLoading
      ? [
          ...activeMessages,
          {
            id: "streaming",
            role: "assistant",
            content: streamingContent,
            meta: {
              inProgress: true,
              phase: streamPhase,
              toolName: streamToolName,
            },
          },
        ]
      : activeMessages;

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const activeThreadTitle = activeThread?.title;

  return (
    <>
      <Layout
        view={view}
        onNavigate={setView}
        settingsSection={settingsSection}
        onSettingsSectionChange={setSettingsSection}
        terminalOpen={terminalOpen}
        onToggleTerminal={() => setTerminalOpen((open) => !open)}
        onCloseTerminal={() => setTerminalOpen(false)}
        threads={threads}
        activeThreadId={activeThreadId}
        activeThreadTitle={activeThreadTitle}
        onCreateThread={handleCreateThread}
        onSelectThread={handleSelectThread}
        onArchiveThread={handleArchiveThread}
        chatMessages={activeMessages}
        onSendMessage={handleSendMessage}
        chatLoading={isChatLoading}
        chatError={chatError}
      >
        {view === "chat" ? (
          <ChatView
            messages={displayedMessages}
            isLoading={isChatLoading}
            streamPhase={streamPhase}
            streamToolName={streamToolName}
            streamingReasoning={streamingReasoning}
            showReasoning={showReasoning}
            onSend={handleSendMessage}
            chatError={chatError}
            hasActiveThread={true}
            projectName="boson"
            onOpenSettings={() => {
              setView("settings");
              setSettingsSection("configuration");
            }}
          />
        ) : (
          <SettingsPage section={settingsSection} />
        )}
      </Layout>
      <Toaster />
    </>
  );
}
