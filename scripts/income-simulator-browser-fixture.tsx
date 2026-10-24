// Exclusivo para verificação local. Não é rota de produção nem login simulado.
import React from "react";
import { createRoot } from "react-dom/client";
import { IncomeSimulator } from "../src/panel/components/IncomeSimulator";
import "../src/panel/styles/base.css";
import "../src/panel/styles/PanelPolish.css";
import "../src/panel/styles/brand.css";
createRoot(document.getElementById("root")!).render(
  <div className="app-shell">
    <main className="page-content">
      <p>TESTE LOCAL DE INTERFACE · SEM CONEXÃO REMOTA</p>
      <IncomeSimulator catalog={[]} storageScope="browser-local-test" />
    </main>
  </div>,
);
