import type { NodeInstance, Size } from "./types";

interface LayoutVisibleTreeOptions {
  getOrder: (parent: NodeInstance, child: NodeInstance) => number;
  getSize: (instance: NodeInstance) => Size;
  horizontalGap: number;
  instances: NodeInstance[];
  verticalGap: number;
}

export function layoutVisibleTree({
  getOrder,
  getSize,
  horizontalGap,
  instances,
  verticalGap,
}: LayoutVisibleTreeOptions): NodeInstance[] {
  const byId = new Map(
    instances.map((instance) => [instance.instanceId, instance]),
  );
  const childrenByParent = new Map<string, NodeInstance[]>();

  for (const instance of instances) {
    if (!instance.parentInstanceId || !byId.has(instance.parentInstanceId)) {
      continue;
    }
    const siblings = childrenByParent.get(instance.parentInstanceId) ?? [];
    siblings.push(instance);
    childrenByParent.set(instance.parentInstanceId, siblings);
  }

  for (const [parentId, children] of childrenByParent) {
    const parent = byId.get(parentId);
    if (!parent) {
      continue;
    }
    children.sort((left, right) => {
      const order = getOrder(parent, left) - getOrder(parent, right);
      return order || left.instanceId.localeCompare(right.instanceId);
    });
  }

  const spanCache = new Map<string, number>();
  const subtreeSpan = (instance: NodeInstance): number => {
    const cached = spanCache.get(instance.instanceId);
    if (cached !== undefined) {
      return cached;
    }

    const ownHeight = getSize(instance).height;
    const children = childrenByParent.get(instance.instanceId) ?? [];
    const childrenHeight = children.reduce(
      (total, child, index) =>
        total + subtreeSpan(child) + (index > 0 ? verticalGap : 0),
      0,
    );
    const span = Math.max(ownHeight, childrenHeight);
    spanCache.set(instance.instanceId, span);
    return span;
  };

  const positioned = new Map<string, NodeInstance>();
  const placeBranch = (instance: NodeInstance, x: number, top: number) => {
    const size = getSize(instance);
    const span = subtreeSpan(instance);
    const children = childrenByParent.get(instance.instanceId) ?? [];
    const childrenHeight = children.reduce(
      (total, child, index) =>
        total + subtreeSpan(child) + (index > 0 ? verticalGap : 0),
      0,
    );
    const y = top + (span - size.height) / 2;
    positioned.set(instance.instanceId, { ...instance, x, y });

    let childTop = top + (span - childrenHeight) / 2;
    for (const child of children) {
      placeBranch(child, x + size.width + horizontalGap, childTop);
      childTop += subtreeSpan(child) + verticalGap;
    }
  };

  const roots = instances.filter(
    (instance) =>
      !instance.parentInstanceId || !byId.has(instance.parentInstanceId),
  );
  for (const root of roots) {
    const rootSize = getSize(root);
    const rootTop = root.y - (subtreeSpan(root) - rootSize.height) / 2;
    placeBranch(root, root.x, rootTop);
  }

  return instances.map(
    (instance) => positioned.get(instance.instanceId) ?? instance,
  );
}
