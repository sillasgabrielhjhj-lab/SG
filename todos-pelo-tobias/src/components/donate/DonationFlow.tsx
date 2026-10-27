"use client";

import { CircleAlert, QrCode, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { parseAmountInput, type AmountResult } from "@/lib/money";
import { createStaticPixPayment } from "@/lib/payments/static-pix";
import type { PixSetup } from "@/lib/pix/setup";
import { AmountPicker, type Choice } from "./AmountPicker";
import { PixPaymentCard } from "./PixPaymentCard";

interface DonationFlowProps {
  setup: PixSetup;
  presetsCents: number[];
  minCents: number;
  maxCents: number;
  siteUrl: string;
}

export function DonationFlow({
  setup,
  presetsCents,
  minCents,
  maxCents,
  siteUrl,
}: DonationFlowProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const [customText, setCustomText] = useState("");

  function pick(next: NonNullable<Choice>) {
    setChoice(next);
    if (next.kind !== "preset") return; // ao digitar outro valor, não mexemos na rolagem
    // No celular o QR Code nasce abaixo da dobra: se não estiver todo visível, leva a pessoa até ele.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const heading = document.getElementById("pix-titulo");
        const qr = document.getElementById("pix-qr");
        if (!heading || !qr || qr.getBoundingClientRect().bottom <= window.innerHeight - 16) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }),
    );
  }

  // Valor escolhido -> centavos validados. Recalculado a cada mudança, então o QR Code é instantâneo.
  const amount = useMemo<AmountResult | null>(() => {
    if (!choice) return null;
    if (choice.kind === "preset") return { ok: true, cents: choice.cents };
    return parseAmountInput(customText, { minCents, maxCents });
  }, [choice, customText, minCents, maxCents]);

  const payment = useMemo(
    () =>
      setup.status === "ready" && amount?.ok ? createStaticPixPayment(amount.cents, setup) : null,
    [setup, amount],
  );

  if (setup.status === "missing") {
    return (
      <div
        role="status"
        className="rounded-3xl bg-white p-7 text-center shadow-soft ring-1 ring-brand-100"
      >
        <TriangleAlert aria-hidden className="mx-auto size-10 text-amber-600" />
        <h2 className="mt-4 text-2xl font-extrabold text-brand-950">Doações por Pix em breve</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Estamos concluindo a configuração do recebimento. Volte em instantes ou fale com a
          organização da campanha.
        </p>
        <p className="mt-5 rounded-2xl bg-cream p-4 text-left text-sm leading-relaxed text-ink/80">
          <strong>Para quem administra o site:</strong> preencha{" "}
          {setup.missing
            .map((field) => (field === "receiverName" ? "o nome" : "a cidade"))
            .join(" e ")}{" "}
          do recebedor em <code>src/config/campaign.ts</code> (ou nas variáveis{" "}
          <code>NEXT_PUBLIC_PIX_RECEIVER_NAME</code> e <code>NEXT_PUBLIC_PIX_RECEIVER_CITY</code>) e
          publique novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-lift ring-1 ring-brand-100 sm:p-8">
      {setup.isPlaceholder ? (
        <p className="mb-6 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong>Modo de desenvolvimento:</strong> o nome e a cidade do recebedor são
            provisórios. Preencha-os em <code>src/config/campaign.ts</code> antes de publicar. Em
            produção, sem esses dados, o QR Code não é exibido.
          </span>
        </p>
      ) : null}

      <AmountPicker
        presetsCents={presetsCents}
        choice={choice}
        onChoice={pick}
        customText={customText}
        onCustomText={setCustomText}
        customResult={choice?.kind === "custom" ? amount : null}
      />

      <div className="mt-8 border-t border-brand-100 pt-8">
        {payment?.ok ? (
          <PixPaymentCard payment={payment.payment} receiver={setup} siteUrl={siteUrl} />
        ) : payment ? (
          <p
            role="alert"
            className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-200"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            {payment.message} Tente escolher outro valor ou recarregue a página.
          </p>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center">
            <QrCode aria-hidden className="mx-auto size-14 text-brand-300" />
            <p className="mt-4 text-lg font-bold text-brand-900">Seu QR Code Pix aparecerá aqui</p>
            <p className="mt-1 text-sm text-muted">
              Escolha um valor acima. O QR Code e o código Pix Copia e Cola são gerados na hora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
