"use client";

import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function UploadDropzone({ file, onFileChange }: UploadDropzoneProps) {
  return (
    <label
      className={cn(
        "flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center transition hover:border-primary/60 hover:bg-primary/5",
        file && "border-primary/50 bg-primary/5"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFileChange(event.dataTransfer.files.item(0));
      }}
    >
      <input
        className="sr-only"
        type="file"
        accept="image/*,video/*"
        onChange={(event) => {
          onFileChange(event.currentTarget.files?.item(0) ?? null);
          event.currentTarget.value = "";
        }}
      />
      <UploadCloud className="h-8 w-8 text-primary" aria-hidden="true" />
      {file ? (
        <div className="mt-3">
          <p className="text-sm font-semibold">{file.name}</p>
          <button
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.preventDefault();
              onFileChange(null);
            }}
            type="button"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Remover
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">Arraste uma mídia ou escolha um arquivo</p>
          <p className="mt-1 text-xs text-muted-foreground">Imagens e vídeos são suportados.</p>
        </>
      )}
    </label>
  );
}
