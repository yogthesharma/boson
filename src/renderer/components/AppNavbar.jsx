import {
  IconChevronDown,
  IconClipboard,
  IconFile,
  IconFolderOpen,
  IconGitCommit,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppNavbar({
  terminalOpen = false,
  onToggleTerminal,
  activeThreadTitle = null,
}) {
  return (
    <nav className="flex shrink-0 items-center justify-between gap-4 px-4 py-2">
      <span className="truncate text-sm text-foreground" title={activeThreadTitle ?? undefined}>
        {activeThreadTitle ?? "New thread"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <IconPlayerPlay size={18} stroke={1.5} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 bg-primary/15 text-foreground hover:bg-primary/25"
            >
              <IconFolderOpen size={16} stroke={1.5} />
              Open
              <IconChevronDown size={14} stroke={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Open folder</DropdownMenuItem>
            <DropdownMenuItem>Open file</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8 gap-1.5">
              <IconGitCommit size={16} stroke={1.5} />
              Commit
              <IconChevronDown size={14} stroke={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Commit</DropdownMenuItem>
            <DropdownMenuItem>Commit & push</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className={[
            "h-8 w-8 shrink-0 hover:text-foreground",
            terminalOpen
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground",
          ].join(" ")}
          aria-label={terminalOpen ? "Hide terminal" : "Show terminal"}
          onClick={onToggleTerminal}
        >
          <IconTerminal2 size={18} stroke={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <IconFile size={18} stroke={1.5} />
        </Button>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-green-600 dark:text-green-400">+10,420</span>
          <span className="text-red-600 dark:text-red-400">-0</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <IconClipboard size={18} stroke={1.5} />
        </Button>
      </div>
    </nav>
  );
}
