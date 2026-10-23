import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/panel/App";

export const Route = createFileRoute("/$")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Módulos de gestão — NovaesWeb Master" },
      { name: "description", content: "Módulos administrativos do Painel Master NovaesWeb." },
      { property: "og:title", content: "Módulos de gestão — NovaesWeb Master" },
      { property: "og:description", content: "Módulos administrativos do Painel Master NovaesWeb." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});
