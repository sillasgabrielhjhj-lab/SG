import { Clock3 } from "lucide-react";
import { ShareButtons } from "@/components/share/ShareButtons";

/** Exibido enquanto a chave Pix oficial não for configurada: nunca mostramos um QR Code de exemplo. */
export function PixUnavailable({ siteUrl }: { siteUrl: string }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 text-center shadow-lift ring-1 ring-petal-100 sm:p-10">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-lilac-100 text-lilac-700">
        <Clock3 aria-hidden className="size-7" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold text-ink sm:text-3xl">
        As doações por Pix serão liberadas em breve
      </h2>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
        Os responsáveis pela campanha estão finalizando a configuração da chave Pix oficial da May.
        Enquanto isso, você pode ajudar compartilhando esta história com quem também queira apoiar.
      </p>
      <ShareButtons url={siteUrl} className="mt-8" />
    </div>
  );
}
