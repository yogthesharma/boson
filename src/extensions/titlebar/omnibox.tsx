import { IconSearch } from "@tabler/icons-react";

export function TitlebarOmnibox() {
  return (
    <div
      data-tauri-no-drag
      className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-sm border border-border bg-muted text-xs font-medium h-2/3"
    >
      <IconSearch size={12} />
      Boson
    </div>
  );
}
