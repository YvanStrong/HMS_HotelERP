"use client";

import { useState, useRef } from "react";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Compact row layout for settings pages — small preview, no large drop zone. */
  variant?: "default" | "compact";
  /** For compact logo uploads */
  previewShape?: "square" | "banner";
}

/** True when the string is safe to pass to an {@code <img src>} (avoids Next/Image parse errors while typing). */
function isRenderableImageSrc(url: string | undefined): boolean {
  const t = (url ?? "").trim();
  if (!t) return false;
  if (t.startsWith("data:image/")) return true;
  if (t.startsWith("/")) return t.length > 1;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      new URL(t);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  placeholder = "Enter image URL or upload",
  className = "",
  variant = "default",
  previewShape = "banner",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onChange(result);
        setPreviewError(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onChange(result);
        setPreviewError(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setPreviewError(false);
  };

  const handleClipboardPaste = (e: React.ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((i) => i.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      onChange(result);
      setPreviewError(false);
    };
    reader.readAsDataURL(file);
  };

  const showPreview = Boolean(value && !previewError && isRenderableImageSrc(value));
  const compact = variant === "compact";

  if (compact) {
    const previewBox =
      previewShape === "square"
        ? "h-14 w-14 shrink-0 rounded-lg"
        : "h-14 w-24 shrink-0 rounded-lg";
    return (
      <div className={`space-y-1.5 ${className}`}>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2">
          <div
            className={`relative overflow-hidden border border-slate-200/90 bg-white ${previewBox} ${
              !showPreview ? "flex items-center justify-center" : ""
            }`}
          >
            {showPreview ? (
              <>
                <img
                  src={value!.trim()}
                  alt=""
                  className={`h-full w-full ${previewShape === "square" ? "object-contain p-0.5" : "object-cover"}`}
                  onError={() => setPreviewError(true)}
                />
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-[10px] text-white"
                  aria-label="Remove"
                >
                  ×
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
              >
                Add
              </button>
            )}
          </div>
          <input
            type="text"
            value={value || ""}
            onChange={handleUrlChange}
            onPaste={handleClipboardPaste}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-xs text-slate-700 shadow-none focus:ring-0"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Upload
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-foreground">{label}</label>

      {showPreview && (
        <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border bg-muted/40">
          <img
            src={value!.trim()}
            alt="Preview"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPreviewError(true)}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white"
          >
            <svg className="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={value || ""}
          onChange={handleUrlChange}
          onPaste={handleClipboardPaste}
          placeholder={placeholder}
          className="flex-1"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {!showPreview && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handleClipboardPaste}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Drop image here</p>
          <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  );
}
