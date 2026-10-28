"use client";

import { CircleAlert, QrCode } from "lucide-react";
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
}

export function DonationFlow({ setup, presetsCents, minCents, maxCents }: DonationFlowProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const [customText, setCustomText] = useState("");

  function pickPreset(cents: number) {
    setChoice({ kind: "preset", cents });
    setCustomText(""); // um só valor por vez
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

  // Ao digitar, não mexemos na rolagem (o teclado está aberto). Campo vazio = nenhum valor escolhido.
  function changeCustom(text: string) {
    setCustomText(text);
    setChoice(text.trim() === "" ? null : { kind: "custom" });
  }

  const amount = useMemo<AmountResult | null>(() => {
    if (!choice) return null;
    if (choice.kind === "preset") return { ok: true, cents: choice.cents };
    return parseAmountInput(customText, { minCents, maxCents });
  }, [choice, customText, minCents, maxCents]);

  const payment = useMemo(
    () => (amount?.ok ? createStaticPixPayment(amount.cents, setup) : null),
    [setup, amount],
  );

  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-lift ring-1 ring-petal-100 sm:p-8">
      <AmountPicker
        presetsCents={presetsCents}
        choice={choice}
        onPreset={pickPreset}
        customText={customText}
        onCustomText={changeCustom}
        customResult={choice?.kind === "custom" ? amount : null}
      />

      <div className="mt-8 border-t border-petal-100 pt-8">
        {payment?.ok ? (
          <PixPaymentCard payment={payment.payment} setup={setup} />
        ) : payment ? (
          <p
            role="alert"
            className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-200"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            {payment.message} Tente escolher outro valor ou recarregue a página.
          </p>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-petal-200 bg-petal-50/40 px-6 py-10 text-center">
            <QrCode aria-hidden className="mx-auto size-14 text-petal-300" />
            <p className="mt-4 text-lg font-bold text-ink">Seu QR Code Pix aparecerá aqui</p>
            <p className="mt-1 text-sm text-muted">
              Escolha ou digite um valor acima. O QR Code e o Pix Copia e Cola são gerados na hora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
