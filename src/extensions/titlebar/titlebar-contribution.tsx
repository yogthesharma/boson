import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { executeCommand } from "@/extensions/commands/command-service";
import { getTitlebarContributions, subscribeTitlebarContributions } from "./registry";
import { TITLEBAR_ICONS } from "./titlebar-icons";
import type {
  TitlebarCommandContribution,
  TitlebarContribution,
  TitlebarGroup,
} from "./types";

function TitlebarCommandButton({
  contribution,
}: {
  contribution: TitlebarCommandContribution;
}) {
  const Icon = TITLEBAR_ICONS[contribution.icon];
  const onClick = useCallback(() => {
    void executeCommand(contribution.command);
  }, [contribution.command]);

  return (
    <Button
      type="button"
      data-tauri-no-drag
      variant="ghost"
      size="icon-xs"
      aria-label={contribution.ariaLabel}
      onClick={onClick}
    >
      <Icon size={12} />
    </Button>
  );
}

function TitlebarContributionItem({ contribution }: { contribution: TitlebarContribution }) {
  if (contribution.kind === "custom") {
    return <>{contribution.render()}</>;
  }
  return <TitlebarCommandButton contribution={contribution} />;
}

export function useTitlebarContributionsForGroup(group: TitlebarGroup): TitlebarContribution[] {
  const [items, setItems] = useState<TitlebarContribution[]>(() =>
    getTitlebarContributions().filter((c) => c.group === group),
  );

  useEffect(() => {
    const sync = () => {
      setItems(getTitlebarContributions().filter((c) => c.group === group));
    };
    sync();
    return subscribeTitlebarContributions(sync);
  }, [group]);

  return items;
}

export function TitlebarContributionList({ group }: { group: TitlebarGroup }) {
  const items = useTitlebarContributionsForGroup(group);
  return (
    <>
      {items.map((c) => (
        <TitlebarContributionItem key={c.id} contribution={c} />
      ))}
    </>
  );
}
