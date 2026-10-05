"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, PartyPopper, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/commerce/product-image";
import { createReviewAction } from "@/features/reviews/actions";
import { uploadImages } from "@/features/media/client-upload";

export type PendingReviewItem = { id: string; productName: string; variantName: string | null; imageUrl: string | null; productSlug: string; orderNumber: string; deliveredAt: string | null };

const LABELS = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

/** Estrelas como grupo de rádio (teclado: setas; leitores de tela anunciam o valor). */
export function StarInput({ value, onChange, name }: { value: number; onChange: (v: number) => void; name: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Nota" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" aria-label={`${n} estrela${n > 1 ? "s" : ""} — ${LABELS[n]}`} />
            <Star className={cn("size-8 transition-colors peer-focus-visible:rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600", n <= shown ? "fill-sun-400 text-sun-500" : "text-line-strong")} aria-hidden />
          </label>
        ))}
      </div>
      <span className="text-sm font-semibold text-fg-muted" aria-live="polite">
        {LABELS[shown]}
      </span>
    </div>
  );
}

function ReviewForm({ item, onDone }: { item: PendingReviewItem; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const slots = 5 - photos.length;
    setUploading(true);
    const res = await uploadImages(Array.from(files).slice(0, slots), "reviews");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return toast.error(res.error);
    const okFiles = res.data.files.filter((f) => f.ok);
    const failed = res.data.files.filter((f) => !f.ok);
    setPhotos((p) => [...p, ...okFiles.map((f) => (f as { url: string }).url)].slice(0, 5));
    if (failed.length) toast.error(`${failed.length} foto(s) não enviada(s)`, { description: (failed[0] as { error: string }).error });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setErrors({ rating: ["Escolha de 1 a 5 estrelas"] });
        start(async () => {
          const res = await createReviewAction({ orderItemId: item.id, rating, title, comment, photos });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            setFormError(res.fieldErrors ? null : res.error);
            return;
          }
          toast.success(res.message ?? "Avaliação enviada.");
          onDone();
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-3 rounded-md bg-surface-muted p-2.5">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white">
          <ProductImage src={item.imageUrl} alt="" sizes="56px" />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold">{item.productName}</p>
          {item.variantName ? <p className="text-xs text-fg-muted">{item.variantName}</p> : null}
        </div>
      </div>
      <Field label="Sua nota" required error={errors.rating}>
        <StarInput name={`rating-${item.id}`} value={rating} onChange={(v) => (setRating(v), setErrors((e) => ({ ...e, rating: [] })))} />
      </Field>
      <Field label="Título" hint="Opcional" error={errors.title}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Resuma sua experiência" />
      </Field>
      <Field label="Comentário" hint="Conte o que achou da qualidade, do tamanho e se atendeu às expectativas." error={errors.comment}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} showCount rows={4} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">Fotos (até 5)</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((url) => (
            <span key={url} className="relative size-20 overflow-hidden rounded-md border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização de upload */}
              <img src={url} alt="" className="size-full object-cover" />
              <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x !== url))} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white focus-ring" aria-label="Remover foto">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {photos.length < 5 ? (
            <label className={cn("grid size-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-line-strong text-fg-subtle hover:border-brand-400 hover:text-brand-700 focus-within:outline-2 focus-within:outline-brand-600", uploading && "pointer-events-none opacity-60")}>
              <span className="flex flex-col items-center gap-1 text-2xs font-semibold">
                <Camera className="size-5" aria-hidden />
                {uploading ? "Enviando…" : "Adicionar"}
              </span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Adicionar fotos" />
            </label>
          ) : null}
        </div>
        {errors.photos?.[0] ? <p className="mt-1 text-xs text-danger-700">{errors.photos[0]}</p> : null}
      </div>
      {formError ? (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {formError}
        </p>
      ) : null}
      <p className="text-xs text-fg-subtle">Avaliações passam por verificação automática e podem ser moderadas conforme as regras da comunidade.</p>
      <Button type="submit" loading={pending} disabled={uploading}>
        Enviar avaliação
      </Button>
    </form>
  );
}

export function PendingReviews({ items, initialItemId }: { items: PendingReviewItem[]; initialItemId?: string }) {
  const [current, setCurrent] = useState<PendingReviewItem | null>(() => items.find((i) => i.id === initialItemId) ?? null);
  const router = useRouter();

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-sm text-fg-muted">
        <PartyPopper className="size-5 text-brand-700" aria-hidden /> Tudo em dia! Não há compras aguardando avaliação.
      </p>
    );
  }
  return (
    <>
      <div className="rounded-card border border-sun-300 bg-sun-50 p-4">
        <h2 className="mb-3 font-bold">Aguardando sua avaliação ({items.length})</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-md border border-line bg-surface p-2.5">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                <ProductImage src={item.imageUrl} alt="" sizes="56px" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-fg-subtle">{item.deliveredAt ? `Entregue em ${formatDate(item.deliveredAt)}` : `Pedido ${item.orderNumber}`}</p>
              </div>
              <Button size="sm" onClick={() => setCurrent(item)}>
                Avaliar
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <Modal open={current !== null} onClose={() => setCurrent(null)} title="Avaliar produto" size="lg">
        {current ? (
          <ReviewForm
            key={current.id}
            item={current}
            onDone={() => {
              setCurrent(null);
              router.replace("/minha-conta/avaliacoes", { scroll: false });
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
