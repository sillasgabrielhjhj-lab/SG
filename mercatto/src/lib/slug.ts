import { normalizeText } from "@/lib/utils";

/** "Apple iPhone 16 128GB – Preto" -> "apple-iphone-16-128gb-preto" */
export function slugify(input: string, maxLength = 90): string {
  return normalizeText(input)
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/**
 * Gera um slug único consultando um verificador assíncrono.
 * Ex.: "iphone-16", "iphone-16-2", "iphone-16-3"...
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  if (!(await exists(root))) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
