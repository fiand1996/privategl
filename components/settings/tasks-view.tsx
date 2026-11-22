"use client";

import {
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ScanTask {
  id: string;
  libraryId: number;
  libraryName?: string;
  status: "queued" | "running" | "completed" | "failed";
  scannedEntries: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TasksView() {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tasks", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { tasks?: ScanTask[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load tasks.");
        setTasks(data.tasks ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load tasks:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const hasActiveTasks = tasks.some(
    (task) => task.status === "queued" || task.status === "running",
  );

  useEffect(() => {
    if (!hasActiveTasks) return;
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [hasActiveTasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text-primary">
            Background Indexing Tasks
          </h2>
          <p className="text-xs text-text-secondary">
            Real-time queue and execution log for directory indexing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-bg-input px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-border-subtle transition cursor-pointer"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle p-8 text-center text-sm text-text-secondary">
          No tasks have been queued yet. Trigger a scan from the Media Libraries tab.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isRunning = task.status === "running";
            const isQueued = task.status === "queued";
            const isCompleted = task.status === "completed";
            const isFailed = task.status === "failed";

            return (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-card p-4 sm:flex-row sm:items-center shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-text-secondary">
                      #{task.id.slice(0, 8)}
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      {task.libraryName ?? `Library #${task.libraryId}`}
                    </span>

                    {isRunning ? (
                      <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                        <Loader2 size={10} className="animate-spin" />
                        Running
                      </span>
                    ) : isQueued ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        Queued
                      </span>
                    ) : isCompleted ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        Completed
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                        Failed
                      </span>
                    )}
                  </div>

                  {isFailed && task.error && (
                    <p className="mt-1 text-xs text-rose-400">{task.error}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-muted">
                    <span>{task.scannedEntries} items scanned</span>
                    <span>·</span>
                    <span>Created: {formatDate(task.createdAt)}</span>
                    {task.finishedAt && (
                      <>
                        <span>·</span>
                        <span>Finished: {formatDate(task.finishedAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-bg-input px-2.5 py-1 text-text-secondary">
                    <Layers size={12} />
                    Job {task.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
