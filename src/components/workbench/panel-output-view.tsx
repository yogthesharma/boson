import { useSyncExternalStore } from "react";

let outputLines = [
  "[build] Boson workbench ready",
  "Boson started successfully.",
  "Listening on port 3000.",
  "No issues detected",
];
const outputListeners = new Set<() => void>();

function emitOutputChange() {
  outputListeners.forEach((l) => l());
}

function subscribeOutput(listener: () => void) {
  outputListeners.add(listener);
  return () => outputListeners.delete(listener);
}

function getOutputSnapshot() {
  return outputLines;
}

export function clearOutputLines() {
  outputLines = [];
  emitOutputChange();
}

export function appendOutputLine(line: string) {
  outputLines = [...outputLines, line];
  emitOutputChange();
}

export function PanelOutputView() {
  const lines = useSyncExternalStore(subscribeOutput, getOutputSnapshot);
  return (
    <div className="text-foreground/85 space-y-1.5 p-3 font-mono text-xs leading-relaxed">
      {lines.length === 0 ? (
        <div className="text-muted-foreground">Output cleared.</div>
      ) : (
        lines.map((line, index) => (
          <div
            key={`${index}-${line}`}
            className={line.includes("No issues") ? "text-amber-600 dark:text-amber-400" : undefined}
          >
            {line.includes("No issues") ? `▲ ${line}` : line}
          </div>
        ))
      )}
    </div>
  );
}
