import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { TitlebarExtensionProvider } from "./extensions/titlebar/titlebar-extension-provider";
import { WorkbenchProvider } from "./extensions/workbench/workbench-provider";
import { EditorSessionProvider } from "./editor/editor-session-context";
import { WorkspaceProvider } from "./workspace/workspace-context";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <WorkspaceProvider>
        <WorkbenchProvider>
          <EditorSessionProvider>
            <TitlebarExtensionProvider>
              <App />
            </TitlebarExtensionProvider>
          </EditorSessionProvider>
        </WorkbenchProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
