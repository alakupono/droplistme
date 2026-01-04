"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

async function fileToDataUrl(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      quality
    );
  });
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  // Chunk to avoid call stack issues
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  const b64 = btoa(binary);
  return `data:image/jpeg;base64,${b64}`;
}

export function DropUploaderClient() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = files.length >= 1 && files.length <= 8 && !isWorking;

  const onSelect = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr].slice(0, 8));
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onSelect(e.dataTransfer.files);
  }, [onSelect]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  async function submit() {
    setIsWorking(true);
    setError(null);
    try {
      const dataUrls: string[] = [];
      for (const f of files) {
        dataUrls.push(await fileToDataUrl(f));
      }
      const res = await fetch("/api/drops/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: dataUrls }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Create failed (${res.status})`);
      const dropId = json?.drop?.id;
      if (!dropId) throw new Error("Missing drop id");
      router.push(`/drops/${encodeURIComponent(dropId)}`);
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{ border: "2px dashed #ddd", borderRadius: 12, padding: 16 }}
    >
      <h2>Upload photos (1–8)</h2>
      <p style={{ color: "#666", marginTop: 8 }}>
        Drag and drop, or pick files. We’ll generate a draft listing for crystals/rocks/minerals.
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onSelect(e.target.files)}
        />
        <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
          {isWorking ? "Analyzing…" : "Create Draft"}
        </button>
        <button className="btn btn-secondary" disabled={isWorking} onClick={() => setFiles([])}>
          Clear
        </button>
      </div>

      {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}

      {files.length > 0 && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {previews.map((u, i) => (
            <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`preview-${i}`} style={{ width: "100%", height: 140, objectFit: "cover" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


