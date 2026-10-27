import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { parsePix } from "pix-utils";
import { buildStaticPix } from "../../src/lib/pix/brcode";

const PIX = {
  key: "tobiasvaquinha87@gmail.com",
  // sem nome/cidade informados, o código usa o nome da campanha e "BRASIL"
  receiverName: "Todos pelo Tobias",
  receiverCity: "Brasil",
  description: "Todos pelo Tobias",
};
const expectedPix = (amountCents: number) => buildStaticPix({ ...PIX, amountCents });
const nbsp = (text: string) => text.replace(/\s/g, " ");

/** Lê o QR Code exibido na tela (captura da imagem + decodificação), como um leitor faria. */
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

// Qualquer erro de JavaScript, de console ou violação de CSP em qualquer teste reprova o teste.
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
  test("o card da campanha (clicando na foto) abre a página de doação", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("article").first();
    await card.evaluate((el) => el.scrollIntoView({ block: "center" })); // longe do cabeçalho fixo
    await card.click({ position: { x: 40, y: 120 } }); // dentro da foto, longe do botão
    await expect(page).toHaveURL(/\/doar$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Ajude o Tobias com qualquer valor",
    );
  });

  test("botão do card, foto do banner, 'QUERO AJUDAR' e 'DOAR AGORA' levam a /doar", async ({
    page,
  }) => {
    const targets = [
      page.getByRole("link", { name: "Fazer uma doação", exact: true }),
      page.getByRole("link", { name: /Fazer uma doação para a campanha Todos pelo Tobias/ }),
      page.getByRole("link", { name: "QUERO AJUDAR O TOBIAS" }),
      page.getByRole("link", { name: "AJUDAR O TOBIAS AGORA" }),
      page.getByRole("link", { name: "DOAR AGORA" }),
    ];
    for (const index of targets.keys()) {
      await page.goto("/");
      await targets[index]!.first().click();
      await expect(page).toHaveURL(/\/doar$/);
    }
  });

  test("a página de doação tem o botão para voltar à campanha", async ({ page }) => {
    await page.goto("/doar");
    await page.getByRole("link", { name: "Voltar à campanha" }).last().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("o menu leva às seções (desktop: links; celular: menu sanduíche)", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
    const nav = page.getByRole("navigation", { name: isMobile ? "Menu" : "Principal" });
    for (const [label, id] of [
      ["Conheça Tobias", "conheca-tobias"],
      ["Fotos", "fotos"],
      ["Como Ajudar", "como-ajudar"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
    }
  });

  test("não há rolagem horizontal em / nem em /doar", async ({ page }) => {
    for (const path of ["/", "/doar"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Pix", () => {
  for (const cents of [500, 1000, 2000, 5000, 10000]) {
    const label = new RegExp(`^R\\$\\s*${Math.floor(cents / 100)},00$`);

    test(`R$ ${cents / 100},00: QR Code e Copia e Cola são o mesmo Pix, com o valor exato`, async ({
      page,
    }) => {
      await page.goto("/doar");
      await expect(page.getByTestId("pix-qrcode")).toHaveCount(0); // nada antes de escolher
      await chip(page, label).click();

      await expect(
        page.getByRole("heading", { level: 2, name: /Você escolheu doar/ }),
      ).toContainText(
        `Você escolheu doar R$ ${Math.floor(cents / 100)},00 para ajudar o Tobias ❤️`.replace(
          / /g,
          " ",
        ),
        { useInnerText: true },
      );
      const text = await code(page).inputValue();
      expect(text).toBe(expectedPix(cents));
      expect(await decodeQr(qrSvg(page))).toBe(text); // o QR Code contém exatamente o Copia e Cola

      // um parser independente confirma CRC, chave, recebedor e valor
      expect(parsePix(text)).toMatchObject({
        pixKey: PIX.key,
        merchantName: "TODOS PELO TOBIAS",
        merchantCity: "BRASIL",
        transactionAmount: cents / 100,
      });
    });
  }

  test("o campo 'Outro valor' já está visível ao abrir a página: digitar gera o QR na hora", async ({
    page,
  }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
    await expect(input).toHaveAttribute("inputmode", "decimal"); // teclado numérico no celular
    await expect(page.getByTestId("pix-qrcode")).toHaveCount(0);

    await input.fill("75");
    await expect(page.getByRole("heading", { level: 2, name: /Você escolheu doar/ })).toContainText(
      "R$ 75,00",
      {
        useInnerText: true,
      },
    );
    const text = await code(page).inputValue();
    expect(text).toBe(expectedPix(7500));
    expect(await decodeQr(qrSvg(page))).toBe(text);
    expect(parsePix(text)).toMatchObject({ pixKey: PIX.key, transactionAmount: 75 });
  });

  test("valor sugerido e 'Outro valor' não se misturam: um só escolhido por vez", async ({
    page,
  }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");
    const heading = page.getByRole("heading", { level: 2, name: /Você escolheu doar/ });

    await chip(page, /^R\$\s*50,00$/).click();
    await expect(heading).toContainText("R$ 50,00", { useInnerText: true });

    await input.fill("37,5");
    await expect(heading).toContainText("R$ 37,50", { useInnerText: true });
    await expect(page.getByRole("radio", { name: /R\$\s*50,00/ })).not.toBeChecked();

    await chip(page, /^R\$\s*10,00$/).click();
    await expect(heading).toContainText("R$ 10,00", { useInnerText: true });
    await expect(input).toHaveValue(""); // ao escolher um valor sugerido, o campo livre é limpo

    await input.fill("5");
    await expect(heading).toContainText("R$ 5,00", { useInnerText: true });
    await input.fill("");
    await expect(page.getByTestId("pix-qrcode")).toHaveCount(0); // campo apagado = nenhum valor escolhido
  });

  test("só com a chave Pix: sem nome de recebedor, sem avisos de configuração", async ({
    page,
  }) => {
    await page.goto("/doar");
    const initial = nbsp(await page.locator("main").innerText());
    expect(initial).not.toMatch(
      /Doações por Pix em breve|provisório|Modo de desenvolvimento|configuração/i,
    );
    await chip(page, /^R\$\s*20,00$/).click();
    await expect(page.getByTestId("pix-qrcode")).toBeVisible();
    const body = nbsp(await page.locator("main").innerText());
    expect(body).toContain("Chave Pix");
    expect(body).toContain(PIX.key);
    expect(body).not.toContain("Recebedor");
    expect(body).not.toMatch(/NOME DO RECEBEDOR|NOME TESTE/);
  });

  test("trocar o valor atualiza o QR Code na hora", async ({ page }) => {
    await page.goto("/doar");
    await chip(page, /^R\$\s*10,00$/).click();
    const first = await decodeQr(qrSvg(page));
    await chip(page, /^R\$\s*50,00$/).click();
    const second = await decodeQr(qrSvg(page));
    expect(first).toBe(expectedPix(1000));
    expect(second).toBe(expectedPix(5000));
    expect(first).not.toBe(second);
  });

  test("valores personalizados com duas casas decimais", async ({ page }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");

    for (const [typed, cents, shown] of [
      ["37,5", 3750, "R$ 37,50"],
      ["12.90", 1290, "R$ 12,90"],
      ["0,01", 1, "R$ 0,01"],
      ["1.234,56", 123456, "R$ 1.234,56"],
    ] as const) {
      await input.fill(typed);
      await expect(
        page.getByRole("heading", { level: 2, name: /Você escolheu doar/ }),
      ).toContainText(shown, {
        useInnerText: true,
      });
      const text = await code(page).inputValue();
      expect(text).toBe(expectedPix(cents));
      expect(await decodeQr(qrSvg(page))).toBe(text);
    }
  });

  test("valores inválidos, negativos ou zerados são recusados e não geram QR Code", async ({
    page,
  }) => {
    await page.goto("/doar");
    const input = page.getByLabel("Outro valor, em reais");
    const hint = page.locator("[id$='-dica']");

    for (const [typed, message] of [
      ["0", "Informe um valor maior que zero."],
      ["0,00", "Informe um valor maior que zero."],
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

    await input.fill("");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByTestId("pix-qrcode")).toHaveCount(0);

    await input.fill("12");
    await expect(page.getByTestId("pix-qrcode")).toBeVisible();
  });

  test("copiar o código Pix: confirmação visual, conteúdo correto e sem dizer que a doação foi concluída", async ({
    page,
  }) => {
    await page.goto("/doar");
    await chip(page, /^R\$\s*20,00$/).click();
    const button = page.getByRole("button", { name: "Copiar código Pix" });
    await button.click();
    await expect(page.getByRole("button", { name: "Código copiado!" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedPix(2000));

    const body = nbsp(await page.locator("main").innerText());
    expect(body).not.toMatch(
      /doação (foi )?(concluída|realizada|confirmada|recebida)|pagamento (foi )?(confirmado|realizado|recebido)|obrigado pela doação/i,
    );
    expect(body).toContain("Este site não processa nem confirma");

    await expect(page.getByRole("button", { name: "Copiar código Pix" })).toBeVisible({
      timeout: 6000,
    }); // volta ao normal
  });

  test("se a Clipboard API falhar, usa o plano B e, em último caso, avisa para copiar manualmente", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      document.execCommand = () => false;
    });
    await page.goto("/doar");
    await chip(page, /^R\$\s*5,00$/).click();
    await page.getByRole("button", { name: "Copiar código Pix" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Não foi possível copiar" }),
    ).toBeVisible();
  });
});

test.describe("meta de arrecadação", () => {
  const card = (page: Page) => page.getByRole("region", { name: /meta de arrecadação/ });
  const bar = (page: Page) =>
    page.getByRole("progressbar", { name: "Progresso da meta de arrecadação" });

  test("mostra os valores e textos da campanha (22 mil de 50 mil = 44%)", async ({ page }) => {
    await page.goto("/");
    const goal = card(page);
    await expect(goal).toContainText("TODOS PELO TOBIAS");
    await expect(goal).toContainText("R$ 22.000,00");
    await expect(goal).toContainText("arrecadados");
    await expect(goal).toContainText("Nossa meta: R$ 50.000,00");
    await expect(goal).toContainText("44% da meta alcançada!");
    await expect(goal).toContainText("Faltam R$ 28.000,00 para alcançarmos nosso objetivo.");
    await expect(goal).toContainText(
      "💚 Graças à solidariedade de tantas pessoas, já alcançamos R$ 22 mil. Cada contribuição nos aproxima da nossa meta de R$ 50 mil. Juntos pelo Tobias!",
    );
    // transparência: informado pela organização, sem afirmar verificação no banco
    await expect(goal).toContainText("Total informado pela organização da campanha");
    await expect(goal).toContainText("não consulta o banco nem confirma pagamentos");
    expect(nbsp(await goal.innerText())).not.toMatch(/verificad|confirmad[oa]s? (pelo|no) banco/i);
  });

  test("a meta aparece logo ao entrar, sem rolar a página", async ({ page }) => {
    await page.goto("/");
    const viewportHeight = page.viewportSize()!.height;
    const box = (await bar(page).boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height, "a barra deve caber na primeira tela").toBeLessThanOrEqual(
      viewportHeight,
    );
    await expect(card(page).getByText("44% da meta alcançada!")).toBeInViewport();
  });

  test("a barra é acessível e fiel: 44% de largura, sem exagero", async ({ page }) => {
    await page.goto("/");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "44");
    await expect(bar(page)).toHaveAttribute(
      "aria-valuetext",
      /44% da meta: R\$\s*22\.000,00 de R\$\s*50\.000,00/,
    );
    await page.waitForTimeout(2600); // fim da animação
    const ratio = await bar(page).evaluate((track) => {
      const fill = track.firstElementChild as HTMLElement;
      return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
    });
    expect(ratio).toBeCloseTo(0.44, 2);
  });

  test("animação de preenchimento: parte de 0% e termina exatamente em 44%", async ({ page }) => {
    await page.goto("/");
    const result = await bar(page).evaluate((track) => {
      const fill = track.firstElementChild as HTMLElement;
      const animation = fill
        .getAnimations()
        .find((a) => (a as CSSAnimation).animationName === "goal-fill");
      if (!animation) return null;
      animation.pause();
      animation.currentTime = 0;
      const start = fill.getBoundingClientRect().width;
      animation.currentTime = Number(animation.effect?.getComputedTiming().endTime);
      const end = fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
      return { start, end };
    });
    expect(result, "a animação goal-fill deve existir").not.toBeNull();
    expect(result!.start).toBe(0);
    expect(result!.end).toBeCloseTo(0.44, 2);
  });

  test("com movimento reduzido a barra já aparece cheia, sem animar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(150);
    const ratio = await bar(page).evaluate((track) => {
      const fill = track.firstElementChild as HTMLElement;
      return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
    });
    expect(ratio).toBeCloseTo(0.44, 2);
  });

  test("o botão 'AJUDAR O TOBIAS AGORA' leva à página de doação Pix", async ({ page }) => {
    await page.goto("/");
    await card(page).getByRole("link", { name: "AJUDAR O TOBIAS AGORA" }).click();
    await expect(page).toHaveURL(/\/doar$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Ajude o Tobias com qualquer valor",
    );
  });

  test("escolher valor, gerar QR Code e copiar o Pix NÃO alteram o valor arrecadado", async ({
    page,
  }) => {
    await page.goto("/doar");
    await chip(page, /^R\$\s*100,00$/).click();
    await page.getByRole("button", { name: "Copiar código Pix" }).click();
    await expect(page.getByRole("button", { name: "Código copiado!" })).toBeVisible();
    await page.goto("/");
    await expect(card(page)).toContainText("R$ 22.000,00");
    await expect(card(page)).toContainText("44% da meta alcançada!");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "44");
  });
});

test.describe("experiência", () => {
  test("animações de entrada: depois de rolar, nada fica escondido", async ({ page }) => {
    await page.goto("/");
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 500) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1800);
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll(".reveal")].filter(
          (el) => getComputedStyle(el).opacity !== "1",
        ).length,
    );
    expect(hidden).toBe(0);
  });

  test("celular: ao escolher um valor, o título e o QR Code ficam à vista (abaixo do cabeçalho fixo)", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "só se aplica a telas de celular");
    await page.goto("/doar");
    await chip(page, /^R\$\s*50,00$/).click();
    const viewportHeight = page.viewportSize()!.height;
    await expect
      .poll(async () => {
        const box = await page.getByTestId("pix-qrcode").boundingBox();
        return !!box && box.y >= 0 && box.y + box.height <= viewportHeight;
      })
      .toBe(true);
    const heading = await page.locator("#pix-titulo").boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(60); // o cabeçalho fixo tem 64px
  });
});

test.describe("galeria", () => {
  test("foto principal, miniaturas, ampliação e navegação", async ({ page, isMobile }) => {
    await page.goto("/#fotos");
    const open = page.getByRole("button", { name: /Ampliar foto 1 de 6/ });
    await expect(open).toBeVisible();
    await page.getByRole("button", { name: "Ver foto 4" }).click();
    await expect(page.getByRole("button", { name: /Ampliar foto 4 de 6/ })).toBeVisible();

    await page.getByRole("button", { name: /Ampliar foto 4 de 6/ }).click();
    const dialog = page.getByRole("dialog", { name: "Fotos do Tobias" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("4 / 6")).toBeVisible();
    await dialog.getByRole("button", { name: "Próxima foto" }).click();
    await expect(dialog.getByText("5 / 6")).toBeVisible();
    await dialog.getByRole("button", { name: "Foto anterior" }).click();
    await dialog.getByRole("button", { name: "Foto anterior" }).click();
    await expect(dialog.getByText("3 / 6")).toBeVisible();
    if (!isMobile) {
      await page.keyboard.press("ArrowRight");
      await expect(dialog.getByText("4 / 6")).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /Ampliar foto \d de 6/ })).toBeFocused();
  });
});

test.describe("compartilhamento", () => {
  test("WhatsApp, Facebook, Instagram e copiar link", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/#como-ajudar");
    const siteUrl = "http://localhost:3100";

    const wa = page.getByRole("link", { name: /WhatsApp/ }).first();
    const waUrl = new URL((await wa.getAttribute("href"))!);
    expect(waUrl.origin + waUrl.pathname).toBe("https://wa.me/");
    expect(waUrl.searchParams.get("text")).toBe(
      [
        "❤️ TODOS PELO TOBIAS ❤️",
        "Estamos unidos em uma campanha solidária para ajudar o Tobias. Qualquer contribuição faz a diferença!",
        "💚 Doe qualquer valor por Pix ou compartilhe esta campanha.",
        `🔗 ${siteUrl}`,
      ].join("\n"),
    );

    const fb = page.getByRole("link", { name: /Facebook/ }).first();
    expect(await fb.getAttribute("href")).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`,
    );
    expect(await wa.getAttribute("target")).toBe("_blank");
    expect(await wa.getAttribute("rel")).toContain("noopener");

    await page.getByRole("button", { name: "Copiar link" }).first().click();
    await expect(
      page.getByText("Link copiado! Agora é só colar onde quiser.").first(),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(siteUrl);

    await page.getByRole("button", { name: "Instagram" }).first().click(); // sem compartilhamento nativo: copia o link
    await expect(page.getByText(/Cole no Instagram/).first()).toBeVisible();
  });

  test("com compartilhamento nativo (celular), o Instagram abre a folha do sistema", async ({
    page,
  }) => {
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
    await page.getByRole("button", { name: "Instagram" }).first().click();
    const shared = (await page.evaluate(
      () => (window as unknown as { __shared: unknown }).__shared,
    )) as { url: string; text: string };
    expect(shared.url).toBe("http://localhost:3100");
    expect(shared.text).toContain("TODOS PELO TOBIAS");
  });
});

test.describe("SEO e acessibilidade", () => {
  test("metadados, Open Graph, robots e sitemap", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle(/Todos pelo Tobias/);
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    expect(await meta('meta[property="og:title"]')).toContain("Todos pelo Tobias");
    expect(await meta('meta[property="og:locale"]')).toBe("pt_BR");
    const image = (await meta('meta[property="og:image"]'))!;
    expect(image).toMatch(/^http:\/\/localhost:3100\/opengraph-image/);
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    const og = await request.get(image);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    expect((await request.get("/robots.txt")).status()).toBe(200);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/doar");
  });

  test("cabeçalhos de segurança", async ({ request }) => {
    const headers = (await request.get("/doar")).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
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
