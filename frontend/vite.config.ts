import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

const browserBufferPath = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));

export default defineConfig(({ command, mode }) => {
  const viteEnvironment = loadEnv(mode, process.cwd(), "VITE_");

  return {
    define: Object.fromEntries(
      Object.entries(viteEnvironment).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    server: {
      host: "::",
      port: 8080,
      allowedHosts: ["sb-72at8zaph08z.vercel.run", "sb-3m6jmxah493c.vercel.run"],
    },
    resolve: {
      tsconfigPaths: true,
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "buffer",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      tailwindcss(),
      ...tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
        server: { entry: "server" },
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
  };
});
