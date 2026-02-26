import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  IconArrowUp,
  IconChevronDown,
  IconGitBranch,
  IconMicrophone,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

export const ChatInput = forwardRef(function ChatInput(
  { value = "", onChange, onSend, disabled, chatError, onOpenSettings },
  ref
) {
  const requireCmdEnterForMultiline = useSettingsStore(
    (s) => s.general?.requireCmdEnterForMultiline === true
  );
  const [internalInput, setInternalInput] = useState("");
  const input = value !== undefined && onChange ? value : internalInput;
  const setInput = onChange || setInternalInput;
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [length, setLength] = useState("Medium");
  const [branch, setBranch] = useState("main");

  useEffect(() => {
    let cancelled = false;
    window.api.settings
      .listModels()
      .then((list) => {
        if (cancelled) return;
        const arr = list || [];
        const chatOnly = arr.filter((m) => (m.purpose || "chat") === "chat");
        setModels(chatOnly);
        const defaultModel = chatOnly.find((m) => m.isDefault) || chatOnly[0];
        if (defaultModel) setSelectedModelId(defaultModel.id);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const isCredentialErrorForSelected =
    chatError &&
    (chatError.code === "MISSING_API_KEY" || chatError.code === "INVALID_API_KEY") &&
    chatError.modelProfileId === selectedModelId;
  const blockSend =
    disabled || !input.trim() || !selectedModelId || isCredentialErrorForSelected;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || blockSend) return;
    onSend(text, selectedModelId);
    setInput("");
  };
  const handleChange = (e) => setInput(e.target.value);

  return (
    <div className="shrink-0 px-4 py-3">
      {isCredentialErrorForSelected && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span>
            {chatError.code === "MISSING_API_KEY"
              ? "Add API key for this model to send messages."
              : "Invalid API key. Update it in Settings."}
          </span>
          {onOpenSettings && (
            <Button variant="secondary" size="sm" onClick={onOpenSettings} type="button">
              <IconSettings size={14} className="mr-1" />
              Settings → Configuration
            </Button>
          )}
        </div>
      )}
      {models.length === 0 && !isCredentialErrorForSelected && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span>No chat models configured. Add a model in Settings → Models & API and set “Use as” to Chat. For coding, pick one with high capability and a large context window.</span>
          {onOpenSettings && (
            <Button variant="link" size="sm" className="h-auto shrink-0 p-0 text-primary" onClick={onOpenSettings} type="button">
              Open Settings
            </Button>
          )}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-sm"
      >
        <div className="min-h-[3rem] flex-1 px-5 pt-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (requireCmdEnterForMultiline) {
                if (e.metaKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              } else {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }
            }}
            placeholder={onChange ? "Ask anything..." : "Ask for follow-up changes"}
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Add attachment"
            >
              <IconPlus size={18} stroke={1.5} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Use a powerful model with large context for coding"
                >
                  {selectedModel ? selectedModel.label : "Select chat model"}
                  <IconChevronDown size={14} stroke={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {models.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => setSelectedModelId(m.id)}>
                    {m.label}
                    {m.isDefault && " (default)"}
                  </DropdownMenuItem>
                ))}
                {models.length === 0 && (
                  <DropdownMenuItem disabled>No models</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {length}
                  <IconChevronDown size={14} stroke={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setLength("Short")}>Short</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLength("Medium")}>Medium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLength("Long")}>Long</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <IconGitBranch size={14} stroke={1.5} />
                  {branch}
                  <IconChevronDown size={14} stroke={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setBranch("main")}>main</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBranch("develop")}>develop</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Voice input"
            >
              <IconMicrophone size={18} stroke={1.5} />
            </Button>
            <Button
              type="submit"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 rounded-full bg-muted hover:bg-muted/80",
                blockSend ? "text-muted-foreground/50" : "text-foreground"
              )}
              title="Send"
              disabled={blockSend}
            >
              <IconArrowUp size={18} stroke={1.5} />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
});
