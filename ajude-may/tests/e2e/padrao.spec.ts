import { expect, test } from "@playwright/test";

// Site no estado padrão (como o projeto está hoje): sem chave Pix, sem meta e sem fotos.
const nbsp = (text: string) => text.replace(/\s/g, " ");

test("sem meta configurada: só o objetivo e o botão de doação, nenhum número", async ({ page }) => {
  await page.goto("/");
  const main = nbsp(await page.locator("main").innerText());
  expect(main).not.toMatch(/R\$\s?\d/); // nenhum valor em reais na página inicial
  expect(main).not.toMatch(/\d+% da meta|arrecadados/);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator("#meta")).toContainText("Nosso objetivo");
  await expect(
    page.locator("#meta").getByRole("link", { name: "AJUDAR A MAY AGORA" }),
  ).toBeVisible();
  await expect(page.locator("article")).toContainText(
    "Objetivo: apoiar os cuidados e o acompanhamento da May",
  );
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
