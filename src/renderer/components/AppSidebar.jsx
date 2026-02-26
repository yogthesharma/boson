import {
  IconAdjustments,
  IconArchive,
  IconArrowLeft,
  IconCloud,
  IconFilter,
  IconFolder,
  IconFolderPlus,
  IconGitBranch,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMessage2Plus,
  IconServer,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "configuration", label: "Configuration", icon: IconAdjustments },
  { id: "personalization", label: "Personalization", icon: IconUser },
  { id: "mcp-servers", label: "MCP Servers", icon: IconServer },
  { id: "git", label: "Git", icon: IconGitBranch },
  { id: "worktrees", label: "Worktrees", icon: IconFolder },
  { id: "environments", label: "Environments", icon: IconCloud },
  { id: "archived-threads", label: "Archived Threads", icon: IconArchive },
];

export function AppSidebar({
  open,
  onToggle,
  view = "chat",
  onNavigate,
  settingsSection = "general",
  onSettingsSectionChange,
  threads = [],
  activeThreadId = null,
  onCreateThread,
  onSelectThread,
  onArchiveThread,
}) {
  const isSettings = view === "settings";

  return (
    <aside
      className={`flex relative rounded-r-2xl shrink-0 flex-col overflow-visible border-r border-border/30 bg-muted/20 pt-8 transition-[width] duration-200 ease-in-out ${open ? "w-72" : "w-0 border-r-0"}`}
      style={{ WebkitAppRegion: "drag" }}
    >
      <div
        className={`flex items-center gap-0.5 p-2 ${open ? "" : "absolute left-0 top-0 z-30"}`}
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <Button
          variant="ghost"
          size="icon"
          className={`shrink-0 z-20 text-muted-foreground hover:bg-accent hover:text-accent-foreground ${open ? "absolute left-[76px] top-[2px]" : "relative left-0"}`}
          style={{ WebkitAppRegion: "no-drag" }}
          onClick={onToggle}
          title={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? (
            <IconLayoutSidebarLeftCollapse size={34} stroke={1.5} />
          ) : (
            <IconLayoutSidebarLeftExpand stroke={1.5} />
          )}
        </Button>
      </div>
      {open && (
        <>
          {isSettings ? (
            <div
              className="flex flex-col gap-0.5 px-2 pb-2"
              style={{ WebkitAppRegion: "no-drag" }}
            >
              <button
                type="button"
                onClick={() => onNavigate?.("chat")}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <IconArrowLeft size={18} stroke={1.5} className="shrink-0" />
                Back to app
              </button>
              <nav className="mt-2 flex flex-col gap-0.5">
                {SETTINGS_SECTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSettingsSectionChange?.(s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        settingsSection === s.id
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <Icon size={18} stroke={1.5} className="shrink-0" />
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          ) : (
            <>
              <div
                className="flex flex-col gap-0.5 px-2 pb-2"
                style={{ WebkitAppRegion: "no-drag" }}
              >
                <button
                  type="button"
                  onClick={() => onCreateThread?.()}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <IconMessage2Plus
                    size={18}
                    stroke={1.5}
                    className="shrink-0"
                  />
                  New Thread
                </button>
              </div>

              <div
                className="flex flex-col px-3"
                style={{ WebkitAppRegion: "no-drag" }}
              >
                <div className="flex items-center justify-between px-2 py-2 text-sm font-medium text-foreground/80">
                  <p>Threads</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md p-1 hover:bg-accent"
                      title="Add project (later)"
                    >
                      <IconFolderPlus
                        size={15}
                        stroke={1.5}
                        className="shrink-0"
                      />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 hover:bg-accent"
                      title="Filter (later)"
                    >
                      <IconFilter size={15} stroke={1.5} className="shrink-0" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 overflow-y-auto min-h-0">
                  {threads.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No threads yet. Create one above.
                    </p>
                  ) : (
                    threads.map((thread) => (
                      <div
                        key={thread.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          activeThreadId === thread.id
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectThread?.(thread.id)}
                          className="min-w-0 flex-1 truncate text-left transition-colors text-inherit hover:text-inherit"
                          title={thread.title}
                        >
                          {thread.title}
                        </button>
                        {onArchiveThread && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveThread(thread.id);
                            }}
                            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground focus:opacity-100 focus:outline-none"
                            title="Archive thread"
                          >
                            <IconArchive size={14} stroke={1.5} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          <div className="min-h-0 flex-1" />
          {!isSettings && (
            <footer
              className="flex flex-col gap-0.5 px-2 py-2"
              style={{ WebkitAppRegion: "no-drag" }}
            >
              {/* Direct button: works reliably in Electron (no portal) */}
              <button
                type="button"
                onClick={() => onNavigate?.("settings")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <IconSettings size={18} stroke={1.5} className="shrink-0" />
                Settings
              </button>
            </footer>
          )}
        </>
      )}
    </aside>
  );
}
