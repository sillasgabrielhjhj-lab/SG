/**
 * Texto de descrição com formatação leve e segura (sem HTML):
 *  - linha iniciada por "## " => subtítulo
 *  - linhas iniciadas por "- " => lista
 *  - linha em branco separa parágrafos
 * Todo o conteúdo é renderizado como texto pelo React (escape automático).
 */
type Block = { type: "h"; text: string } | { type: "ul"; items: string[] } | { type: "p"; text: string };

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h", text: line.slice(3).trim() });
    } else if (/^[-•] /.test(line.trimStart())) {
      flush();
      const item = line.trimStart().slice(2).trim();
      const last = blocks.at(-1);
      if (last?.type === "ul") last.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Versão em texto corrido (meta description, compartilhamento). */
export function richTextToPlain(source: string): string {
  return parseRichText(source)
    .map((b) => (b.type === "ul" ? b.items.join("; ") : b.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function RichText({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-fg">
      {parseRichText(source).map((b, i) =>
        b.type === "h" ? (
          <h3 key={i} className="pt-1 text-base font-bold text-fg">
            {b.text}
          </h3>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 text-fg-muted marker:text-brand-600">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line text-fg-muted">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}
