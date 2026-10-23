import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/panel/App";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel Master — NovaesWeb" },
      { name: "description", content: "Painel de gestão NovaesWeb: lojas, sites, clientes e auditoria." },
      { property: "og:title", content: "Painel Master — NovaesWeb" },
      { property: "og:description", content: "Painel de gestão NovaesWeb: lojas, sites, clientes e auditoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});
