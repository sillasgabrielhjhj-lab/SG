"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { uploadImagesAction } from "@/features/media/actions";

/** Campo de imagem única com upload validado no servidor (re-encode WebP, sem EXIF). */
export function ImageField({ value, onChange, folder, label, hint }: { value: string; onChange: (url: string) => void; folder: "categories" | "brands" | "banners" | "stores"; label: string; hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("folder", folder);
    form.append("files", file);
    setUploading(true);
    const res = await uploadImagesAction(form);
    setUploading(false);
    if (ref.current) ref.current.value = "";
    if (!res.ok) return toast.error(res.error);
    const f = res.data.files[0];
    if (f?.ok) onChange(f.url);
    else toast.error(f && !f.ok ? f.error : "Falha no envio.");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização */}
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-fg-subtle" aria-hidden />}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-field border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted focus-within:outline-2 focus-within:outline-brand-600">
            {uploading ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
            <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {value ? (
            <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 className="size-4" />} onClick={() => onChange("")}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
