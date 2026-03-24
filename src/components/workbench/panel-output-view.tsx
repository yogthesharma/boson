import { useSyncExternalStore } from "react";

const OUTPUT_CHANNELS_KEY = "boson.output.channels";
const OUTPUT_ACTIVE_KEY = "boson.output.activeChannel";

type OutputChannels = Record<string, string[]>;

let outputChannels: OutputChannels = {
  Build: [
    "[build] Boson workbench ready",
    "Boson started successfully.",
    "Listening on port 3000.",
    "No issues detected",
  ],
  Tasks: [],
  Extensions: [],
};
let activeOutputChannel = "Build";
const outputListeners = new Set<() => void>();
let initialized = false;
let outputSnapshot: { channels: OutputChannels; active: string } = {
  channels: outputChannels,
  active: activeOutputChannel,
};

function refreshSnapshot() {
  outputSnapshot = { channels: outputChannels, active: activeOutputChannel };
}

function emitOutputChange() {
  refreshSnapshot();
  outputListeners.forEach((l) => l());
}

function subscribeOutput(listener: () => void) {
  ensureInitialized();
  outputListeners.add(listener);
  return () => outputListeners.delete(listener);
}

function readPersistedChannels() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(OUTPUT_CHANNELS_KEY);
    const active = localStorage.getItem(OUTPUT_ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OutputChannels;
      if (parsed && typeof parsed === "object") {
        outputChannels = parsed;
      }
    }
    if (active && outputChannels[active]) {
      activeOutputChannel = active;
    }
  } catch {
    // ignore invalid stored data
  }
}

function persistChannels() {
  if (typeof window === "undefined") return;
  localStorage.setItem(OUTPUT_CHANNELS_KEY, JSON.stringify(outputChannels));
  localStorage.setItem(OUTPUT_ACTIVE_KEY, activeOutputChannel);
}

function getOutputSnapshot() {
  ensureInitialized();
  return outputSnapshot;
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  readPersistedChannels();
  refreshSnapshot();
}

export function setActiveOutputChannel(channel: string) {
  if (!outputChannels[channel]) {
    outputChannels[channel] = [];
  }
  activeOutputChannel = channel;
  persistChannels();
  emitOutputChange();
}

export function clearOutputLines(channel?: string) {
  const target = channel ?? activeOutputChannel;
  if (!outputChannels[target]) {
    outputChannels[target] = [];
  }
  outputChannels[target] = [];
  persistChannels();
  emitOutputChange();
}

export function appendOutputLine(line: string, channel = activeOutputChannel) {
  if (!outputChannels[channel]) {
    outputChannels[channel] = [];
  }
  outputChannels[channel] = [...outputChannels[channel], line];
  persistChannels();
  emitOutputChange();
}

export function PanelOutputView() {
  const snapshot = useSyncExternalStore(
    subscribeOutput,
    getOutputSnapshot,
    getOutputSnapshot,
  );
  const channels = Object.keys(snapshot.channels);
  const active = snapshot.active;
  const lines = snapshot.channels[active] ?? [];

  return (
    <div className="text-foreground/85 space-y-1.5 p-3 font-mono text-xs leading-relaxed">
      <div className="mb-2 flex items-center gap-1">
        {channels.map((channel) => {
          const selected = channel === active;
          return (
            <button
              key={channel}
              type="button"
              className={`rounded-sm px-2 py-0.5 text-[11px] ${
                selected
                  ? "bg-background text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveOutputChannel(channel)}
            >
              {channel}
            </button>
          );
        })}
      </div>
      {lines.length === 0 ? (
        <div className="text-muted-foreground">No output in {active} channel.</div>
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
