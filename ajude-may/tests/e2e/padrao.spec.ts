import { expect, test } from "@playwright/test";

// Site no estado padrão (como o projeto está hoje): sem chave Pix, sem meta e sem fotos.
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

test("sem chave Pix: nenhum QR Code de exemplo, aviso de 'em breve' e compartilhamento", async ({
  page,
}) => {
  await page.goto("/doar");
  await expect(
    page.getByRole("heading", { name: "As doações por Pix serão liberadas em breve" }),
  ).toBeVisible();
  await expect(page.getByTestId("pix-qrcode")).toHaveCount(0);
  await expect(page.locator("#pix-codigo")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("tobiasvaquinha");
  expect(html).not.toContain("br.gov.bcb.pix");
});

test("sem fotos: espaços reservados, nenhuma imagem de terceiros; transparência com 'em breve'", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(
    page.getByText("As fotos da May serão publicadas aqui, com a autorização da família."),
  ).toBeVisible();
  const transparency = nbsp(await page.locator("#transparencia").innerText());
  expect(transparency).toContain(
    "As informações sobre os responsáveis pela arrecadação serão publicadas aqui.",
  );
  expect(transparency).toContain("Nenhuma atualização publicada ainda.");
  expect(transparency).not.toMatch(/verificad[oa]|depoimento/i);
});
