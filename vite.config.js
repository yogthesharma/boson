const path = require("node:path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const tailwindcss = require("@tailwindcss/vite").default;

const DEV_CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'";

function cspPermissiveForDev() {
  return {
    name: "csp-permissive-for-dev",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          /content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'"/,
          `content="${DEV_CSP}"`
        );
      },
    },
  };
}

module.exports = defineConfig({
  root: path.join(__dirname, "src/renderer"),
  plugins: [react(), tailwindcss(), cspPermissiveForDev()],
  base: "./",
  resolve: {
    alias: {
      "@": path.join(__dirname, "src/renderer"),
    },
  },
  build: {
    outDir: path.join(__dirname, "dist-renderer"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
});
