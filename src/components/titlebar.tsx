import { TitlebarContributionList } from "@/extensions/titlebar/titlebar-contribution";

export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-8 w-full shrink-0 select-none items-center border-b border-border bg-background px-4"
      style={{ paddingLeft: "80px" }}
    >
      <div data-tauri-drag-region className="flex-1" />

      <div
        data-tauri-drag-region
        className="flex h-full flex-1 items-center gap-2 text-xs font-medium text-foreground"
      >
        <TitlebarContributionList group="center" />
      </div>

      <div data-tauri-drag-region className="h-full flex-1" />
      <div className="flex items-center" data-tauri-no-drag>
        <TitlebarContributionList group="end" />
      </div>
    </div>
  );
}
