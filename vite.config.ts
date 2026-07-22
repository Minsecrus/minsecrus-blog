import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { contentGraphPlugin } from "./tools/content-plugin";

const configuredBasePath = process.env.BASE_PATH
  ?.trim()
  .replace(/^\/+|\/+$/gu, "");
const base = configuredBasePath ? `/${configuredBasePath}/` : "/";

export default defineConfig({
  base,
  plugins: [contentGraphPlugin(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
