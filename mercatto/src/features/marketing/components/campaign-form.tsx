"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, ImagePlus, Plus, Trash2 } from "lucide-react";
import { slugify } from "@/lib/slug";
import { formatDateTime } from "@/lib/format";
import { parseLocalDateTime } from "@/lib/dates";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { uploadImages } from "@/features/media/client-upload";
import { adminCreateCampaignAction, adminUpdateCampaignAction } from "@/features/marketing/actions";
import { CAMPAIGN_STATE, FormErrorBox, FormSection, StateBadge, normalizeFieldErrors, type CampaignState } from "@/features/marketing/components/marketing-ui";

export type CampaignFormInitial = {
  name: string;
  slug: string;
  description: string;
  bannerUrl: string;
  themeColor: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Formulário de campanha (somente admin). */
export function CampaignForm({ basePath, campaignId, initial, state, promotionsCount = 0 }: { basePath: string; campaignId?: string; initial: CampaignFormInitial; state?: CampaignState; promotionsCount?: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(campaignId));
  const [s, setS] = useState(initial);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CampaignFormInitial>(k: K, v: CampaignFormInitial[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (path: string) => errors[path]?.[0];
  const color = HEX.test(s.themeColor) ? s.themeColor : null;
  const startDate = parseLocalDateTime(s.startsAt);
  const endDate = parseLocalDateTime(s.endsAt);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadImages([file], "banners");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return toast.error(res.error);
    const first = res.data.files[0];
    if (!first) return;
    if (!first.ok) return toast.error(first.error);
    set("bannerUrl", first.url);
    toast.success("Imagem enviada.");
  };

  const save = () =>
    start(async () => {
      setFormError(null);
      const input = { ...s, slug: s.slug || undefined };
      const res = campaignId ? await adminUpdateCampaignAction({ id: campaignId, input }) : await adminCreateCampaignAction(input);
      if (!res.ok) {
        setErrors(normalizeFieldErrors(res.fieldErrors));
        setFormError(res.error);
        toast.error(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Campanha salva.");
      if (!campaignId) router.replace(basePath);
      else {
        set("slug", res.data.slug);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Campanhas
          </Link>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight break-words sm:text-2xl">{campaignId ? initial.name : "Nova campanha"}</h1>
          {campaignId ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
              {state ? <StateBadge meta={CAMPAIGN_STATE[state]} /> : null}
              <span>{promotionsCount} promoção(ões) vinculada(s)</span>
            </p>
          ) : null}
        </div>
        {campaignId ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/promocoes/nova?campanha=${campaignId}`} variant="outline" size="sm" leftIcon={<Plus className="size-4" />}>
              Nova promoção na campanha
            </ButtonLink>
            <ButtonLink href={`/campanha/${initial.slug}`} target="_blank" variant="outline" size="sm" rightIcon={<ExternalLink className="size-4" aria-hidden />}>
              Ver página<span className="sr-only"> (abre em nova aba)</span>
            </ButtonLink>
          </div>
        ) : null}
      </div>

      <FormErrorBox message={formError} errors={errors} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Dados da campanha</legend>
          <FormSection id="campanha" title="Campanha">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" required error={err("name")} className="sm:col-span-2">
                <Input
                  value={s.name}
                  maxLength={120}
                  onChange={(e) => {
                    const name = e.target.value;
                    setS((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name, 80) }));
                  }}
                />
              </Field>
              <Field label="Endereço (slug)" error={err("slug")} hint={`mercatto.com.br/campanha/${s.slug || "…"}`} className="sm:col-span-2">
                <Input
                  value={s.slug}
                  maxLength={80}
                  className="font-mono"
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
              </Field>
              <Field label="Descrição" error={err("description")} hint="Aparece no topo da página da campanha." className="sm:col-span-2">
                <Textarea value={s.description} maxLength={500} showCount rows={3} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Início" required error={err("startsAt")} hint="Horário de Brasília">
                <Input type="datetime-local" value={s.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Término" required error={err("endsAt")}>
                <Input type="datetime-local" value={s.endsAt} min={s.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <FormSection id="visual" title="Visual" description="Opcional. Banner e cor de destaque da página.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="URL do banner"
                error={err("bannerUrl")}
                hint="Imagem horizontal (ex.: 1600×500). Cole uma URL ou envie um arquivo."
                className="sm:col-span-2"
                labelAction={
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:underline focus-within:outline-2 focus-within:outline-brand-600">
                    <ImagePlus className="size-3.5" aria-hidden /> {uploading ? "Enviando…" : "Enviar imagem"}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
                  </label>
                }
              >
                <Input type="url" value={s.bannerUrl} maxLength={500} placeholder="https://… ou /uploads/…" onChange={(e) => set("bannerUrl", e.target.value)} />
              </Field>
              <Field label="Cor de destaque" error={err("themeColor")} hint="Hexadecimal, ex.: #0F766E">
                <Input
                  value={s.themeColor}
                  maxLength={7}
                  placeholder="#0F766E"
                  className="font-mono"
                  onChange={(e) => set("themeColor", e.target.value.trim())}
                  trailing={
                    <span className="relative mr-1 inline-flex size-8 overflow-hidden rounded-md border border-line" style={{ backgroundColor: color ?? "transparent" }}>
                      <input type="color" aria-label="Escolher cor" value={color ?? "#0f766e"} onChange={(e) => set("themeColor", e.target.value.toUpperCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                    </span>
                  }
                />
              </Field>
              <div className="flex items-end">
                <Switch checked={s.isActive} onChange={(e) => set("isActive", e.target.checked)} label="Campanha ativa" description="Desativada, a página deixa de exibir a campanha." className="w-full rounded-md border border-line p-3" />
              </div>
            </div>
          </FormSection>
        </fieldset>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <section aria-labelledby="previa-campanha" className="rounded-card border border-line bg-surface p-4">
            <h2 id="previa-campanha" className="mb-3 font-bold">
              Prévia
            </h2>
            <div className="overflow-hidden rounded-panel text-white" style={{ backgroundColor: color ?? "var(--color-brand-800)" }}>
              {s.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pré-visualização de URL arbitrária no admin
                <img src={s.bannerUrl} alt="" className="aspect-[16/5] w-full object-cover" />
              ) : null}
              <div className="px-4 py-4">
                <p className="text-2xs font-bold tracking-wider text-sun-300 uppercase">Campanha oficial</p>
                <p className="mt-0.5 text-lg leading-tight font-extrabold break-words">{s.name || "Nome da campanha"}</p>
                {s.description ? <p className="mt-1 line-clamp-3 text-xs text-white/85">{s.description}</p> : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-fg-muted">{startDate && endDate ? `${formatDateTime(startDate)} → ${formatDateTime(endDate)}` : "Defina o período."}</p>
            {s.bannerUrl ? (
              <Button variant="ghost" size="sm" className="mt-2 text-danger-700" leftIcon={<Trash2 className="size-4" />} onClick={() => set("bannerUrl", "")} disabled={pending}>
                Remover banner
              </Button>
            ) : null}
            <Button className="mt-4 hidden xl:inline-flex" fullWidth loading={pending} disabled={uploading} onClick={save}>
              {campaignId ? "Salvar alterações" : "Criar campanha"}
            </Button>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur xl:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl gap-2">
          <ButtonLink href={basePath} variant="outline" className="flex-1">
            Voltar
          </ButtonLink>
          <Button onClick={save} loading={pending} disabled={uploading} className="flex-1">
            {campaignId ? "Salvar" : "Criar campanha"}
          </Button>
        </div>
      </div>
    </div>
  );
}
