import { expect, test, type Locator } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { parsePix } from "pix-utils";

async function decodeQr(qr: Locator): Promise<string> {
  const png = PNG.sync.read(await qr.screenshot());
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) throw new Error("Não foi possível ler o QR Code exibido");
  return result.data;
}

// Site no estado padrão, exatamente como será publicado: chave Pix oficial, meta oficial, foto e vídeo.
const nbsp = (text: string) => text.replace(/\s/g, " ");

test("dados oficiais: R$ 16.000 de R$ 30.000 (53,3%), faltam R$ 14.000, na capa e em /doar", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.locator("#arrecadacao");
  await expect(card).toBeInViewport();
  const text = nbsp(await card.innerText());
  for (const part of [
    "AJUDE MAY NESSA CAMINHADA",
    "R$ 16.000,00",
    "já arrecadados",
    "Meta: R$ 30.000,00",
    "53,3% da nossa meta alcançada!",
    "Faltam R$ 14.000,00 para alcançarmos nosso objetivo.",
    "❤️ Já percorremos mais da metade dessa caminhada! Graças à solidariedade de tantas pessoas, alcançamos R$ 16 mil. Mas ainda precisamos da sua ajuda. Cada contribuição representa mais apoio, cuidado e esperança para a May.",
    "Valores informados pelos responsáveis pela campanha",
    "não consulta o banco nem confirma pagamentos",
  ]) {
    expect(text).toContain(part);
  }
  expect(text).not.toMatch(/verificad|doador/i);
  const bar = card.getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuenow", "53.33");
  const ratio = await bar.evaluate((track) => {
    const fill = track.firstElementChild as HTMLElement;
    return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
  });
  expect(ratio).toBeCloseTo(0.5333, 3);

  await card.getByRole("link", { name: "FAZER MINHA DOAÇÃO" }).click();
  await expect(page).toHaveURL(/\/doar$/);
  const compact = nbsp(await page.getByRole("region", { name: "Nossa meta" }).innerText());
  for (const part of [
    "R$ 16.000,00",
    "arrecadados de R$ 30.000,00",
    "53,3% alcançado",
    "Faltam R$ 14.000,00",
  ]) {
    expect(compact).toContain(part);
  }
});

test("chave Pix oficial: valores sugeridos e QR Code idêntico ao Copia e Cola", async ({
  page,
}) => {
  await page.goto("/doar");
  for (const value of ["5,00", "10,00", "20,00", "50,00", "100,00"]) {
    await expect(
      page.locator("label").filter({ hasText: new RegExp(`^R\\$\\s*${value}$`) }),
    ).toBeVisible();
  }
  await expect(page.getByLabel("Outro valor, em reais")).toBeVisible();

  await page
    .locator("label")
    .filter({ hasText: /^R\$\s*20,00$/ })
    .first()
    .click();
  const code = await page.locator("#pix-codigo").inputValue();
  expect(parsePix(code)).toMatchObject({
    pixKey: "ajudemaya00@gmail.com",
    merchantName: "AJUDE MAY",
    merchantCity: "BRASIL",
    transactionAmount: 20,
  });
  expect(await decodeQr(page.getByTestId("pix-qrcode").locator("svg"))).toBe(code);
  await expect(page.locator("main")).toContainText("ajudemaya00@gmail.com");
  expect(await page.content()).not.toContain("tobiasvaquinha");
});

test("foto real na capa e transparência sem dados inventados", async ({ page }) => {
  await page.goto("/");
  const img = page.locator("#inicio img").first();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await expect(
    page.locator("#fotos").getByRole("button", { name: /Assistir ao vídeo/ }),
  ).toBeVisible();
  const transparency = nbsp(await page.locator("#transparencia").innerText());
  expect(transparency).toContain("ajudemaya00@gmail.com");
  expect(transparency).toContain(
    "As informações sobre os responsáveis pela arrecadação serão publicadas aqui.",
  );
  expect(transparency).toContain("Nenhuma atualização publicada ainda.");
  expect(transparency).not.toMatch(/verificad[oa]|depoimento/i);
});
