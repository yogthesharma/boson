import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DEFAULT_PROJECT_ID = "default";

const formatThreadDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function ArchivedThreadsSettings() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadArchived = useCallback(() => {
    setLoading(true);
    window.api.threads
      .listArchived(DEFAULT_PROJECT_ID)
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  const handleUnarchive = useCallback(
    async (id) => {
      try {
        const ok = await window.api.threads.unarchive(id);
        if (ok) {
          loadArchived();
          toast.success("Thread unarchived");
        }
      } catch {
        toast.error("Failed to unarchive thread");
      }
    },
    [loadArchived]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">
        Archived threads
      </h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No archived threads. Archive a thread from the sidebar (hover a thread and click the archive icon) to see it here.
        </p>
      ) : (
        <ul className="flex flex-col rounded-lg border border-border bg-card">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className="flex items-center justify-between gap-4 px-4 py-3 not-last:border-b border-border"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">
                  {thread.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Archived {formatThreadDate(thread.archivedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => handleUnarchive(thread.id)}
              >
                Unarchive
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
