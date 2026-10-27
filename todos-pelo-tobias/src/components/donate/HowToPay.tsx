import { BadgeCheck, ClipboardPaste, Smartphone } from "lucide-react";

const STEPS = [
  { icon: Smartphone, title: "Abra o app do seu banco", text: "Entre na área Pix do aplicativo que você já usa." },
  {
    icon: ClipboardPaste,
    title: "Escaneie ou cole o código",
    text: "Aponte a câmera para o QR Code ou escolha “Pix Copia e Cola” e cole o código copiado.",
  },
  {
    icon: BadgeCheck,
    title: "Confira e confirme",
    text: "Veja se o valor e o nome do recebedor estão corretos e confirme o pagamento no app.",
  },
];

export function HowToPay() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-extrabold text-brand-950">Como pagar</h3>
      <ol className="mt-4 space-y-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-brand-100">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-bold text-brand-950">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-2xl bg-cream p-4 text-sm leading-relaxed text-ink/90 ring-1 ring-brand-100">
        <strong>Está no celular?</strong> Toque em “Copiar código Pix”, abra o app do seu banco e cole em Pix › Pix
        Copia e Cola. Não dá para escanear um QR Code que está na tela do próprio aparelho.
      </p>
    </div>
  );
}
