export type ExplorerDecorationBadge = {
  id: string;
  label: string;
  tooltip?: string;
  tone?: "muted" | "accent" | "success" | "warning" | "error";
};

export type ExplorerDecorationNode = {
  name: string;
  fullPath: string;
  parentPath: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type ExplorerDecorationContext = {
  rootPath: string | null;
  isDirtyPath: (path: string) => boolean;
  getMarkerSummary: (
    path: string,
  ) => { errors: number; warnings: number } | undefined;
  getScmState:
    (path: string) =>
      | "modified"
      | "added"
      | "deleted"
      | "renamed"
      | "untracked"
      | undefined;
};

export type ExplorerDecorationProvider = {
  id: string;
  order: number;
  getBadges: (
    node: ExplorerDecorationNode,
    context: ExplorerDecorationContext,
  ) => ExplorerDecorationBadge[];
};

function createRegistry<T extends { id: string; order: number }>() {
  let items: T[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((l) => l());
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get(): T[] {
      return items;
    },
    register(entry: T) {
      items = [...items.filter((i) => i.id !== entry.id), entry].sort(
        (a, b) => a.order - b.order,
      );
      notify();
    },
    unregister(id: string) {
      items = items.filter((i) => i.id !== id);
      notify();
    },
  };
}

export const explorerDecorationRegistry = createRegistry<ExplorerDecorationProvider>();

let builtinRegistered = false;

export function registerBuiltinExplorerDecorationProviders(): void {
  if (builtinRegistered) return;
  builtinRegistered = true;

  explorerDecorationRegistry.register({
    id: "boson.explorer.decoration.modified",
    order: 10,
    getBadges(node, context) {
      if (!node.isFile || !context.isDirtyPath(node.fullPath)) return [];
      return [
        {
          id: "modified",
          label: "●",
          tooltip: "Modified",
          tone: "accent",
        },
      ];
    },
  });

  explorerDecorationRegistry.register({
    id: "boson.explorer.decoration.diagnostics",
    order: 20,
    getBadges(node, context) {
      if (!node.isFile) return [];
      const summary = context.getMarkerSummary(node.fullPath);
      if (!summary) return [];
      const badges: ExplorerDecorationBadge[] = [];
      if (summary.errors > 0) {
        badges.push({
          id: "errors",
          label: `E${summary.errors}`,
          tooltip: `${summary.errors} error${summary.errors === 1 ? "" : "s"}`,
          tone: "error",
        });
      }
      if (summary.warnings > 0) {
        badges.push({
          id: "warnings",
          label: `W${summary.warnings}`,
          tooltip: `${summary.warnings} warning${summary.warnings === 1 ? "" : "s"}`,
          tone: "warning",
        });
      }
      return badges;
    },
  });

  explorerDecorationRegistry.register({
    id: "boson.explorer.decoration.scm",
    order: 30,
    getBadges(node, context) {
      const scm = context.getScmState(node.fullPath);
      if (!scm) return [];
      switch (scm) {
        case "modified":
          return [{ id: "scm-modified", label: "M", tooltip: "Modified", tone: "warning" }];
        case "added":
          return [{ id: "scm-added", label: "A", tooltip: "Added", tone: "success" }];
        case "deleted":
          return [{ id: "scm-deleted", label: "D", tooltip: "Deleted", tone: "error" }];
        case "renamed":
          return [{ id: "scm-renamed", label: "R", tooltip: "Renamed", tone: "accent" }];
        case "untracked":
          return [{ id: "scm-untracked", label: "U", tooltip: "Untracked", tone: "muted" }];
      }
    },
  });
}

