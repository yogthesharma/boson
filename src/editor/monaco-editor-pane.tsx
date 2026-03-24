import { useEffect, useRef } from "react";

type EditorApi = {
  monaco: typeof import("monaco-editor");
  editor: import("monaco-editor").editor.IStandaloneCodeEditor;
};

type Props = {
  theme: "vs" | "vs-dark";
  onMount: (api: EditorApi) => void;
  onUnmount: () => void;
};

export function MonacoEditorPane({ theme, onMount, onUnmount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onMountRef = useRef(onMount);
  const onUnmountRef = useRef(onUnmount);
  onMountRef.current = onMount;
  onUnmountRef.current = onUnmount;

  useEffect(() => {
    let cancelled = false;
    let editor: import("monaco-editor").editor.IStandaloneCodeEditor | null = null;

    void import("monaco-editor").then((monaco) => {
      if (cancelled || !containerRef.current) {
        return;
      }
      monaco.editor.setTheme(theme);
      editor = monaco.editor.create(containerRef.current, {
        automaticLayout: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: "on",
      });
      onMountRef.current({ monaco, editor });
    });

    return () => {
      cancelled = true;
      editor?.dispose();
      onUnmountRef.current();
    };
  }, []);

  useEffect(() => {
    void import("monaco-editor").then((m) => m.editor.setTheme(theme));
  }, [theme]);

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}
