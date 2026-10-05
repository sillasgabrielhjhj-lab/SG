/** Marca Mercatto para ImageResponse (ícones PWA e Open Graph). Sem dependências do DOM. */
export function MercattoMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b5c4d" }}>
      <svg width={inner} height={inner} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="11" fill="#0b5c4d" />
        <path d="M10 29V18.5a4.5 4.5 0 0 1 9 0V29M19 18.5a4.5 4.5 0 0 1 9 0V25" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.6 22.6 28 26.2l3.6-3.6" fill="none" stroke="#f5b400" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
