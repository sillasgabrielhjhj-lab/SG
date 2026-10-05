/** Glifos simples e genéricos para redes sociais (sem logotipos oficiais). */
const paths: Record<string, string> = {
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.2-1.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  facebook: "M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v7h4v-7h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5Z",
  youtube: "M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3Z",
  tiktok: "M16.5 3a4.5 4.5 0 0 0 4 4v3.2a7.6 7.6 0 0 1-4-1.2V15a6 6 0 1 1-6-6v3.3a2.7 2.7 0 1 0 2.7 2.7V3Z",
  x: "M4 4h4.6l3.7 5.1L16.6 4H20l-6.1 7 6.6 9h-4.6l-4-5.5L7 20H3.6l6.5-7.4Z",
};

export function SocialIcon({ name, className }: { name: keyof typeof paths | string; className?: string }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} fill={name === "instagram" ? "none" : "currentColor"} stroke={name === "instagram" ? "currentColor" : "none"} strokeWidth={name === "instagram" ? 1.8 : 0} aria-hidden>
      <path d={d} />
    </svg>
  );
}
