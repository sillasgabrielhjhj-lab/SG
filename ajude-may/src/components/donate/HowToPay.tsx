import { BadgeCheck, ClipboardPaste, Smartphone } from "lucide-react";

const STEPS = [
  {
    icon: Smartphone,
    title: "Abra o aplicativo do seu banco",
    text: "Entre na área Pix do aplicativo que você já usa.",
  },
  {
    icon: ClipboardPaste,
    title: "Escaneie ou cole o código",
    text: "Aponte a câmera para o QR Code ou escolha “Pix Copia e Cola” e cole o código copiado.",
  },
  {
    icon: BadgeCheck,
    title: "Confira e confirme",
    text: "Veja se o valor e o nome do beneficiário estão corretos e confirme o pagamento no app.",
  },
];

export function HowToPay() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-ink">Como pagar</h3>
      <ol className="mt-4 space-y-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-ivory p-4 ring-1 ring-petal-100">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lilac-100 text-lilac-700">
              <Icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-bold text-ink">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-2xl bg-lilac-50 p-4 text-sm leading-relaxed text-ink/90 ring-1 ring-lilac-100">
        <strong>Está no celular?</strong> Toque em “COPIAR PIX”, abra o app do seu banco e cole em
        Pix › Pix Copia e Cola. Não dá para escanear um QR Code que está na tela do próprio
        aparelho.
      </p>
    </div>
  );
}
