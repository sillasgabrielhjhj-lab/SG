"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/masked-input";
import { formatBRL, installmentOptions } from "@/lib/money";
import { updateSettingsAction } from "@/features/admin/actions";
import { ImageField } from "@/features/admin/components/image-field";
import { useAdminAction } from "@/features/admin/components/use-admin-action";
import type { WelcomeCampaignStatus } from "@/features/coupons/campaign.server";

export type SettingsValues = {
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  companyLegalName: string;
  companyDocument: string;
  companyAddress: string;
  supportHours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  x: string;
  seoTitle: string;
  seoDescription: string;
  minOrderCents: number;
  freeShippingThresholdCents: number | null;
  lowStockThreshold: number;
  orderReservationMinutes: number;
  pixDiscountPercent: number;
  maxInstallments: number;
  interestFreeInstallments: number;
  monthlyInterestBps: number;
  minInstallmentCents: number;
  welcomeCouponCode: string;
  welcomeCouponReshowDays: number;
};

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="font-bold">{title}</h2>
      {description ? <p className="mb-4 text-sm text-fg-muted">{description}</p> : <div className="mb-4" />}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ initial, welcomeStatus }: { initial: SettingsValues; welcomeStatus: WelcomeCampaignStatus }) {
  const [v, setV] = useState(initial);
  const [interestText, setInterestText] = useState((initial.monthlyInterestBps / 100).toFixed(2).replace(".", ","));
  const { pending, run, err } = useAdminAction();
  const set = (k: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));
  const sim = useMemo(() => installmentOptions(100_000, { maxInstallments: v.maxInstallments || 1, interestFreeInstallments: v.interestFreeInstallments || 1, monthlyInterestBps: v.monthlyInterestBps, minInstallmentCents: v.minInstallmentCents }), [v.maxInstallments, v.interestFreeInstallments, v.monthlyInterestBps, v.minInstallmentCents]);
  const e = (k: string) => err(k) ?? undefined;

  return (
    <form
      noValidate
      className="flex flex-col gap-4 pb-20"
      onSubmit={(ev) => {
        ev.preventDefault();
        run(() => updateSettingsAction({ ...v, freeShippingThresholdCents: v.freeShippingThresholdCents ?? undefined }));
      }}
    >
      <Card title="Identidade" description="Nome e marca exibidos na loja, e-mails e SEO.">
        <Field label="Nome da loja" required error={e("storeName")}>
          <Input value={v.storeName} maxLength={60} onChange={set("storeName")} />
        </Field>
        <Field label="Slogan" error={e("tagline")}>
          <Input value={v.tagline} maxLength={120} onChange={set("tagline")} />
        </Field>
        <ImageField label="Logo (e-mails e compartilhamento)" folder="stores" value={v.logoUrl} onChange={(url) => setV((p) => ({ ...p, logoUrl: url }))} />
        <ImageField label="Favicon alternativo" folder="stores" value={v.faviconUrl} onChange={(url) => setV((p) => ({ ...p, faviconUrl: url }))} hint="Opcional. Por padrão usa o ícone Mercatto." />
      </Card>

      <Card title="Atendimento e redes sociais">
        <Field label="E-mail de contato" error={e("contactEmail")}>
          <Input type="email" value={v.contactEmail} onChange={set("contactEmail")} />
        </Field>
        <Field label="Telefone" error={e("contactPhone")}>
          <Input value={v.contactPhone} maxLength={20} onChange={set("contactPhone")} />
        </Field>
        <Field label="WhatsApp" error={e("whatsapp")} hint="Somente números com DDD">
          <Input value={v.whatsapp} maxLength={20} inputMode="tel" onChange={set("whatsapp")} />
        </Field>
        <Field label="Horário de atendimento" error={e("supportHours")} hint="Ex.: Seg. a sex., 9h às 18h. Vazio = não exibido.">
          <Input value={v.supportHours} maxLength={80} onChange={set("supportHours")} />
        </Field>
        <Field label="Razão social" error={e("companyLegalName")} hint="Aparece no rodapé e em Fale conosco. Vazio = não exibido.">
          <Input value={v.companyLegalName} maxLength={120} onChange={set("companyLegalName")} />
        </Field>
        <Field label="CNPJ" error={e("companyDocument")}>
          <Input value={v.companyDocument} maxLength={20} inputMode="numeric" onChange={set("companyDocument")} />
        </Field>
        <Field label="Endereço da empresa" error={e("companyAddress")}>
          <Input value={v.companyAddress} maxLength={240} onChange={set("companyAddress")} />
        </Field>
        <Field label="Instagram (URL)" error={e("instagram")}>
          <Input value={v.instagram} maxLength={200} onChange={set("instagram")} />
        </Field>
        <Field label="Facebook (URL)" error={e("facebook")}>
          <Input value={v.facebook} maxLength={200} onChange={set("facebook")} />
        </Field>
        <Field label="TikTok (URL)" error={e("tiktok")}>
          <Input value={v.tiktok} maxLength={200} onChange={set("tiktok")} />
        </Field>
        <Field label="YouTube (URL)" error={e("youtube")}>
          <Input value={v.youtube} maxLength={200} onChange={set("youtube")} />
        </Field>
        <Field label="X / Twitter (URL)" error={e("x")}>
          <Input value={v.x} maxLength={200} onChange={set("x")} />
        </Field>
      </Card>

      <Card title="SEO da página inicial">
        <Field label="Título" error={e("seoTitle")} hint={`${v.seoTitle.length}/70`}>
          <Input value={v.seoTitle} maxLength={70} onChange={set("seoTitle")} />
        </Field>
        <Field label="Descrição" error={e("seoDescription")}>
          <Textarea value={v.seoDescription} maxLength={160} showCount rows={2} onChange={set("seoDescription")} />
        </Field>
      </Card>

      <Card title="Regras comerciais" description="Aplicadas pelo servidor no carrinho e no checkout.">
        <Field label="Pedido mínimo" error={e("minOrderCents")} hint="R$ 0,00 = sem mínimo">
          <PriceInput defaultCents={v.minOrderCents} onCentsChange={(c) => setV((p) => ({ ...p, minOrderCents: c ?? 0 }))} />
        </Field>
        <Field label="Frete grátis a partir de (produtos oficiais)" error={e("freeShippingThresholdCents")} hint="Vazio = desativado">
          <PriceInput defaultCents={v.freeShippingThresholdCents} onCentsChange={(c) => setV((p) => ({ ...p, freeShippingThresholdCents: c }))} />
        </Field>
        <Field label="Desconto no PIX (%)" error={e("pixDiscountPercent")} hint="0 = sem desconto (máx. 20%). Aplicado no checkout ao pagar com PIX.">
          <Input type="number" min={0} max={20} value={v.pixDiscountPercent} onChange={set("pixDiscountPercent")} />
        </Field>
        <Field label="Validade da reserva / PIX (minutos)" error={e("orderReservationMinutes")} hint="Tempo em que o estoque fica reservado aguardando pagamento">
          <Input type="number" min={30} max={1440} value={v.orderReservationMinutes} onChange={set("orderReservationMinutes")} />
        </Field>
        <Field label="Alerta de estoque baixo (unidades)" error={e("lowStockThreshold")}>
          <Input type="number" min={0} value={v.lowStockThreshold} onChange={set("lowStockThreshold")} />
        </Field>
      </Card>

      <Card title="Campanha de boas-vindas" description="Pop-up da primeira visita, aba flutuante e faixas da home. Percentual, mínimo, teto, datas e produtos participantes vêm do cupom (Marketing → Cupons).">
        <Field label="Código do cupom da campanha" error={e("welcomeCouponCode")} hint="Vazio = campanha desligada">
          <Input value={v.welcomeCouponCode} maxLength={40} autoCapitalize="characters" onChange={set("welcomeCouponCode")} placeholder="MERCATTO25" />
        </Field>
        <Field label="Mostrar o pop-up de novo após (dias)" error={e("welcomeCouponReshowDays")} hint="Quem já viu só vê de novo depois desse prazo">
          <Input type="number" min={1} max={365} value={v.welcomeCouponReshowDays} onChange={set("welcomeCouponReshowDays")} />
        </Field>
        <p className={`rounded-field px-3 py-2 text-sm font-medium sm:col-span-2 ${welcomeStatus.visible ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`} role="status">
          {welcomeStatus.message}
          {welcomeStatus.couponId ? (
            <>
              {" "}
              <a href={`/admin/cupons/${welcomeStatus.couponId}`} className="font-semibold underline underline-offset-2">
                Editar cupom {welcomeStatus.code}
              </a>
            </>
          ) : null}
        </p>
      </Card>

      <Card title="Parcelamento no cartão" description="Acima das parcelas sem juros aplica-se a Tabela Price com a taxa mensal informada.">
        <Field label="Máximo de parcelas" error={e("maxInstallments")}>
          <Input type="number" min={1} max={24} value={v.maxInstallments} onChange={set("maxInstallments")} />
        </Field>
        <Field label="Parcelas sem juros" error={e("interestFreeInstallments")}>
          <Input type="number" min={1} max={24} value={v.interestFreeInstallments} onChange={set("interestFreeInstallments")} />
        </Field>
        <Field label="Juros ao mês (%)" error={e("monthlyInterestBps")}>
          <Input
            inputMode="decimal"
            value={interestText}
            onChange={(ev) => {
              setInterestText(ev.target.value);
              const n = Number(ev.target.value.replace(",", "."));
              if (Number.isFinite(n)) setV((p) => ({ ...p, monthlyInterestBps: Math.round(n * 100) }));
            }}
          />
        </Field>
        <Field label="Parcela mínima" error={e("minInstallmentCents")}>
          <PriceInput defaultCents={v.minInstallmentCents} onCentsChange={(c) => setV((p) => ({ ...p, minInstallmentCents: c ?? 0 }))} />
        </Field>
        <div className="rounded-md bg-surface-muted p-3 text-sm sm:col-span-2">
          <p className="mb-2 font-semibold">Simulação para uma compra de {formatBRL(100_000)}</p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {sim.map((o) => (
              <li key={o.count} className="flex justify-between gap-2 tabular">
                <span>
                  {o.count}x de {formatBRL(o.installmentCents)}
                </span>
                <span className={o.interestFree ? "font-semibold text-success-700" : "text-fg-muted"}>{o.interestFree ? "sem juros" : `total ${formatBRL(o.totalCents)}`}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-[1400px] justify-end">
          <Button type="submit" loading={pending}>
            Salvar configurações
          </Button>
        </div>
      </div>
    </form>
  );
}
