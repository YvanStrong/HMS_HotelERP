"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  previewClassName?: string;
}

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

function compressImageFile(file: File, maxEdge = 900, quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress image"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  placeholder = "Enter image URL or upload",
  className = "",
  previewClassName = "h-48",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setBusy(true);
    setLocalError(null);
    setPreviewError(false);
    try {
      const blob = await compressImageFile(file);
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      const res = await apiFetch<{ url: string }>("/api/v1/media/images", { method: "POST", body: fd });
      if (!res?.url) throw new Error("Upload did not return an image URL");
      onChange(res.url);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
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
    if (file && file.type.startsWith("image/")) void uploadFile(file);
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
    void uploadFile(file);
  };

  const showPreview = Boolean(value && !previewError && isRenderableImageSrc(value));

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-foreground">{label}</label>

      {showPreview && (
        <div className={`relative w-full ${previewClassName} rounded-xl overflow-hidden border border-border bg-muted/40`}>
          <img
            src={value!.trim()}
            alt="Preview"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPreviewError(true)}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          disabled={busy}
          className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors border border-border"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {busy ? <p className="text-xs text-muted-foreground">Uploading image…</p> : null}
      {localError ? <p className="text-xs text-destructive">{localError}</p> : null}

      {!showPreview && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handleClipboardPaste}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Drop image here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  );
}
