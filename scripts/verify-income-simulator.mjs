import { createRequire } from "node:module";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const bundled = process.env.CHROMIUM_PACKAGE
  ? (await import(process.env.CHROMIUM_PACKAGE)).default
  : null;
const out = path.resolve("audit/income-simulator");
mkdirSync(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve("src") } },
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
let browser;
const results = [];
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const viewport of [
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    browser = await chromium.launch({
      headless: true,
      args: bundled?.args ?? ["--no-sandbox"],
      ...(bundled ? { executablePath: await bundled.executablePath() } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" || u.protocol === "data:") await route.continue();
      else {
        external.push(u.origin);
        await route.abort();
      }
    });
    await page.goto(base + "/audit/income-simulator/browser.html");
    await page.getByLabel("Nome da simulação", { exact: true }).fill("Minha meta de R$ 5.000");
    await page.getByRole("combobox", { name: /^Plano do grupo 1/ }).selectOption("NOVAES_PREMIUM");
    await page.getByLabel("Quantidade do grupo 1", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Adicionar grupo de clientes", exact: true }).tap();
    await page.getByLabel("Quantidade do grupo 2", { exact: true }).fill("5");
    await page.getByRole("button", { name: "Adicionar grupo de clientes", exact: true }).tap();
    await page.getByRole("combobox", { name: /^Plano do grupo 3/ }).selectOption("NOVAES_START");
    await page.getByLabel("Quantidade do grupo 3", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Adicionar grupo de clientes", exact: true }).tap();
    await page.getByRole("combobox", { name: /^Plano do grupo 4/ }).selectOption("NOVAES_EMPRESARIAL");
    await page.getByLabel("Quantidade do grupo 4", { exact: true }).fill("2");
    await page
      .getByLabel("Mensalidade personalizada do grupo 4 (R$, opcional)", { exact: true })
      .fill("500");
    await page.getByLabel("Gastos fixos (R$/mês)", { exact: true }).fill("1000");
    await page.getByLabel("Custo base por cliente (R$/mês)", { exact: true }).fill("10");
    await page.getByLabel("Impostos estimados (%)", { exact: true }).fill("6");
    await page.getByLabel("Taxas estimadas (%)", { exact: true }).fill("2");
    const summary = page.getByRole("region", { name: "Resultado estimado" });
    assert((await summary.innerText()).includes("3.298,80"));
    assert((await summary.innerText()).includes("4.890,00"));
    await page.getByRole("button", { name: "Duplicar simulação", exact: true }).tap();
    await page.getByLabel("Nome da simulação", { exact: true }).fill("Cenário com 50 clientes");
    await page.getByLabel("Quantidade do grupo 1", { exact: true }).fill("40");
    await page.getByRole("button", { name: "Editar Minha meta de R$ 5.000", exact: true }).tap();
    assert.equal(
      await page.getByLabel("Quantidade do grupo 1", { exact: true }).inputValue(),
      "10",
    );
    await page
      .getByRole("button", { name: "Salvar simulações neste navegador", exact: true })
      .tap();
    await page.getByRole("status").filter({ hasText: "Simulações salvas" }).waitFor();
    await page.reload();
    assert.equal(
      await page.getByLabel("Quantidade do grupo 1", { exact: true }).inputValue(),
      "10",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Editar Cenário com 50 clientes", exact: true })
        .count(),
      1,
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    const undersized = await page
      .locator(".income-simulator button")
      .evaluateAll((bs) =>
        bs.filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent),
      );
    assert.deepEqual(undersized, []);
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, viewport.name + "-result.png") });
    await page.getByRole("region", { name: "Comparação de simulações" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, viewport.name + "-comparison.png") });
    await page.getByRole("region", { name: "Grupos de clientes" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, viewport.name + "-groups.png") });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    results.push({
      viewport,
      passed: true,
      totalClients: 20,
      recurringRevenueCents: 489000,
      recurringNetCents: 329880,
      scenarioSwitchPreserved: true,
      reloadPreserved: true,
      touchTargetsAtLeast44px: true,
      horizontalOverflow: overflow,
      externalRequests: external,
      consoleErrors: errors,
    });
    await browser.close();
    browser = undefined;
  }
  writeFileSync(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      { environment: "Interface local, sem login real, sem dados remotos", results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
