import { describe, expect, it } from "vitest";
import {
  buildContentGraph,
  listContentRoutes,
} from "../tools/content-graph.server";

describe("content graph", () => {
  it("builds one rooted, fully reachable graph", async () => {
    const graph = await buildContentGraph();

    expect(graph.rootId).toBe("home");
    expect(Object.keys(graph.nodes)).toEqual(["home"]);
    expect(graph.paths).toEqual({ home: ["home"] });
  });

  it("treats home.md as the root without frontmatter", async () => {
    const graph = await buildContentGraph();
    const home = graph.nodes.home;

    expect(home.sourcePath).toBe("home.md");
    expect(home.title).toBe("Minsecrus");
    expect(home.links).toEqual([]);
  });

  it("pre-renders the root and every focusable node", async () => {
    const routes = await listContentRoutes();

    expect(routes).toEqual(["/"]);
  });
});
