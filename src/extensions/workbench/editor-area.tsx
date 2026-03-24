import {
  IconBrandGithub,
  IconCode,
  IconCommand,
  IconDeviceLaptop,
  IconFolder,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  registerCommand,
  unregisterCommand,
} from "@/extensions/commands/command-service";
import { cn } from "@/lib/utils";
import { MonacoEditorPane } from "@/editor/monaco-editor-pane";
import { useEditorSession } from "@/editor/editor-session-context";
import { useWorkspace } from "@/workspace/workspace-context";
import { useWorkbenchState } from "./workbench-state";

export function EditorArea() {
  const { state } = useWorkbenchState();
  const {
    tabs,
    activeTabId,
    monacoTheme,
    editorError,
    clearError,
    isDirty,
    selectTab,
    closeTab,
    bindEditor,
    unbindEditor,
    runEditorAction,
    toggleEol,
    showMessage,
  } = useEditorSession();
  const { rootPath, recentProjects, openProjectDialog, setWorkspaceRoot } =
    useWorkspace();

  const showOnboarding = tabs.length === 0 && !rootPath;
  const showNoFileState = tabs.length === 0 && !!rootPath;

  useEffect(() => {
    registerCommand("boson.status.gotoLine", () => {
      void runEditorAction("editor.action.gotoLine");
    });
    registerCommand("boson.status.changeLanguage", () => {
      void runEditorAction("editor.action.changeLanguageMode");
    });
    registerCommand("boson.status.changeEncoding", () => {
      showMessage("Only UTF-8 encoding is currently supported.");
    });
    registerCommand("boson.status.toggleEol", () => {
      toggleEol();
    });
    return () => {
      unregisterCommand("boson.status.gotoLine");
      unregisterCommand("boson.status.changeLanguage");
      unregisterCommand("boson.status.changeEncoding");
      unregisterCommand("boson.status.toggleEol");
    };
  }, [runEditorAction, toggleEol, showMessage]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
        state.auxiliaryBarVisible && "border-r border-border",
      )}
    >
      {tabs.length > 0 ? (
        <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-1 text-sm">
          {tabs.map((t) => {
            const active = t.id === activeTabId;
            const dirty = isDirty(t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  "flex h-7 max-w-[10rem] shrink-0 items-center rounded-t border border-transparent border-b-0",
                  active
                    ? "border-border bg-muted/30"
                    : "bg-transparent hover:bg-muted/60",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-2 text-left text-xs"
                  onClick={() => selectTab(t.id)}
                  title={t.path}
                >
                  {dirty ? <span className="text-primary">● </span> : null}
                  {t.name}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-sm"
                  aria-label={`Close ${t.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                >
                  <IconX size={12} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {editorError ? (
        <div className="text-destructive flex shrink-0 items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs">
          <span className="min-w-0 truncate">{editorError}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 shrink-0"
            onClick={clearError}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {showOnboarding ? (
          <div className="bg-background text-foreground flex h-full flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="mb-1 text-3xl font-semibold tracking-tight">
                BOSON
              </div>
              <div className="text-muted-foreground text-sm">
                Open a project to get started
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void openProjectDialog()}
                className="bg-card text-card-foreground border-border hover:bg-muted flex min-w-[9rem] items-center gap-2 rounded-lg border px-4 py-3 text-sm"
              >
                <IconFolder size={16} /> Open project
              </button>
              <button
                type="button"
                className="bg-card text-card-foreground border-border hover:bg-muted flex min-w-[9rem] items-center gap-2 rounded-lg border px-4 py-3 text-sm"
              >
                <IconBrandGithub size={16} /> Clone repo
              </button>
              <button
                type="button"
                className="bg-card text-card-foreground border-border hover:bg-muted flex min-w-[9rem] items-center gap-2 rounded-lg border px-4 py-3 text-sm"
              >
                <IconDeviceLaptop size={16} /> Connect via SSH
              </button>
            </div>
            {recentProjects.length > 0 ? (
              <div className="w-full max-w-xl">
                <div className="text-muted-foreground mb-2 text-xs">
                  Recent projects
                </div>
                <div className="space-y-1">
                  {recentProjects.slice(0, 5).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="hover:bg-muted flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm"
                      onClick={() => setWorkspaceRoot(p)}
                    >
                      <span className="truncate pr-3">
                        {p.split(/[/\\]/).pop() ?? p}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : showNoFileState ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <IconCode size={48} className="opacity-70" />
            <div className="space-y-1">
              <div className="text-foreground text-base font-medium">
                No file is open
              </div>
              <div className="text-sm">
                Open a file from Explorer or use one of these shortcuts
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-8 rounded bg-muted px-3 py-1.5">
                <span>New Agent</span>
                <span className="text-xs">
                  <IconCommand size={12} className="mr-1 inline" />L
                </span>
              </div>
              <div className="flex items-center justify-between gap-8 rounded bg-muted px-3 py-1.5">
                <span>Hide Terminal</span>
                <span className="text-xs">
                  <IconCommand size={12} className="mr-1 inline" />J
                </span>
              </div>
              <div className="flex items-center justify-between gap-8 rounded bg-muted px-3 py-1.5">
                <span>Search Files</span>
                <span className="text-xs">
                  <IconCommand size={12} className="mr-1 inline" />P
                </span>
              </div>
              <div className="flex items-center justify-between gap-8 rounded bg-muted px-3 py-1.5">
                <span>Open Browser</span>
                <span className="text-xs">
                  <IconTerminal2 size={12} className="mr-1 inline" />B
                </span>
              </div>
            </div>
          </div>
        ) : (
          <MonacoEditorPane
            theme={monacoTheme}
            onMount={bindEditor}
            onUnmount={unbindEditor}
          />
        )}
      </div>
    </div>
  );
}
