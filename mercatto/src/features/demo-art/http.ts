/** Cabeçalhos/respostas compartilhados pelos route handlers de `/demo-assets/**`. */

export const DEMO_SVG_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  "X-Content-Type-Options": "nosniff",
};

export function svgResponse(svg: string): Response {
  return new Response(svg, { status: 200, headers: DEMO_SVG_HEADERS });
}

export function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
