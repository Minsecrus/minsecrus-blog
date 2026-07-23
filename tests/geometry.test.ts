import { describe, expect, it } from "vitest";
import {
  cameraFromWheelGesture,
  edgePath,
  nextScaleStep,
  nodeLeftForPlacement,
  panWorldPointToViewport,
  snapCameraToPixelGrid,
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

  it("uses an unmodified wheel gesture to pan vertically", () => {
    expect(
      cameraFromWheelGesture({
        ctrlKey: false,
        current: { k: 1.25, x: 80, y: 120 },
        deltaMode: 0,
        deltaX: 30,
        deltaY: 45,
        maxScale: 1.8,
        minScale: 0.28,
        pointer: { x: 200, y: 150 },
        scaleStep: 0.25,
        shiftKey: false,
        viewportHeight: 800,
      }),
    ).toEqual({ k: 1.25, x: 80, y: 75 });
  });

  it("uses Shift plus wheel to pan horizontally", () => {
    const shared = {
      ctrlKey: false,
      current: { k: 1, x: 80, y: 120 },
      deltaMode: 0,
      maxScale: 1.8,
      minScale: 0.28,
      pointer: { x: 200, y: 150 },
      scaleStep: 0.25,
      shiftKey: true,
      viewportHeight: 800,
    };

    expect(
      cameraFromWheelGesture({ ...shared, deltaX: 0, deltaY: 45 }),
    ).toEqual({ k: 1, x: 35, y: 120 });
    expect(
      cameraFromWheelGesture({ ...shared, deltaX: 45, deltaY: 0 }),
    ).toEqual({ k: 1, x: 35, y: 120 });
  });

  it("uses Ctrl plus wheel to zoom around the pointer", () => {
    const pointer = { x: 240, y: 180 };
    const current = { k: 1.2, x: 60, y: 30 };
    const next = cameraFromWheelGesture({
      ctrlKey: true,
      current,
      deltaMode: 0,
      deltaX: 0,
      deltaY: -100,
      maxScale: 1.8,
      minScale: 0.28,
      pointer,
      scaleStep: 0.25,
      shiftKey: false,
      viewportHeight: 800,
    });

    expect(next.k).toBe(1.25);
    expect((pointer.x - next.x) / next.k).toBeCloseTo(
      (pointer.x - current.x) / current.k,
    );
    expect((pointer.y - next.y) / next.k).toBeCloseTo(
      (pointer.y - current.y) / current.k,
    );
  });

  it("moves between fixed 25% scale levels", () => {
    expect(nextScaleStep(1, 1)).toBe(1.25);
    expect(nextScaleStep(1, -1)).toBe(0.75);
    expect(nextScaleStep(0.62, 1)).toBe(0.75);
    expect(nextScaleStep(0.62, -1)).toBe(0.5);
    expect(nextScaleStep(1.75, 1)).toBe(1.75);
    expect(nextScaleStep(0.25, -1)).toBe(0.25);
  });

  it("snaps camera translation to the nearest device pixel", () => {
    expect(
      snapCameraToPixelGrid({ k: 1.25, x: 162.5, y: 281.25 }),
    ).toEqual({ k: 1.25, x: 163, y: 281 });
    expect(
      snapCameraToPixelGrid({ k: 1.25, x: 162.5, y: 281.25 }, 2),
    ).toEqual({ k: 1.25, x: 162.5, y: 281.5 });
  });
});
