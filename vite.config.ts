import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Link previews need an absolute image URL. SITE_URL sets the public
// address (for example https://example.pages.dev); on Cloudflare Pages the
// deployment's own CF_PAGES_URL is used when SITE_URL is not set.
function social_meta(env: Record<string, string>): Plugin {
  const site_url = (env.SITE_URL || env.CF_PAGES_URL || "").replace(/\/+$/, "");
  const image_url = `${site_url}/social_card.png`;
  return {
    name: "social_meta",
    transformIndexHtml() {
      const tags = [
        { tag: "meta", attrs: { property: "og:image", content: image_url }, injectTo: "head" as const },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" }, injectTo: "head" as const },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" }, injectTo: "head" as const },
        {
          tag: "meta",
          attrs: { property: "og:image:alt", content: "Latency of one recorded incident: the RL agent recovers while Kubernetes alone stays down." },
          injectTo: "head" as const,
        },
        { tag: "meta", attrs: { name: "twitter:image", content: image_url }, injectTo: "head" as const },
      ];
      if (site_url) {
        tags.push({ tag: "meta", attrs: { property: "og:url", content: `${site_url}/` }, injectTo: "head" as const });
      }
      return tags;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), social_meta(loadEnv(mode, ".", ""))],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
}));
