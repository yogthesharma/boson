import {
  IconCheck,
  IconChevronDown,
  IconDeviceGamepad2,
  IconFileText,
  IconFolder,
  IconFolderPlus,
  IconPencil,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    id: "snake",
    icon: IconDeviceGamepad2,
    label: "Build a classic Snake game in this repo.",
  },
  {
    id: "pdf",
    icon: IconFileText,
    label: "Create a one-page $pdf that summarizes this app.",
  },
  {
    id: "plan",
    icon: IconPencil,
    label: "Create a plan to...",
  },
];

/** Prompt-style icon: >_ inside a rounded shape */
function PromptIcon({ className }) {
  return (
    <div
      className={cn(
        "flex size-12 items-center justify-center rounded-xl border border-border bg-muted/30 text-foreground",
        className,
      )}
    >
      <span className="font-mono text-lg font-medium">&gt;_</span>
    </div>
  );
}

/** Centered "Let's build" + project selector for the middle of the screen */
export function NewThreadEmptyStateCenter({
  projects = [{ id: "default", name: "boson" }],
  selectedProjectId = "default",
  onSelectProject,
  onAddNewProject,
  className,
}) {
  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];
  const selectedName = selectedProject?.name ?? "this repo";

  const handleAddNewProject = () => {
    window.api?.dialog?.showOpenDirectory?.().catch(() => {});
    onAddNewProject?.();
  };

  return (
    <div
      className={cn(
        "flex min-h-full flex-col items-center justify-center px-4",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <PromptIcon />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground">
            Let's build
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center !text-2xl gap-1 text-base text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-0"
                aria-label="Select project"
              >
                {selectedName}
                <IconChevronDown size={16} stroke={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuLabel className="text-muted-foreground">
                Select your project
              </DropdownMenuLabel>
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onSelectProject?.(project.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <IconFolder size={16} stroke={1.5} className="shrink-0" />
                    {project.name}
                  </span>
                  {selectedProjectId === project.id && (
                    <IconCheck size={16} stroke={1.5} className="shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleAddNewProject}
                className="flex items-center gap-2"
              >
                <IconFolderPlus size={16} stroke={1.5} className="shrink-0" />
                Add new project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/** Suggestion cards + Explore more, to sit just above the input */
export function NewThreadEmptyStateSuggestions({
  onSuggestionClick,
  onExploreMore,
  className,
}) {
  return (
    <div className={cn("flex flex-col gap-3 px-4 pb-2", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSuggestionClick?.(label)}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50 hover:border-muted-foreground/30"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60 text-foreground">
              <Icon size={20} stroke={1.5} />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>
      {onExploreMore && (
        <button
          type="button"
          onClick={onExploreMore}
          className="self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Explore more
        </button>
      )}
    </div>
  );
}
