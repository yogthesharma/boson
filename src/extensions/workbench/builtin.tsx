import { AiChatView } from "@/components/workbench/ai-chat-view";
import { ExplorerView } from "@/components/workbench/explorer-view";
import { OpenEditorsPane } from "@/components/workbench/open-editors-view";
import { PanelOutputView } from "@/components/workbench/panel-output-view";
import { TerminalView } from "@/components/workbench/terminal-view";
import { useEditorSession } from "@/editor/editor-session-context";
import { registerBuiltinExplorerDecorationProviders } from "./explorer-decorations";
import {
  workbenchStatusBarRegistry,
  workbenchViewContainerRegistry,
  workbenchViewRegistry,
} from "./registry";

let registered = false;

function toLanguageLabel(languageId: string | null): string {
  if (!languageId) return "Plain Text";
  if (languageId === "typescript") return "TypeScript";
  if (languageId === "javascript") return "JavaScript";
  if (languageId === "plaintext") return "Plain Text";
  return languageId.slice(0, 1).toUpperCase() + languageId.slice(1);
}

function StatusLineColumn() {
  const { cursorLine, cursorColumn } = useEditorSession();
  return <span>{`Ln ${cursorLine ?? 1}, Col ${cursorColumn ?? 1}`}</span>;
}

function StatusEncoding() {
  const { encoding } = useEditorSession();
  return <span>{encoding ?? "UTF-8"}</span>;
}

function StatusEol() {
  const { eol } = useEditorSession();
  return <span>{eol ?? "LF"}</span>;
}

function StatusLanguage() {
  const { languageId } = useEditorSession();
  return <span>{toLanguageLabel(languageId)}</span>;
}

function SearchBody() {
  return (
    <div className="text-muted-foreground p-3 text-sm">
      Search is contributed by the workbench registry. Try registering another
      view with container{" "}
      <code className="text-foreground">workbench.view.search</code>.
    </div>
  );
}

function DebugBody() {
  return (
    <div className="text-muted-foreground p-3 text-sm">
      Debug sidebar placeholder — contribute views to{" "}
      <code className="text-foreground">workbench.view.debug</code>.
    </div>
  );
}

function SourceControlBody() {
  return (
    <div className="text-muted-foreground p-3 text-sm">
      Source control (Git) — commit graph and changes will live here. Contribute
      views to <code className="text-foreground">workbench.view.scm</code>.
    </div>
  );
}

function ExtensionsBody() {
  return (
    <div className="text-muted-foreground p-3 text-sm">
      Extensions marketplace placeholder — contribute views to{" "}
      <code className="text-foreground">workbench.view.extensions</code>.
    </div>
  );
}

export function registerBuiltinWorkbenchContributions(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerBuiltinExplorerDecorationProviders();

  workbenchViewContainerRegistry.register({
    id: "workbench.view.explorer",
    order: 10,
    title: "Explorer",
    iconId: "files",
  });
  workbenchViewContainerRegistry.register({
    id: "workbench.view.search",
    order: 20,
    title: "Search",
    iconId: "search",
  });
  workbenchViewContainerRegistry.register({
    id: "workbench.view.debug",
    order: 30,
    title: "Run and Debug",
    iconId: "debug",
  });
  workbenchViewContainerRegistry.register({
    id: "workbench.view.scm",
    order: 40,
    title: "Source Control",
    iconId: "git",
  });
  workbenchViewContainerRegistry.register({
    id: "workbench.view.extensions",
    order: 50,
    title: "Extensions",
    iconId: "extensions",
  });

  workbenchViewRegistry.register({
    id: "workbench.views.explorer.openEditors",
    location: "primary",
    containerId: "workbench.view.explorer",
    order: 5,
    title: "",
    sectionLayout: "compact",
    render: () => <OpenEditorsPane />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.explorer.files",
    location: "primary",
    containerId: "workbench.view.explorer",
    order: 10,
    title: "",
    render: () => <ExplorerView />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.search.main",
    location: "primary",
    containerId: "workbench.view.search",
    order: 10,
    title: "SEARCH",
    render: () => <SearchBody />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.debug.sidebar",
    location: "primary",
    containerId: "workbench.view.debug",
    order: 10,
    title: "DEBUG",
    render: () => <DebugBody />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.scm.main",
    location: "primary",
    containerId: "workbench.view.scm",
    order: 10,
    title: "SOURCE CONTROL",
    render: () => <SourceControlBody />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.extensions.main",
    location: "primary",
    containerId: "workbench.view.extensions",
    order: 10,
    title: "EXTENSIONS",
    render: () => <ExtensionsBody />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.aiChat",
    location: "auxiliary",
    containerId: "workbench.auxiliary",
    order: 10,
    title: "CHAT",
    render: () => <AiChatView />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.terminal",
    location: "panel",
    containerId: "workbench.panel",
    order: 10,
    title: "TERMINAL",
    render: () => <TerminalView />,
  });

  workbenchViewRegistry.register({
    id: "workbench.views.output",
    location: "panel",
    containerId: "workbench.panel",
    order: 20,
    title: "OUTPUT",
    render: () => <PanelOutputView />,
  });

  workbenchStatusBarRegistry.register({
    id: "boson.status.title",
    alignment: "left",
    order: 10,
    label: "Boson • Editor",
    tooltip: "Boson workspace status",
    priority: 40,
    minVisibleWidth: 560,
  });

  workbenchStatusBarRegistry.register({
    id: "boson.status.ln",
    alignment: "right",
    order: 10,
    render: () => <StatusLineColumn />,
    tooltip: "Go to line/column",
    commandId: "boson.status.gotoLine",
    priority: 100,
    minVisibleWidth: 520,
    when: (ctx) => ctx.hasActiveEditor,
  });
  workbenchStatusBarRegistry.register({
    id: "boson.status.encoding",
    alignment: "right",
    order: 20,
    render: () => <StatusEncoding />,
    tooltip: "Select file encoding",
    commandId: "boson.status.changeEncoding",
    priority: 60,
    minVisibleWidth: 820,
    when: (ctx) => ctx.hasActiveEditor,
  });
  workbenchStatusBarRegistry.register({
    id: "boson.status.eol",
    alignment: "right",
    order: 25,
    render: () => <StatusEol />,
    tooltip: "Select end of line sequence",
    commandId: "boson.status.toggleEol",
    priority: 70,
    minVisibleWidth: 740,
    when: (ctx) => ctx.hasActiveEditor,
  });
  workbenchStatusBarRegistry.register({
    id: "boson.status.lang",
    alignment: "right",
    order: 30,
    render: () => <StatusLanguage />,
    tooltip: "Select language mode",
    commandId: "boson.status.changeLanguage",
    priority: 80,
    minVisibleWidth: 920,
    when: (ctx) => ctx.hasActiveEditor,
  });
}
