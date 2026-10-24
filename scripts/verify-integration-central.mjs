// Inicia apenas Vite local para o cenário de teste; bloqueia todas as requisições externas.
import { createRequire } from "node:module";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const output = path.resolve("audit/integration-central");
mkdirSync(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0 },
  resolve: { alias: { "@": path.resolve("src") } },
  logLevel: "error",
});
await server.listen();
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
let browser;
const bundled = process.env.CHROMIUM_PACKAGE
  ? (await import(process.env.CHROMIUM_PACKAGE)).default
  : null;
const results = [];
try {
  for (const viewport of [
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "tablet-landscape", width: 1024, height: 768 },
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
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" || url.protocol === "data:") await route.continue();
      else {
        external.push(url.origin);
        await route.abort();
      }
    });
    await page.goto(base + "/audit/integration-central/browser.html");
    await page.getByRole("button", { name: "Selecionar Burger House" }).click();
    await page.getByRole("button", { name: /Contagem automática de pedidos/ }).click();
    await page.getByRole("button", { name: "Gerar Prompt", exact: true }).click();
    const prompt = page.getByLabel("Prompt completo para Burger House");
    const original = await prompt.inputValue();
    assert(original.length > 6000);
    assert(original.includes("e2ba2dff-0b92-497d-9b08-926c235c2934"));
    assert(!original.includes("6fab38d7-aa0b-4b27-9c93-1beac81fec39"));
    await page.getByRole("button", { name: "Copiar Prompt", exact: true }).click();
    await page
      .getByText("Prompt copiado com sucesso! Agora envie ao chat responsável por esta loja.")
      .waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), original);
    await page.getByRole("button", { name: "Editar Cópia", exact: true }).click();
    const edited = original + "\nObservação do teste local no tablet.";
    await prompt.fill(edited);
    await page.getByRole("button", { name: "Copiar Prompt", exact: true }).click();
    await page
      .getByText("Prompt copiado com sucesso! Agora envie ao chat responsável por esta loja.")
      .waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), edited);
    await page.getByRole("button", { name: "Registrar instrução preparada nesta sessão" }).click();
    await page.getByText(/Progresso informado registrado somente nesta sessão/).waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false, "Não pode haver rolagem horizontal no dispositivo");
    const smallButtons = await page
      .locator(".store-integration-central button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.getBoundingClientRect().height < 44)
          .map((button) => button.textContent),
      );
    assert.deepEqual(smallButtons, [], "Botões devem ter pelo menos 44px para toque");
    await page.getByRole("region", { name: "Gerar Prompt de Integração" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, viewport.name + "-prompt.png") });
    await page.getByRole("button", { name: "Selecionar Fogo na Brasa" }).click();
    assert.equal(await page.getByLabel("Prompt completo para Burger House").count(), 0);
    await page.getByRole("button", { name: "Gerar Prompt", exact: true }).click();
    const other = await page.getByLabel("Prompt completo para Fogo na Brasa").inputValue();
    assert(other.includes("6fab38d7-aa0b-4b27-9c93-1beac81fec39"));
    assert(!other.includes("e2ba2dff-0b92-497d-9b08-926c235c2934"));
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Cópia bloqueada no cenário de teste");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Copiar Prompt", exact: true }).click();
    await page.getByRole("button", { name: "Selecionar todo o texto para cópia manual" }).click();
    const selected = await page
      .getByLabel("Prompt completo para Fogo na Brasa")
      .evaluate((element) => ({
        start: element.selectionStart,
        end: element.selectionEnd,
        length: element.value.length,
      }));
    assert.equal(selected.start, 0);
    assert.equal(selected.end, selected.length);
    await page.getByRole("region", { name: "Selecionar Loja" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, viewport.name + "-selection.png") });
    assert.deepEqual(errors, [], "Sem erros de execução no navegador");
    assert.deepEqual(external, [], "Sem requisições externas, inclusive ao Supabase");
    results.push({
      viewport,
      passed: true,
      clipboardCharacters: original.length,
      editedClipboardComplete: true,
      identityIsolation: true,
      horizontalOverflow: overflow,
      touchTargetsAtLeast44px: true,
      manualSelectionComplete: true,
      consoleErrors: errors,
      externalRequests: external,
    });
    await browser.close();
    browser = undefined;
  }
  writeFileSync(
    path.join(output, "browser-results.json"),
    JSON.stringify(
      { environment: "Fixture local, sem Supabase e sem login real", results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
