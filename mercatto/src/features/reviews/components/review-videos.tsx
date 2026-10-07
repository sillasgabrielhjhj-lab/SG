/** Vídeos do comprador na avaliação (só baixa os metadados até a pessoa dar play). */
export function ReviewVideos({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((src) => (
        <video key={src} src={src} controls preload="metadata" playsInline aria-label="Vídeo enviado pelo comprador" className="aspect-video w-full max-w-xs rounded-md bg-black" />
      ))}
    </div>
  );
}
