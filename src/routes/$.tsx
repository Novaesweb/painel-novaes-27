import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/panel/App";

export const Route = createFileRoute("/$")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel Master — NovaesWeb" },
      { name: "description", content: "Módulos administrativos do Painel Master NovaesWeb." },
      { property: "og:title", content: "Painel Master — NovaesWeb" },
      { property: "og:description", content: "Módulos administrativos do Painel Master NovaesWeb." },
    ],
  }),
  component: App,
});
