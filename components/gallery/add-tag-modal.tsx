"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Plus, Tag, X } from "lucide-react";

interface AddTagModalProps {
  isOpen: boolean;
  libraryId: number;
  entryPaths: string[];
  onClose: () => void;
  onSuccess: (tagName: string, affectedCount: number) => void;
}

function AddTagDialogContent({
  libraryId,
  entryPaths,
  onClose,
  onSuccess,
}: Omit<AddTagModalProps, "isOpen">) {
  const [tagName, setTagName] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/gallery/tags?libraryId=${libraryId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tags?: { id: number; name: string }[] }) => {
        setSuggestions(data.tags ?? []);
      })
      .catch(() => {
        // ignore suggestions error
      });

    return () => controller.abort();
  }, [libraryId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = tagName.trim().replace(/^#+/, "");
    if (!clean) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/gallery/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          entryPaths,
          tag: clean,
        }),
      });

      const data = (await response.json()) as {
        tag?: { id: number; name: string };
        affected?: number;
        error?: string;
      };

      if (!response.ok || !data.tag) {
        throw new Error(data.error || "Failed to add tag.");
      }

      onSuccess(data.tag.name, data.affected ?? entryPaths.length);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectSuggestion(name: string) {
    setTagName(name);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tag-modal-title"
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Tag size={18} />
            </div>
            <div>
              <h2 id="add-tag-modal-title" className="text-base font-bold text-text-primary">
                Add Tag to {entryPaths.length} {entryPaths.length === 1 ? "Item" : "Items"}
              </h2>
              <p className="text-xs text-text-secondary">
                Categorize selected photos with a custom label.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-border-subtle hover:text-foreground transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Tag Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                #
              </span>
              <input
                type="text"
                required
                autoFocus
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. holiday, family, wallpaper"
                className="h-10 w-full rounded-xl border border-border-strong bg-bg-input pl-8 pr-3.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-accent focus:bg-bg-hover focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {/* Existing tag suggestions */}
          {suggestions.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium text-text-secondary mb-1.5">
                Existing Tags
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s.name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-bg-input px-2.5 py-1 text-xs text-foreground hover:border-accent/60 hover:text-accent transition cursor-pointer"
                  >
                    <span>#{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-border-strong bg-bg-input px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-border-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !tagName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddTagModal(props: AddTagModalProps) {
  if (!props.isOpen) return null;
  return (
    <AddTagDialogContent
      key={`${props.libraryId}-${props.entryPaths.join(",")}`}
      libraryId={props.libraryId}
      entryPaths={props.entryPaths}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
    />
  );
}
