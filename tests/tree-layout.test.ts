import { describe, expect, it } from "vitest";
import { layoutVisibleTree } from "../app/canvas/treeLayout";
import type { NodeInstance } from "../app/canvas/types";

function instance(
  instanceId: string,
  parentInstanceId?: string,
  anchorKey?: string,
): NodeInstance {
  return {
    anchorKey,
    depth: parentInstanceId ? 1 : 0,
    direction: parentInstanceId ? "right" : undefined,
    instanceId,
    nodeId: instanceId,
    origin: { x: 0, y: 0 },
    parentInstanceId,
    x: 0,
    y: 0,
  };
}

describe("visible tree layout", () => {
  it("orders siblings by their position in the parent Markdown", () => {
    const sourceOrder = new Map([
      ["read", 0],
      ["display", 1],
      ["input", 2],
      ["edit", 3],
    ]);
    const scene = [
      instance("root"),
      instance("edit-node", "root", "edit"),
      instance("read-node", "root", "read"),
      instance("input-node", "root", "input"),
      instance("display-node", "root", "display"),
    ];

    const result = layoutVisibleTree({
      getOrder: (_parent, child) =>
        sourceOrder.get(child.anchorKey ?? "") ?? Number.MAX_SAFE_INTEGER,
      getSize: () => ({ height: 100, width: 200 }),
      horizontalGap: 80,
      instances: scene,
      verticalGap: 30,
    });
    const positions = Object.fromEntries(
      result.map((node) => [node.instanceId, node]),
    );

    expect(positions["read-node"].y).toBeLessThan(
      positions["display-node"].y,
    );
    expect(positions["display-node"].y).toBeLessThan(
      positions["input-node"].y,
    );
    expect(positions["input-node"].y).toBeLessThan(
      positions["edit-node"].y,
    );
    expect(
      positions["display-node"].y - positions["read-node"].y,
    ).toBeGreaterThanOrEqual(130);
    expect(positions["read-node"].x).toBe(280);
  });
});
