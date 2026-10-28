import { Heart, Info, ScanSearch } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatBRL } from "@/lib/money";
import type { PixPayment } from "@/lib/payments/types";
import type { PixSetup } from "@/lib/pix/setup";
import { HowToPay } from "./HowToPay";

/** QR Code e "Copia e Cola" saem do MESMO texto (`payment.payload`): representam o mesmo pagamento. */
export function PixPaymentCard({ payment, setup }: { payment: PixPayment; setup: PixSetup }) {
  const amount = formatBRL(payment.amountCents);

  return (
    <section aria-labelledby="pix-titulo" className="animate-fade-in">
      <h2
        id="pix-titulo"
        aria-live="polite"
        className="scroll-mt-24 text-center text-2xl leading-snug font-semibold text-ink sm:text-[1.7rem]"
      >
        Você escolheu contribuir com <span className="text-sage-700">{amount}</span>. Obrigado por
        fazer parte dessa corrente de solidariedade!
      </h2>

      <div
        key={payment.payload}
        id="pix-qr"
        data-testid="pix-qrcode"
        className="relative mx-auto mt-7 w-fit animate-pop rounded-[1.75rem] bg-white p-3 shadow-lift ring-1 ring-petal-100"
      >
        <QRCodeSVG
          value={payment.payload}
          level="M"
          marginSize={4}
          bgColor="#ffffff"
          fgColor="#1e1420"
          role="img"
          aria-label={`QR Code Pix no valor de ${amount}`}
          className="block h-auto w-[min(72vw,300px)]"
        />
      </div>
      <p className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-sage-50 px-4 py-1.5 text-sm font-bold text-sage-800 ring-1 ring-sage-200">
          Valor: {amount}
        </span>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        No computador? Aponte a câmera do app do seu banco para o QR Code.
      </p>

      <div className="mt-7">
        <label htmlFor="pix-codigo" className="block text-sm font-bold text-ink">
          Pix Copia e Cola
        </label>
        <textarea
          id="pix-codigo"
          readOnly
          rows={5}
          value={payment.payload}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 field-sizing-content min-h-24 w-full resize-none rounded-2xl border border-petal-200 bg-petal-50/50 p-4 font-mono text-xs leading-relaxed break-all text-ink"
        />
        <div className="mt-4">
          <CopyButton text={payment.payload} className="w-full" />
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200">
        <ScanSearch aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <p>
          <strong>Antes de confirmar, confira o nome do beneficiário</strong>
          {setup.receiver ? (
            <>
              {" "}
              (<strong>{setup.receiver.name}</strong>
              {setup.receiver.city ? `, ${setup.receiver.city}` : ""})
            </>
          ) : null}{" "}
          e o valor de {amount} na tela do seu banco. Se algo estiver diferente, não conclua o
          pagamento.
        </p>
      </div>

      <p className="mt-3 flex gap-3 rounded-2xl bg-lilac-50 p-4 text-sm leading-relaxed text-ink ring-1 ring-lilac-100">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-lilac-700" />
        <span>
          O pagamento é feito no <strong>aplicativo do seu banco</strong>. Este site não processa
          nem confirma pagamentos: a doação só acontece quando você confirma o Pix no app.
        </span>
      </p>

      <dl className="mt-3 grid gap-x-4 gap-y-0.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-petal-100 sm:grid-cols-[auto_1fr]">
        {setup.receiver ? (
          <>
            <dt className="font-bold text-ink">Beneficiário</dt>
            <dd className="mb-2 text-muted sm:mb-0">
              {setup.receiver.name}
              {setup.receiver.city ? ` · ${setup.receiver.city}` : ""}
            </dd>
          </>
        ) : null}
        <dt className="font-bold text-ink">Chave Pix</dt>
        <dd className="[overflow-wrap:anywhere] text-muted">{setup.key}</dd>
      </dl>

      <HowToPay />

      <p className="mt-8 flex items-center justify-center gap-2 text-center font-display text-xl text-petal-800 italic">
        <Heart aria-hidden className="size-5 shrink-0 fill-heart text-heart" />
        Cada gesto de carinho faz parte da caminhada da May.
      </p>
    </section>
  );
}
