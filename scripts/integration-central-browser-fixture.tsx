// Cenário exclusivo de teste local. Não é rota de produção nem autenticação simulada no aplicativo.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { StoreIntegrationWorkspace } from "../src/panel/components/StoreIntegrationCentral";
import { approvedAddonFixture } from "../src/test/store-integration-fixtures";
import type { IntegrationSessionEvent } from "../src/panel/lib/storeIntegrationPrompts";
import "../src/panel/styles/base.css";
import "../src/panel/styles/PanelPolish.css";
import "../src/panel/styles/brand.css";
const fixture = approvedAddonFixture();
function LocalFixture() {
  const [events, setEvents] = useState<IntegrationSessionEvent[]>([]);
  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="site-integration-page">
          <section className="store-integration-central">
            <header className="integration-central-heading">
              <div>
                <span className="eyebrow">AMBIENTE DE TESTE LOCAL · SEM CONEXÃO REMOTA</span>
                <h2>Central de Integração por Loja</h2>
                <p>
                  Teste de interface com fixtures. Aprovações e domínios .test não são dados de
                  produção.
                </p>
              </div>
            </header>
            <StoreIntegrationWorkspace
              snapshot={fixture}
              events={events}
              onEventsChange={setEvents}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<LocalFixture />);
