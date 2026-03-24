import { useMemo } from "react";
import { workbenchViewRegistry } from "./registry";
import { useRegistrySubscription } from "./use-registry-subscription";

export function AuxiliaryBar() {
  const allViews = useRegistrySubscription(workbenchViewRegistry.subscribe, () =>
    workbenchViewRegistry.get(),
  );

  const auxiliaryViews = useMemo(
    () =>
      [...allViews].filter((v) => v.location === "auxiliary").sort((a, b) => a.order - b.order),
    [allViews],
  );

  if (auxiliaryViews.length === 0) {
    return null;
  }

  return (
    <aside className="hidden min-h-0 w-80 min-w-[18rem] max-w-[22rem] shrink-0 flex-col self-stretch border-l border-border bg-muted lg:flex">
      {auxiliaryViews.map((view) => (
        <div key={view.id} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {view.title.trim() ? (
            <div className="flex h-8 shrink-0 items-center border-b border-border px-3 text-sm font-medium">
              {view.title}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{view.render()}</div>
        </div>
      ))}
    </aside>
  );
}
