"use client";

/** Último recurso (erro no layout raiz): HTML mínimo com estilos inline. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f6f4", color: "#14211c", display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24 }}>
        <main style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>A Mercatto está instável no momento</h1>
          <p style={{ color: "#4b5d55", lineHeight: 1.5 }}>Já estamos trabalhando nisso. Tente novamente em alguns instantes.</p>
          {error.digest ? <p style={{ fontSize: 12, color: "#6b7c74" }}>Código de referência: {error.digest}</p> : null}
          <button onClick={reset} style={{ marginTop: 16, background: "#0b5c4d", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
