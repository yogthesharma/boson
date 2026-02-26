import { useState } from "react";
import { AppNavbar } from "./AppNavbar";
import { AppSidebar } from "./AppSidebar";
import { BottomTerminal } from "./BottomTerminal";

/**
 * App layout with persistent sidebar (like Next.js layout).
 * Wrap your page content as children; the sidebar stays and only the right area updates.
 */
export function Layout({
  children,
  view = "chat",
  onNavigate,
  settingsSection = "general",
  onSettingsSectionChange,
  terminalOpen = false,
  onToggleTerminal,
  onCloseTerminal,
  threads = [],
  activeThreadId = null,
  activeThreadTitle = null,
  onCreateThread,
  onSelectThread,
  onArchiveThread,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        view={view}
        onNavigate={onNavigate}
        settingsSection={settingsSection}
        onSettingsSectionChange={onSettingsSectionChange}
        threads={threads}
        activeThreadId={activeThreadId}
        onCreateThread={onCreateThread}
        onSelectThread={onSelectThread}
        onArchiveThread={onArchiveThread}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {view !== "settings" && (
          <AppNavbar
            terminalOpen={terminalOpen}
            onToggleTerminal={onToggleTerminal}
            activeThreadTitle={activeThreadTitle}
          />
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-bl-lg bg-background">
          {children}
        </main>
        {view !== "settings" && (
          <BottomTerminal open={terminalOpen} onClose={onCloseTerminal} />
        )}
      </div>
    </div>
  );
}
