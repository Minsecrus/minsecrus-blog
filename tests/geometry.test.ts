import { describe, expect, it } from "vitest";
import {
  edgePath,
  nodeLeftForPlacement,
  panWorldPointToViewport,
} from "../app/canvas/geometry";

describe("canvas geometry", () => {
  it("pans to a title without changing the current scale", () => {
    const camera = panWorldPointToViewport(
      { x: 900, y: 240 },
      { x: 160, y: 112 },
      { x: 290, y: 210, k: 1.25 },
    );

    expect(camera.k).toBe(1.25);
    expect(900 * camera.k + camera.x).toBe(160);
    expect(240 * camera.k + camera.y).toBe(112);
  });

  it("creates a cubic path from the inline anchor", () => {
    expect(edgePath({ x: 10, y: 20 }, { x: 200, y: 80 }, "right")).toMatch(
      /^M 10 20 C /u,
    );
  });

  it("centers the root node and right-aligns non-root nodes", () => {
    const shared = {
      horizontalMargin: 70.4,
      nodeWidth: 620,
      scale: 1,
      viewportWidth: 1280,
    };

    expect(
      nodeLeftForPlacement({ ...shared, placement: "center" }),
    ).toBe(330);
    expect(
      nodeLeftForPlacement({ ...shared, placement: "right" }),
    ).toBeCloseTo(589.6);
  });
});
