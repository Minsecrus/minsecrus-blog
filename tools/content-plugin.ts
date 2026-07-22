import path from "node:path";
import type { Plugin } from "vite";
import {
  buildContentGraph,
  contentDirectory,
} from "./content-graph.server";

const publicId = "virtual:minsecrus-content";
const resolvedId = `\0${publicId}`;

export function contentGraphPlugin(): Plugin {
  return {
    name: "minsecrus-content-graph",
    enforce: "pre",
    resolveId(id) {
      return id === publicId ? resolvedId : null;
    },
    async load(id) {
      if (id !== resolvedId) {
        return null;
      }

      const graph = await buildContentGraph();
      const serialised = JSON.stringify(graph).replaceAll("<", "\\u003c");
      return `export const contentGraph = ${serialised};`;
    },
    configureServer(server) {
      server.watcher.add(contentDirectory);
    },
    handleHotUpdate(context) {
      if (!context.file.startsWith(path.resolve(contentDirectory))) {
        return;
      }

      const virtualModule = context.server.moduleGraph.getModuleById(resolvedId);
      if (virtualModule) {
        context.server.moduleGraph.invalidateModule(virtualModule);
      }
      context.server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
