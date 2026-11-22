"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  Minimize2,
  Upload,
  X,
} from "lucide-react";
import { useUpload } from "./upload-context";

export function UploadProgressWidget() {
  const {
    queue,
    isUploading,
    isWidgetOpen,
    setIsWidgetOpen,
    clearFinished,
    cancelAll,
  } = useUpload();

  const [showErrorList, setShowErrorList] = useState(false);

  if (queue.length === 0) {
    return null;
  }

  const totalCount = queue.length;
  const completedCount = queue.filter((i) => i.status === "success").length;
  const failedItems = queue.filter((i) => i.status === "error");
  const failedCount = failedItems.length;
  const inProgressItem = queue.find((i) => i.status === "uploading");
  const progressPercent =
    totalCount > 0
      ? Math.round(((completedCount + failedCount) / totalCount) * 100)
      : 0;

  const isAllDone = !isUploading && (completedCount + failedCount === totalCount);

  // Minimized floating pill view
  if (!isWidgetOpen) {
    return (
      <aside
        aria-label="Upload Progress"
        onClick={() => setIsWidgetOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-border-strong bg-bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition hover:border-accent/50 hover:bg-bg-hover cursor-pointer animate-in fade-in slide-in-from-bottom duration-200"
      >
        <div className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
          {isUploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : failedCount > 0 ? (
            <AlertCircle size={16} className="text-amber-400" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-text-primary">
            {isUploading
              ? `Uploading ${completedCount + failedCount}/${totalCount}`
              : `Upload complete (${completedCount}/${totalCount})`}
          </span>
          <span className="text-[10px] text-text-secondary">
            {isUploading ? `${progressPercent}% completed` : "Click to view details"}
          </span>
        </div>
        <Maximize2 size={14} className="ml-2 text-text-secondary" />
      </aside>
    );
  }

  // Expanded panel view
  return (
    <aside
      aria-label="Upload Details"
      className="fixed bottom-6 right-6 z-50 w-84 sm:w-96 rounded-2xl border border-border-strong bg-bg-card/98 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : failedCount > 0 ? (
              <AlertCircle size={16} className="text-amber-400" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-400" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-text-primary">
              {isUploading ? "Uploading Media" : "Upload Complete"}
            </h4>
            <p className="text-[10px] text-text-secondary">
              {completedCount} of {totalCount} uploaded
              {failedCount > 0 ? ` · ${failedCount} skipped/failed` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsWidgetOpen(false)}
            title="Minimize"
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover hover:text-foreground cursor-pointer"
          >
            <Minimize2 size={14} />
          </button>
          <button
            type="button"
            onClick={isUploading ? cancelAll : clearFinished}
            title={isUploading ? "Cancel uploads" : "Close"}
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover hover:text-foreground cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
          <span className="truncate pr-2">
            {inProgressItem ? inProgressItem.relativePath : isAllDone ? "All files processed" : "Queued..."}
          </span>
          <span className="shrink-0 font-semibold text-accent">
            {progressPercent}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
          <div
            className={`h-full transition-all duration-200 ${
              isAllDone && failedCount === 0
                ? "bg-emerald-400"
                : "bg-accent"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Breakdown (if any) */}
      {failedCount > 0 && (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5">
          <button
            type="button"
            onClick={() => setShowErrorList((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold text-rose-300 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>{failedCount} file(s) failed or skipped</span>
            </span>
            {showErrorList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showErrorList && (
            <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-bg-app/40 p-1.5 text-foreground border border-rose-500/10"
                >
                  <p className="font-medium text-foreground truncate">{item.relativePath}</p>
                  <p className="text-rose-400 text-[10px]">{item.error || "Upload rejected."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer controls */}
      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
        {isUploading ? (
          <>
            <span className="text-[11px] text-text-secondary flex items-center gap-1.5">
              <Upload size={12} className="text-accent" />
              <span>Runs in background</span>
            </span>
            <button
              type="button"
              onClick={cancelAll}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
            >
              Cancel All
            </button>
          </>
        ) : (
          <>
            <span className="text-[11px] text-text-secondary">
              {failedCount === 0 ? "All photos uploaded successfully." : "Upload completed with warnings."}
            </span>
            <button
              type="button"
              onClick={clearFinished}
              className="rounded-lg bg-bg-input px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-bg-hover cursor-pointer"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
