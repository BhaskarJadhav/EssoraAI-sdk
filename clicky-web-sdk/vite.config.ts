import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const workerProxyTarget = env.VITE_CLICKY_WORKER_PROXY_TARGET;

  return {
    server: {
      proxy: workerProxyTarget
        ? {
            "/clicky-worker": {
              target: workerProxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/clicky-worker/, "")
            }
          }
        : undefined
    },
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "ClickySDK",
        fileName: "clicky-web-sdk",
        formats: ["es", "umd"]
      },
      rollupOptions: {
        output: {
          exports: "named"
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true
    }
  };
});
