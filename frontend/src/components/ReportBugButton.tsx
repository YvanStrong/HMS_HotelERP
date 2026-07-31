"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Props = {
  /** Compact text button for sidebars */
  variant?: "sidebar" | "button";
  collapsed?: boolean;
};

const MAX_SCREENSHOT_BYTES = 2_500_000;

export function ReportBugButton({ variant = "button", collapsed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function clearScreenshot() {
    setScreenshotDataUrl(null);
    setScreenshotFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function readScreenshotFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please attach an image file (PNG, JPG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError("Screenshot must be under 2.5MB. Try a cropped capture or lower resolution.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setScreenshotDataUrl(result);
      setScreenshotFileName(file.name || "bug-screenshot.png");
      setError(null);
    };
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/v1/bug-reports", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          screenshotDataUrl: screenshotDataUrl || null,
          screenshotFileName: screenshotFileName || null,
        }),
      });
      setDone(true);
      setTitle("");
      setDescription("");
      setSeverity("MEDIUM");
      clearScreenshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit bug report");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setError(null);
    setDone(false);
  }

  const triggerClass =
    variant === "sidebar"
      ? `w-full flex items-center rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors bg-transparent shadow-none border-none ${
          collapsed ? "justify-center px-2 py-2" : "gap-2 px-2 py-2"
        }`
      : "hms-btn-outline text-sm";

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)} title="Report a bug">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        {(!collapsed || variant !== "sidebar") && <span>Report bug</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close" onClick={close} />
          <div className="relative z-[1] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Report a bug</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us what went wrong. Your report is emailed to the platform team and appears in the super admin
                  panel.
                </p>
              </div>
              <button type="button" className="hms-btn-outline px-2 py-1 text-xs" onClick={close}>
                Close
              </button>
            </div>

            {done ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Thanks — your bug report was submitted.
                <div className="mt-3">
                  <button type="button" className="hms-btn-solid text-sm" onClick={close}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={onSubmit}>
                <label className="block text-sm">
                  <span className="font-medium text-foreground">Title</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    required
                    placeholder="Short summary"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-foreground">Severity</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-foreground">What happened?</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm min-h-[120px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={8000}
                    required
                    placeholder="Steps to reproduce, expected vs actual behavior…"
                  />
                </label>

                <div className="block text-sm">
                  <span className="font-medium text-foreground">Screenshot (optional)</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Attach a screen capture so support can see the issue faster. Images only, max 2.5MB.
                  </p>
                  {screenshotDataUrl ? (
                    <div className="relative mt-2 overflow-hidden rounded-xl border border-border bg-muted/30">
                      <img
                        src={screenshotDataUrl}
                        alt="Screenshot preview"
                        className="max-h-48 w-full object-contain bg-slate-50"
                      />
                      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
                        <span className="truncate text-muted-foreground">{screenshotFileName}</span>
                        <button type="button" className="font-semibold text-red-700 hover:underline" onClick={clearScreenshot}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) readScreenshotFile(file);
                      }}
                      className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-slate-50 px-4 py-6 text-center hover:border-primary/40 hover:bg-primary/5"
                    >
                      <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <span className="text-sm font-medium text-foreground">Drop screenshot or click to browse</span>
                      <span className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF</span>
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) readScreenshotFile(file);
                    }}
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" className="hms-btn-outline" onClick={close} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="hms-btn-solid" disabled={submitting}>
                    {submitting ? "Sending…" : "Submit report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
