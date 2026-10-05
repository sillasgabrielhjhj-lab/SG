import type { DemoArtView } from "../catalog";
import type { Finish } from "../palette";
import type { Art } from "../svg";

/**
 * Desenha um produto no espaço 800×800 (sem o fundo de estúdio), incluindo a
 * própria sombra de contato. Pode ser reaproveitado em composições/banners
 * via `place()`.
 */
export type DrawKind = (a: Art, f: Finish, view: DemoArtView) => string;
