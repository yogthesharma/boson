import { IconDeviceFloppy, IconDots, IconFiles, IconX } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorSession } from "@/editor/editor-session-context";

export type OpenEditorsSortMode = "editorOrder" | "alphabetical" | "fullPath";

export function OpenEditorsToolbar({
  sortMode,
  setSortMode,
}: {
  sortMode: OpenEditorsSortMode;
  setSortMode: (mode: OpenEditorsSortMode) => void;
}) {
  const { tabs, activeTabId, saveActive, saveAllDirty, closeAllTabs, isDirty } =
    useEditorSession();

  const activeDirty =
    !!activeTabId && isDirty(activeTabId);
  const anyDirty = tabs.some((t) => isDirty(t.id));

  return (
    <>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-1 disabled:pointer-events-none disabled:opacity-30"
        title="Save active file"
        disabled={!activeTabId || !activeDirty}
        onClick={() => void saveActive()}
      >
        <IconDeviceFloppy size={14} stroke={1.5} />
      </button>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-1 disabled:pointer-events-none disabled:opacity-30"
        title="Save all dirty files"
        disabled={!anyDirty}
        onClick={() => void saveAllDirty()}
      >
        <IconFiles size={14} stroke={1.5} />
      </button>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-1 disabled:pointer-events-none disabled:opacity-30"
        title="Close all editors"
        disabled={tabs.length === 0}
        onClick={closeAllTabs}
      >
        <IconX size={14} stroke={1.75} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-1"
            title="Open Editors options"
          >
            <IconDots size={14} stroke={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem disabled={sortMode !== "editorOrder"}>
            Drag and drop is available in Editor Order
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={closeAllTabs} disabled={tabs.length === 0}>
            Close All
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sortMode}
            onValueChange={(v) => setSortMode(v as OpenEditorsSortMode)}
          >
            <DropdownMenuRadioItem value="editorOrder">
              Sort by Editor Order
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="alphabetical">
              Sort Alphabetically
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="fullPath">
              Sort by Full Path
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
