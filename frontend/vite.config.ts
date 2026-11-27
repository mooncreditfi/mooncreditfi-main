import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsconfigPaths from "vite-tsconfig-paths";

const browserBufferPath = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));

export default defineConfig(({ command }) => ({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    allowedHosts: ["sb-72at8zaph08p.vercel.run", "sb-3m6jmxah493c.vercel.run"],
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  plugins: [
    viteTsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    react(),
    {
      name: "browser-buffer-polyfill-alias",
      enforce: "post",
      config(config) {
        const resolveOptions = config.resolve ?? {};
        const configuredAliases = resolveOptions.alias;
        const aliases = Array.isArray(configuredAliases)
          ? configuredAliases
          : Object.entries(configuredAliases ?? {}).map(([find, replacement]) => ({
              find,
              replacement,
            }));
        config.resolve = {
          ...resolveOptions,
          alias: [{ find: /^(node:)?buffer\/?$/, replacement: browserBufferPath }, ...aliases],
        };
      },
    },
  ],
}));
