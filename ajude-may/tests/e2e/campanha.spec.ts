import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { parsePix } from "pix-utils";
import { buildStaticPix } from "../../src/lib/pix/brcode";

// Site "configurado" (veja playwright.config.ts): chave fictícia de teste e meta de R$ 7.500 de R$ 20.000.
const PIX = {
  key: "chave-teste@example.com",
  receiverName: "Responsavel Teste",
  receiverCity: "Sao Paulo",
  description: "Ajude May",
};
const SITE = "http://localhost:3200";
const expectedPix = (amountCents: number) => buildStaticPix({ ...PIX, amountCents });
const nbsp = (text: string) => text.replace(/\s/g, " ");

/** Lê o QR Code exibido na tela (captura + decodificação), como um leitor faria. */
async function decodeQr(qr: Locator): Promise<string> {
  const png = PNG.sync.read(await qr.screenshot());
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) throw new Error("Não foi possível ler o QR Code exibido");
  return result.data;
}

const chip = (page: Page, label: RegExp) =>
  page.locator("label").filter({ hasText: label }).first();
const code = (page: Page) => page.locator("#pix-codigo");
const qrSvg = (page: Page) => page.getByTestId("pix-qrcode").locator("svg");
const chosen = (page: Page) =>
  page.getByRole("heading", { level: 2, name: /Você escolheu contribuir/ });

// Qualquer erro de JavaScript, de console ou violação de CSP reprova o teste.
const problemsByPage = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  problemsByPage.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(problemsByPage.get(page) ?? []).toEqual([]);
});

test.describe("navegação", () => {
  test("o card da vaquinha inteiro (inclusive a foto) abre a página de doação", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page.locator("article").first();
    await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await card.click({ position: { x: 40, y: 80 } }); // na foto, longe dos botões
    await expect(page).toHaveURL(/\/doar$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Sua solidariedade pode fazer a diferença na caminhada da May",
    );
  });

  test("foto do banner, 'QUERO AJUDAR A MAY', 'FAZER UMA DOAÇÃO', 'DOAR AGORA' e a meta levam a /doar", async ({
    page,
  }) => {
    const targets = [
      (p: Page) => p.getByRole("link", { name: "Toque para doar e ajudar a May" }),
      (p: Page) => p.getByRole("link", { name: "QUERO AJUDAR A MAY" }),
      (p: Page) => p.getByRole("link", { name: "FAZER UMA DOAÇÃO" }).first(),
      (p: Page) => p.getByRole("link", { name: "DOAR AGORA" }),
      (p: Page) => p.getByRole("link", { name: "AJUDAR A MAY AGORA" }),
    ];
    for (const target of targets) {
      await page.goto("/");
      await target(page).click();
      await expect(page).toHaveURL(/\/doar$/);
    }
  });

  test("o botão 'Compartilhar' do card não abre a doação", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/");
    await page.locator("article").getByRole("button", { name: "Compartilhar" }).click();
    await expect(page.getByText("Link copiado! Cole no WhatsApp")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SITE);
  });

  test("o menu leva às seções (desktop: links; celular: menu)", async ({ page, isMobile }) => {
    await page.goto("/");
    for (const [label, id] of [
      ["História", "historia"],
      ["Fotos", "fotos"],
      ["Nossa Meta", "meta"],
      ["Como Ajudar", "como-ajudar"],
      ["Início", "inicio"],
    ] as const) {
      if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
      const nav = page.getByRole("navigation", { name: isMobile ? "Menu" : "Principal" });
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("voltar à campanha e nenhuma rolagem horizontal", async ({ page }) => {
    for (const path of ["/", "/doar"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
    }
    await page.getByRole("link", { name: "Voltar à campanha" }).last().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Pix", () => {
  for (const cents of [500, 1000, 2000, 5000, 10000]) {
    const reais = `${cents / 100},00`;
    test(`R$ ${reais}: QR Code e Copia e Cola são o mesmo Pix, com o valor exato`, async ({
      page,
    }) => {
      await page.goto("/doar");
      await expect(page.getByTestId("pix-qrcode")).toHaveCount(0); // nada antes de escolher
      await chip(page, new RegExp(`^R\\$\\s*${cents / 100},00$`)).click();
      await expect(chosen(page)).toHaveText(
        `Você escolheu contribuir com R$ ${reais}. Obrigado por fazer parte dessa corrente de solidariedade!`,
        { useInnerText: true },
      );
      const text = await code(page).inputValue();
      expect(text).toBe(expectedPix(cents));
      expect(await decodeQr(qrSvg(page))).toBe(text);
      expect(parsePix(text)).toMatchObject({
        pixKey: PIX.key,
        merchantName: "RESPONSAVEL TESTE",
        merchantCity: "SAO PAULO",
        transactionAmount: cents / 100,
      });
    });
  }

  test("'Outro valor': digitar gera o QR na hora, com centavos", async ({ page }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");
    await expect(input).toHaveAttribute("inputmode", "decimal");
    for (const [typed, cents, shown] of [
      ["37,5", 3750, "R$ 37,50"],
      ["1.234,56", 123456, "R$ 1.234,56"],
    ] as const) {
      await input.fill(typed);
      await expect(chosen(page)).toContainText(shown, { useInnerText: true });
      const text = await code(page).inputValue();
      expect(text).toBe(expectedPix(cents));
      expect(await decodeQr(qrSvg(page))).toBe(text);
    }
    await page.getByText(/^R\$\s*10,00$/).click();
    await expect(input).toHaveValue(""); // um só valor por vez
    await expect(chosen(page)).toContainText("R$ 10,00", { useInnerText: true });
  });

  test("valores inválidos são recusados e não geram QR Code", async ({ page }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");
    const hint = page.locator("[id$='-dica']");
    for (const [typed, message] of [
      ["0", "Informe um valor maior que zero."],
      ["-5", "O valor não pode ser negativo."],
      ["abc", "Digite apenas números"],
      ["10,555", "no máximo duas casas decimais"],
      ["100000", "O valor máximo por QR Code"],
    ] as const) {
      await input.fill(typed);
      await expect(hint).toContainText(message);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByTestId("pix-qrcode")).toHaveCount(0);
    }
  });

  test("COPIAR PIX: confirmação visual, conteúdo correto, aviso do beneficiário e nada de 'doação confirmada'", async ({
    page,
  }) => {
    await page.goto("/doar");
    await chip(page, /^R\$\s*20,00$/).click();
    await page.getByRole("button", { name: "COPIAR PIX" }).click();
    await expect(page.getByRole("button", { name: "PIX COPIADO!" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedPix(2000));

    const body = nbsp(await page.locator("main").innerText());
    expect(body).toContain(
      "Antes de confirmar, confira o nome do beneficiário (Responsavel Teste, Sao Paulo)",
    );
    expect(body).toContain("Abra o aplicativo do seu banco");
    expect(body).toContain("Este site não processa nem confirma pagamentos");
    expect(body).not.toMatch(
      /doação (foi )?(concluída|realizada|confirmada|recebida)|pagamento (foi )?(confirmado|realizado|recebido)|obrigado pela doação/i,
    );
    await expect(page.getByRole("button", { name: "COPIAR PIX" })).toBeVisible({ timeout: 6000 });
  });

  test("celular: ao escolher um valor, o QR Code fica à vista", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só em telas de celular");
    await page.goto("/doar");
    await chip(page, /^R\$\s*50,00$/).click();
    const height = page.viewportSize()!.height;
    await expect
      .poll(async () => {
        const box = await page.getByTestId("pix-qrcode").boundingBox();
        return !!box && box.y >= 0 && box.y + box.height <= height;
      })
      .toBe(true);
  });
});

test.describe("meta de arrecadação (R$ 7.500 de R$ 20.000 neste teste)", () => {
  const section = (page: Page) => page.locator("#meta");
  const bar = (page: Page) => section(page).getByRole("progressbar");

  test("mostra arrecadado, meta, porcentagem e restante, com transparência", async ({ page }) => {
    await page.goto("/#meta");
    const text = nbsp(await section(page).innerText());
    for (const part of [
      "R$ 7.500,00",
      "R$ 20.000,00",
      "37,5%",
      "R$ 12.500,00",
      "Valores informados pelos responsáveis",
    ]) {
      expect(text).toContain(part);
    }
    expect(text).toContain("não consulta o banco nem confirma pagamentos");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "37.5");
    await expect(page.locator("article")).toContainText("37,5% da meta alcançada");
  });

  test("a barra se preenche ao aparecer na tela e termina fiel à porcentagem", async ({ page }) => {
    await page.goto("/");
    await section(page).scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        bar(page).evaluate((track) => {
          const fill = track.firstElementChild as HTMLElement;
          return fill
            .getAnimations()
            .some((a) => (a as CSSAnimation).animationName === "goal-fill");
        }),
      )
      .toBe(true);
    await page.waitForTimeout(2600);
    const ratio = await bar(page).evaluate((track) => {
      const fill = track.firstElementChild as HTMLElement;
      return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
    });
    expect(ratio).toBeCloseTo(0.375, 2);
  });

  test("gerar e copiar o Pix NÃO altera o valor arrecadado", async ({ page }) => {
    await page.goto("/doar");
    await chip(page, /^R\$\s*100,00$/).click();
    await page.getByRole("button", { name: "COPIAR PIX" }).click();
    await page.goto("/#meta");
    await expect(section(page)).toContainText("R$ 7.500,00");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "37.5");
  });
});

test.describe("galeria, história e compartilhamento", () => {
  test("galeria: miniaturas clicáveis, ampliação, navegação e fechar com Esc", async ({ page }) => {
    await page.goto("/#fotos");
    await page.getByRole("button", { name: /Ampliar foto 3 de 5/ }).click();
    const dialog = page.getByRole("dialog", { name: "Fotos da May" });
    await expect(dialog.getByText("3 / 5")).toBeVisible();
    await dialog.getByRole("button", { name: "Próxima foto" }).click();
    await expect(dialog.getByText("4 / 5")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByText("3 / 5")).toBeVisible();
    await dialog.getByRole("button", { name: "Ver foto 1" }).click();
    await expect(dialog.getByText("1 / 5")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // sem fotos reais ainda: só espaços reservados, nenhuma imagem de terceiros
    await expect(page.locator("#fotos img")).toHaveCount(0);
  });

  test("história e seção emocional com o texto oficial", async ({ page }) => {
    await page.goto("/");
    const text = nbsp(await page.locator("main").innerText());
    for (const part of [
      "May convive com uma condição rara",
      "Ela precisa de cuidados constantes, acompanhamento e apoio",
      "Por trás de cada desafio existe uma pessoa que merece cuidado, carinho e apoio.",
      "Uma caminhada que merece apoio, carinho e esperança.",
      "compartilhar essa história também é uma maneira importante de ajudar",
      "Sua ajuda faz a diferença",
    ]) {
      expect(text).toContain(part);
    }
  });

  test("WhatsApp, Facebook e copiar link com o texto pronto", async ({ page }) => {
    await page.goto("/#como-ajudar");
    const share = page.locator("#compartilhar");
    const wa = new URL((await share.getByRole("link", { name: /WhatsApp/ }).getAttribute("href"))!);
    expect(wa.origin + wa.pathname).toBe("https://wa.me/");
    expect(wa.searchParams.get("text")).toMatch(
      /^💗 AJUDE MAY NESSA CAMINHADA\n[\s\S]*🔗 http:\/\/localhost:3200$/,
    );
    expect(await share.getByRole("link", { name: /Facebook/ }).getAttribute("href")).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE)}`,
    );
    await share.getByRole("button", { name: "Copiar link" }).click();
    await expect(share.getByText("Link copiado!")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SITE);
    await share.getByRole("button", { name: "Copiar mensagem" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "🙏 Qualquer valor faz a diferença.",
    );
  });

  test("compartilhamento nativo aparece só quando o aparelho permite", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: unknown }).__shared = null;
      Object.defineProperty(navigator, "share", {
        value: async (data: unknown) => {
          (window as unknown as { __shared: unknown }).__shared = data;
        },
        configurable: true,
      });
    });
    await page.goto("/#como-ajudar");
    await page.locator("#compartilhar").getByRole("button", { name: "Mais opções" }).click();
    const shared = (await page.evaluate(
      () => (window as unknown as { __shared: unknown }).__shared,
    )) as {
      url: string;
      text: string;
    };
    expect(shared.url).toBe(SITE);
    expect(shared.text).toContain("AJUDE MAY NESSA CAMINHADA");
  });
});

test.describe("SEO e acessibilidade", () => {
  test("metadados, Open Graph, robots e sitemap", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle(/Ajude May nessa caminhada/);
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    expect(await meta('meta[property="og:title"]')).toContain("Ajude May nessa caminhada");
    const image = (await meta('meta[property="og:image"]'))!;
    expect(image).toMatch(/^http:\/\/localhost:3200\/opengraph-image/);
    const og = await request.get(image);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    expect((await request.get("/robots.txt")).status()).toBe(200);
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/doar");
    expect((await request.get("/doar")).headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  for (const path of ["/", "/doar"]) {
    test(`sem violações de acessibilidade (axe, WCAG A/AA) em ${path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      if (path === "/doar") {
        await page.getByLabel("Outro valor, em reais").fill("25,50");
        await expect(page.getByTestId("pix-qrcode")).toBeVisible();
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        ),
      ).toEqual([]);
    });
  }
});
