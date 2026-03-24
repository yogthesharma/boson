import type {
  StatusBarItemContribution,
  ViewContainerContribution,
  WorkbenchViewContribution,
} from "./types";

function sortByOrder<T extends { order: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order);
}

function createRegistry<T extends { id: string; order: number }>() {
  let items: T[] = [];
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get(): T[] {
      return items;
    },
    register(entry: T) {
      items = sortByOrder([...items.filter((i) => i.id !== entry.id), entry]);
      notify();
    },
    unregister(id: string) {
      items = items.filter((i) => i.id !== id);
      notify();
    },
  };
}

const viewContainers = createRegistry<ViewContainerContribution>();
const views = createRegistry<WorkbenchViewContribution>();
const statusBarItems = createRegistry<StatusBarItemContribution>();

export const workbenchViewContainerRegistry = viewContainers;
export const workbenchViewRegistry = views;
export const workbenchStatusBarRegistry = statusBarItems;

export function getViewsForLocation(
  location: WorkbenchViewContribution["location"],
  containerId: string,
): WorkbenchViewContribution[] {
  return sortByOrder(
    views.get().filter((v) => v.location === location && v.containerId === containerId),
  );
}

export function getAuxiliaryViews(): WorkbenchViewContribution[] {
  return sortByOrder(views.get().filter((v) => v.location === "auxiliary"));
}

export function getPanelViews(): WorkbenchViewContribution[] {
  return sortByOrder(views.get().filter((v) => v.location === "panel"));
}
