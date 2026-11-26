import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const browserBufferPath = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));

export default defineConfig({
  vite: {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    server: {
      allowedHosts: ["sb-72at8zaph08p.vercel.run", "sb-3m6jmxah493c.vercel.run"],
    },
    optimizeDeps: {
      include: ["buffer"],
    },
    plugins: [
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
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
