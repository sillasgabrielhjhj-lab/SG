import { Heart, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ShareButtons } from "@/components/share/ShareButtons";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatBRL } from "@/lib/money";
import type { PixPayment } from "@/lib/payments/types";
import type { PixSetup } from "@/lib/pix/setup";
import { HowToPay } from "./HowToPay";

interface PixPaymentCardProps {
  payment: PixPayment;
  receiver: Extract<PixSetup, { status: "ready" }>;
  siteUrl: string;
}

/** QR Code e "Copia e Cola" saem do MESMO texto (`payment.payload`): representam o mesmo pagamento. */
export function PixPaymentCard({ payment, receiver, siteUrl }: PixPaymentCardProps) {
  const amount = formatBRL(payment.amountCents);

  return (
    <section aria-labelledby="pix-titulo" className="animate-pop">
      <h2 id="pix-titulo" aria-live="polite" className="text-center text-2xl font-extrabold text-brand-950 sm:text-3xl">
        Você escolheu doar <span className="text-brand-600">{amount}</span> para ajudar o Tobias ❤️
      </h2>

      <div
        key={payment.payload}
        data-testid="pix-qrcode"
        className="mx-auto mt-7 w-fit animate-pop rounded-[1.75rem] bg-white p-3 shadow-lift ring-1 ring-brand-100"
      >
        <QRCodeSVG
          value={payment.payload}
          level="M"
          marginSize={4}
          bgColor="#ffffff"
          fgColor="#0b1f15"
          role="img"
          aria-label={`QR Code Pix no valor de ${amount}`}
          className="block h-auto w-[min(72vw,288px)]"
        />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        No computador? Aponte a câmera do app do seu banco para o QR Code.
      </p>

      <div className="mt-7">
        <label htmlFor="pix-codigo" className="block text-sm font-bold text-brand-900">
          Pix Copia e Cola
        </label>
        <textarea
          id="pix-codigo"
          readOnly
          rows={4}
          value={payment.payload}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full resize-none rounded-2xl border border-brand-200 bg-brand-50/60 p-4 font-mono text-xs leading-relaxed break-all text-brand-950"
        />
        <div className="mt-4">
          <CopyButton text={payment.payload} label="Copiar código Pix" className="w-full uppercase" />
        </div>
      </div>

      <p className="mt-5 flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-100">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <span>
          O pagamento é feito no <strong>aplicativo do seu banco</strong>. Este site não processa nem confirma
          pagamentos: a doação só é concluída quando você confirma o Pix no app.
        </span>
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-brand-100">
        <dt className="font-bold text-brand-900">Recebedor</dt>
        <dd className="text-muted">
          {receiver.receiverName} · {receiver.receiverCity}
        </dd>
        <dt className="font-bold text-brand-900">Chave Pix</dt>
        <dd className="break-all text-muted">{receiver.key}</dd>
      </dl>

      <HowToPay />

      <div className="mt-8 rounded-3xl bg-gradient-to-br from-brand-50 to-blush p-6 text-center ring-1 ring-brand-100">
        <Heart aria-hidden className="mx-auto size-8 animate-beat fill-heart text-heart" />
        <p className="mt-3 font-display text-2xl font-extrabold text-brand-950">Obrigado por querer ajudar o Tobias!</p>
        <p className="mt-1 text-muted">
          Cada gesto de solidariedade faz a diferença. Compartilhar a campanha também ajuda.
        </p>
        <ShareButtons url={siteUrl} className="mt-5" />
      </div>
    </section>
  );
}
