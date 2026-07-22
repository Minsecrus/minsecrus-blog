import type { Config } from "@react-router/dev/config";
import { listContentRoutes } from "./tools/content-graph.server";

const configuredBasePath = process.env.BASE_PATH
  ?.trim()
  .replace(/^\/+|\/+$/gu, "");
const basename = configuredBasePath ? `/${configuredBasePath}/` : "/";

export default {
  basename,
  ssr: false,
  async prerender() {
    return listContentRoutes();
  },
} satisfies Config;
