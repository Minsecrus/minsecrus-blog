import { AnimatePresence, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { contentGraph } from "virtual:minsecrus-content";
import { CanvasDirectory } from "./CanvasDirectory";
import { CanvasHud } from "./CanvasHud";
import { CanvasInfo } from "./CanvasInfo";
import { EdgeLayer } from "./EdgeLayer";
import {
  CAMERA_SCALE_STEP,
  HORIZONTAL_GAP,
  MAX_CAMERA_SCALE,
  MIN_CAMERA_SCALE,
  VERTICAL_GAP,
  boundsForRects,
  cameraFromWheelGesture,
  edgePath,
  fitBounds,
  nextScaleStep,
  nodeLeftForPlacement,
  panWorldPointToViewport,
  snapCameraToPixelGrid,
} from "./geometry";
import { MarkdownNode } from "./MarkdownNode";
import { layoutVisibleTree } from "./treeLayout";
import type {
  CameraTransform,
  EdgeGeometry,
  ExpansionDirection,
  GraphActivation,
  NodeInstance,
  Rect,
  Size,
} from "./types";

const DESKTOP_NODE_WIDTH = 620;
const ESTIMATED_NODE_HEIGHT = 330;
const CAMERA_DURATION = 560;
const MIN_SCALE = MIN_CAMERA_SCALE;
const MAX_SCALE = MAX_CAMERA_SCALE;

interface InstanceFocusOptions {
  duration?: number;
  side?: "center" | "right";
  scale?: number;
}

function contentIdFromPath(pathname: string): string {
  const value = pathname.replace(/^\/+|\/+$/gu, "");
  if (!value) {
    return contentGraph.rootId;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return contentGraph.rootId;
  }
}

function estimatedHeight(nodeId: string): number {
  const htmlLength = contentGraph.nodes[nodeId]?.html.length ?? 0;
  return Math.min(520, Math.max(250, 190 + htmlLength * 0.34));
}

function makeInitialInstances(
  focusId: string,
  nodeWidth: number,
): NodeInstance[] {
  const safeFocusId = contentGraph.paths[focusId]
    ? focusId
    : contentGraph.rootId;
  const path = contentGraph.paths[safeFocusId];
  const instances: NodeInstance[] = [];

  for (const [index, nodeId] of path.entries()) {
    if (index === 0) {
      instances.push({
        depth: 0,
        instanceId: "root",
        nodeId,
        origin: { x: 0, y: 0 },
        x: 0,
        y: 0,
      });
      continue;
    }

    const parent = instances[index - 1];
    const link = contentGraph.nodes[parent.nodeId].links.find(
      (candidate) => candidate.targetId === nodeId,
    );
    const x = parent.x + nodeWidth + HORIZONTAL_GAP;
    const y = parent.y + 54;

    instances.push({
      anchorKey: link?.anchorKey,
      depth: index,
      direction: "right",
      instanceId: `route-${index}-${nodeId}`,
      nodeId,
      origin: {
        x: parent.x + nodeWidth,
        y: parent.y + 84,
      },
      parentInstanceId: parent.instanceId,
      x,
      y,
    });
  }

  return instances;
}

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function cameraTransformValue(camera: CameraTransform): string {
  return `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
}

function hasSameLayout(
  current: NodeInstance[],
  next: NodeInstance[],
): boolean {
  return current.every((instance, index) => {
    const candidate = next[index];
    return (
      candidate?.instanceId === instance.instanceId &&
      Math.abs(candidate.x - instance.x) < 0.25 &&
      Math.abs(candidate.y - instance.y) < 0.25
    );
  });
}

export function CanvasExperience() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const requestedContentId = contentIdFromPath(location.pathname);
  const focusContentId = contentGraph.nodes[requestedContentId]
    ? requestedContentId
    : contentGraph.rootId;

  const [viewportSize, setViewportSize] = useState<Size>({
    height: 800,
    width: 1280,
  });
  const [nodeWidth, setNodeWidth] = useState(DESKTOP_NODE_WIDTH);
  const initialInstances = useMemo(
    () => makeInitialInstances(focusContentId, DESKTOP_NODE_WIDTH),
    // The initial scene should only be computed once. Later URL changes are
    // reconciled without throwing away the reader's expanded branches.
    [],
  );
  const [instances, setInstances] = useState<NodeInstance[]>(initialInstances);
  const [dimensions, setDimensions] = useState<Record<string, Size>>({});
  const [edges, setEdges] = useState<EdgeGeometry[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [cameraScale, setCameraScale] = useState(1);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const nodeElementsRef = useRef(new Map<string, HTMLElement>());
  const instancesRef = useRef(instances);
  const dimensionsRef = useRef(dimensions);
  const cameraRef = useRef<CameraTransform>({ k: 1, x: 0, y: 0 });
  const cameraFrameRef = useRef<number | null>(null);
  const initialCameraAppliedRef = useRef(false);
  const instanceCounterRef = useRef(initialInstances.length);
  const edgeFrameRef = useRef<number | null>(null);
  const pendingTitleFocusRef = useRef<string | null>(null);
  const skipNextRoutePanRef = useRef(false);

  const commitInstances = useCallback((next: NodeInstance[]) => {
    instancesRef.current = next;
    setInstances(next);
  }, []);

  const rectForInstance = useCallback(
    (instance: NodeInstance): Rect => {
      const size = dimensionsRef.current[instance.instanceId] ?? {
        height: estimatedHeight(instance.nodeId),
        width: nodeWidth,
      };
      return { x: instance.x, y: instance.y, ...size };
    },
    [nodeWidth],
  );

  const layoutInstances = useCallback(
    (scene: NodeInstance[]) =>
      layoutVisibleTree({
        getOrder: (parent, child) => {
          const index = contentGraph.nodes[parent.nodeId]?.links.findIndex(
            (link) => link.anchorKey === child.anchorKey,
          );
          return index === undefined || index < 0
            ? Number.MAX_SAFE_INTEGER
            : index;
        },
        getSize: (instance) =>
          dimensionsRef.current[instance.instanceId] ?? {
            height: estimatedHeight(instance.nodeId),
            width: nodeWidth,
          },
        horizontalGap: HORIZONTAL_GAP,
        instances: scene,
        verticalGap: VERTICAL_GAP,
      }),
    [nodeWidth],
  );

  const stopCameraAnimation = useCallback(() => {
    if (cameraFrameRef.current !== null) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
  }, []);

  const commitCamera = useCallback((camera: CameraTransform) => {
    const next = snapCameraToPixelGrid(
      { ...camera, k: clampScale(camera.k) },
      window.devicePixelRatio,
    );
    cameraRef.current = next;
    setCameraScale(next.k);
    if (worldRef.current) {
      worldRef.current.style.transform = cameraTransformValue(next);
    }
  }, []);

  const applyCamera = useCallback(
    (camera: CameraTransform, duration = CAMERA_DURATION) => {
      if (!worldRef.current) {
        return;
      }

      stopCameraAnimation();
      const start = cameraRef.current;
      const target = { ...camera, k: clampScale(camera.k) };
      if (reducedMotion || duration === 0) {
        commitCamera(target);
        return;
      }

      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        commitCamera({
          k: start.k + (target.k - start.k) * eased,
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
        });

        if (progress < 1) {
          cameraFrameRef.current = requestAnimationFrame(tick);
        } else {
          cameraFrameRef.current = null;
        }
      };

      cameraFrameRef.current = requestAnimationFrame(tick);
    },
    [commitCamera, reducedMotion, stopCameraAnimation],
  );

  const fitScene = useCallback(
    (sceneInstances = instancesRef.current) => {
      const bounds = boundsForRects(sceneInstances.map(rectForInstance));
      applyCamera(fitBounds(bounds, viewportSize, 1), CAMERA_DURATION);
    },
    [applyCamera, rectForInstance, viewportSize],
  );

  const panToInstanceTitle = useCallback(
    (instance: NodeInstance, options: InstanceFocusOptions = {}) => {
      const element = nodeElementsRef.current.get(instance.instanceId);
      const heading = element?.querySelector<HTMLElement>("h1, h2, h3");
      const compact = nodeWidth < DESKTOP_NODE_WIDTH;
      const titleOffset = {
        x: heading?.offsetLeft ?? (compact ? 12 : 20),
        y: heading?.offsetTop ?? (compact ? 30 : 34),
      };
      const titlePoint = {
        x: instance.x + titleOffset.x,
        y: instance.y + titleOffset.y,
      };
      const size = dimensionsRef.current[instance.instanceId] ?? {
        height: estimatedHeight(instance.nodeId),
        width: nodeWidth,
      };
      const scale = clampScale(options.scale ?? cameraRef.current.k);
      const side = options.side ?? "right";
      const horizontalMargin = Math.max(
        24,
        Math.min(72, viewportSize.width * 0.055),
      );
      const verticalMargin = Math.max(
        28,
        Math.min(64, viewportSize.height * 0.075),
      );
      const nodeLeft = nodeLeftForPlacement({
        horizontalMargin,
        nodeWidth: size.width,
        placement: side,
        scale,
        viewportWidth: viewportSize.width,
      });
      const scaledHeight = size.height * scale;
      const nodeTop =
        scaledHeight <= viewportSize.height - verticalMargin * 2
          ? (viewportSize.height - scaledHeight) / 2
          : verticalMargin;
      const titleDestination = {
        x: nodeLeft + titleOffset.x * scale,
        y: nodeTop + titleOffset.y * scale,
      };

      applyCamera(
        panWorldPointToViewport(
          titlePoint,
          titleDestination,
          { ...cameraRef.current, k: scale },
        ),
        options.duration ?? CAMERA_DURATION,
      );
    },
    [applyCamera, nodeWidth, viewportSize],
  );

  const recomputeEdges = useCallback(() => {
    const cameraScale = Math.max(cameraRef.current.k, 0.001);
    const nextEdges: EdgeGeometry[] = [];

    for (const child of instancesRef.current) {
      if (!child.parentInstanceId || !child.anchorKey || !child.direction) {
        continue;
      }

      const parent = instancesRef.current.find(
        (candidate) => candidate.instanceId === child.parentInstanceId,
      );
      const parentElement = nodeElementsRef.current.get(
        child.parentInstanceId,
      );
      const childElement = nodeElementsRef.current.get(child.instanceId);
      if (!parent || !parentElement) {
        continue;
      }

      const anchorElement = Array.from(
        parentElement.querySelectorAll<HTMLAnchorElement>(
          "a[data-anchor-key]",
        ),
      ).find((anchor) => anchor.dataset.anchorKey === child.anchorKey);
      const parentRect = parentElement.getBoundingClientRect();
      const anchorRect = anchorElement?.getBoundingClientRect();
      const headingRect = childElement
        ?.querySelector<HTMLElement>("h1, h2, h3")
        ?.getBoundingClientRect();
      const parentSize = dimensionsRef.current[parent.instanceId] ?? {
        height: parentRect.height / cameraScale,
        width: parentRect.width / cameraScale,
      };
      const childSize = dimensionsRef.current[child.instanceId] ?? {
        height: estimatedHeight(child.nodeId),
        width: nodeWidth,
      };

      const fallbackX =
        child.direction === "left"
          ? 0
          : child.direction === "right"
            ? parentSize.width
            : parentSize.width / 2;
      const anchorScreenX = anchorRect
        ? child.direction === "left"
          ? anchorRect.left
          : child.direction === "right"
            ? anchorRect.right
            : anchorRect.left + anchorRect.width / 2
        : null;
      const start =
        anchorRect && anchorScreenX !== null
          ? {
              x: (anchorScreenX - cameraRef.current.x) / cameraScale,
              y:
                (anchorRect.top +
                  anchorRect.height / 2 -
                  cameraRef.current.y) /
                cameraScale,
            }
          : {
              x: parent.x + fallbackX,
              y: parent.y + Math.min(88, parentSize.height / 2),
            };
      const end = headingRect
        ? {
            x: (headingRect.left - cameraRef.current.x) / cameraScale,
            y:
              (headingRect.top +
                headingRect.height / 2 -
                cameraRef.current.y) /
              cameraScale,
          }
        : child.direction === "right"
          ? { x: child.x, y: child.y + Math.min(76, childSize.height / 2) }
          : child.direction === "left"
            ? {
                x: child.x + childSize.width,
                y: child.y + Math.min(76, childSize.height / 2),
              }
            : { x: child.x + childSize.width / 2, y: child.y };

      nextEdges.push({
        childInstanceId: child.instanceId,
        direction: child.direction,
        end,
        id: `edge-${child.instanceId}`,
        path: edgePath(start, end, child.direction),
        start,
      });
    }

    setEdges(nextEdges);
  }, [nodeWidth]);

  const animateEdgeGeometry = useCallback(
    (duration = 720) => {
      if (edgeFrameRef.current !== null) {
        cancelAnimationFrame(edgeFrameRef.current);
      }
      const startedAt = performance.now();

      const tick = (now: number) => {
        recomputeEdges();
        if (now - startedAt < duration) {
          edgeFrameRef.current = requestAnimationFrame(tick);
        } else {
          edgeFrameRef.current = null;
        }
      };
      edgeFrameRef.current = requestAnimationFrame(tick);
    },
    [recomputeEdges],
  );

  const registerNode = useCallback(
    (instanceId: string, element: HTMLElement | null) => {
      if (element) {
        nodeElementsRef.current.set(instanceId, element);
      } else {
        nodeElementsRef.current.delete(instanceId);
      }
      requestAnimationFrame(recomputeEdges);
    },
    [recomputeEdges],
  );

  const measureNode = useCallback(
    (instanceId: string, size: Size) => {
      const previous = dimensionsRef.current[instanceId];
      if (
        previous &&
        Math.abs(previous.width - size.width) < 0.5 &&
        Math.abs(previous.height - size.height) < 0.5
      ) {
        return;
      }

      const next = { ...dimensionsRef.current, [instanceId]: size };
      dimensionsRef.current = next;
      setDimensions(next);
      requestAnimationFrame(recomputeEdges);
    },
    [recomputeEdges],
  );

  useEffect(() => {
    const current = instancesRef.current;
    const next = layoutInstances(current);
    if (!hasSameLayout(current, next)) {
      commitInstances(next);
      animateEdgeGeometry();
    }

    const pendingId = pendingTitleFocusRef.current;
    if (pendingId && dimensions[pendingId]) {
      pendingTitleFocusRef.current = null;
      const target = next.find(
        (instance) => instance.instanceId === pendingId,
      );
      if (target) {
        requestAnimationFrame(() => panToInstanceTitle(target));
      }
    }
  }, [
    animateEdgeGeometry,
    commitInstances,
    dimensions,
    instances,
    layoutInstances,
    panToInstanceTitle,
  ]);

  const collapseFrom = useCallback(
    (child: NodeInstance) => {
      const removed = new Set([child.instanceId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of instancesRef.current) {
          if (
            candidate.parentInstanceId &&
            removed.has(candidate.parentInstanceId) &&
            !removed.has(candidate.instanceId)
          ) {
            removed.add(candidate.instanceId);
            changed = true;
          }
        }
      }

      const remaining = instancesRef.current.filter(
        (candidate) => !removed.has(candidate.instanceId),
      );
      const next = layoutInstances(remaining);
      if (
        pendingTitleFocusRef.current &&
        removed.has(pendingTitleFocusRef.current)
      ) {
        pendingTitleFocusRef.current = null;
      }
      commitInstances(next);
      setAnnouncement(`已收起${contentGraph.nodes[child.nodeId].title}`);
      stopCameraAnimation();
      animateEdgeGeometry();
    },
    [
      animateEdgeGeometry,
      commitInstances,
      layoutInstances,
      stopCameraAnimation,
    ],
  );

  const activateGraphLink = useCallback(
    (parent: NodeInstance, activation: GraphActivation) => {
      const existing = instancesRef.current.find(
        (candidate) =>
          candidate.parentInstanceId === parent.instanceId &&
          candidate.anchorKey === activation.anchorKey,
      );

      if (existing) {
        collapseFrom(existing);
        skipNextRoutePanRef.current = true;
        navigate(
          parent.nodeId === contentGraph.rootId ? "/" : `/${parent.nodeId}`,
        );
        return;
      }

      const parentElement = nodeElementsRef.current.get(parent.instanceId);
      if (!parentElement) {
        return;
      }

      const parentScreenRect = parentElement.getBoundingClientRect();
      const anchorScreenRect = activation.anchorElement.getBoundingClientRect();
      const camera = cameraRef.current;
      const direction: ExpansionDirection = "right";
      const parentSize = dimensionsRef.current[parent.instanceId] ?? {
        height: parentScreenRect.height / Math.max(camera.k, 0.001),
        width: nodeWidth,
      };
      const anchorWorldY =
        parent.y +
        (anchorScreenRect.top +
          anchorScreenRect.height / 2 -
          parentScreenRect.top) /
          Math.max(camera.k, 0.001);
      const anchorWorldX =
        parent.x +
        (anchorScreenRect.left +
          anchorScreenRect.width / 2 -
          parentScreenRect.left) /
          Math.max(camera.k, 0.001);
      instanceCounterRef.current += 1;
      const child: NodeInstance = {
        anchorKey: activation.anchorKey,
        depth: parent.depth + 1,
        direction,
        instanceId: `instance-${instanceCounterRef.current}-${activation.targetId}`,
        nodeId: activation.targetId,
        origin: { x: anchorWorldX, y: anchorWorldY },
        parentInstanceId: parent.instanceId,
        x: parent.x + parentSize.width + HORIZONTAL_GAP,
        y: anchorWorldY - 72,
      };

      const next = layoutInstances([...instancesRef.current, child]);
      pendingTitleFocusRef.current = child.instanceId;
      commitInstances(next);
      setAnnouncement(`已展开${contentGraph.nodes[child.nodeId].title}`);
      animateEdgeGeometry();
      navigate(`/${activation.targetId}`);
    },
    [
      animateEdgeGeometry,
      collapseFrom,
      commitInstances,
      layoutInstances,
      navigate,
      nodeWidth,
    ],
  );

  const returnHome = useCallback(() => {
    const root = instancesRef.current.find(
      (instance) => instance.instanceId === "root",
    );
    if (!root) {
      return;
    }

    commitInstances([root]);
    pendingTitleFocusRef.current = null;
    skipNextRoutePanRef.current = true;
    setAnnouncement("已回到根节点");
    navigate("/");
    requestAnimationFrame(() => {
      panToInstanceTitle(root, { scale: 1, side: "center" });
      animateEdgeGeometry();
    });
  }, [
    animateEdgeGeometry,
    commitInstances,
    navigate,
    panToInstanceTitle,
  ]);

  const returnToCurrentNode = useCallback(() => {
    const current = [...instancesRef.current]
      .reverse()
      .find((instance) => instance.nodeId === focusContentId);
    if (!current) {
      return;
    }

    pendingTitleFocusRef.current = null;
    panToInstanceTitle(current, {
      scale: 1,
      side: current.nodeId === contentGraph.rootId ? "center" : "right",
    });
    setAnnouncement(`已回到当前节点：${contentGraph.nodes[current.nodeId].title}`);
  }, [focusContentId, panToInstanceTitle]);

  const zoomBy = useCallback(
    (direction: -1 | 1) => {
      const current = cameraRef.current;
      const nextK = nextScaleStep(current.k, direction);
      const centerX = viewportSize.width / 2;
      const centerY = viewportSize.height / 2;
      const ratio = nextK / current.k;
      applyCamera({
        k: nextK,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      });
    },
    [applyCamera, viewportSize],
  );

  const zoomTo = useCallback(
    (scale: number) => {
      const current = cameraRef.current;
      const nextK = clampScale(scale);
      const centerX = viewportSize.width / 2;
      const centerY = viewportSize.height / 2;
      const ratio = nextK / current.k;
      applyCamera({
        k: nextK,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      });
    },
    [applyCamera, viewportSize],
  );

  const selectDirectoryNode = useCallback(
    (nodeId: string) => {
      if (nodeId === contentGraph.rootId) {
        returnHome();
        return;
      }
      navigate(`/${nodeId}`);
    },
    [navigate, returnHome],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !worldRef.current) {
      return;
    }

    type Point = { x: number; y: number };
    type Gesture = {
      camera: CameraTransform;
      centroid: Point;
      distance: number;
    };

    const pointers = new Map<number, Point>();
    let gesture: Gesture | null = null;
    let isDragging = false;

    const pointFromEvent = (event: PointerEvent): Point => {
      const rect = viewport.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const pointerMetrics = () => {
      const points = [...pointers.values()];
      const first = points[0] ?? { x: 0, y: 0 };
      const second = points[1] ?? first;
      return {
        centroid: {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        },
        distance:
          points.length > 1
            ? Math.hypot(second.x - first.x, second.y - first.y)
            : 1,
      };
    };

    const resetGesture = () => {
      const metrics = pointerMetrics();
      gesture = { camera: cameraRef.current, ...metrics };
    };

    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "a, button, input, textarea, select, [contenteditable='true'], .markdown-node, .canvas-hud",
        ),
      );

    const handlePointerDown = (event: PointerEvent) => {
      if (
        (event.pointerType === "mouse" && event.button !== 0) ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      stopCameraAnimation();
      pointers.set(event.pointerId, pointFromEvent(event));
      viewport.setPointerCapture(event.pointerId);
      resetGesture();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !gesture) {
        return;
      }

      pointers.set(event.pointerId, pointFromEvent(event));
      const current = pointerMetrics();
      const moved = Math.hypot(
        current.centroid.x - gesture.centroid.x,
        current.centroid.y - gesture.centroid.y,
      );
      if (moved > 3 || pointers.size > 1) {
        isDragging = true;
        viewport.classList.add("canvas-viewport--dragging");
      }

      const scaleRatio =
        pointers.size > 1 && gesture.distance > 0
          ? current.distance / gesture.distance
          : 1;
      const nextK = clampScale(gesture.camera.k * scaleRatio);
      const ratio = nextK / gesture.camera.k;
      commitCamera({
        k: nextK,
        x:
          current.centroid.x -
          (gesture.centroid.x - gesture.camera.x) * ratio,
        y:
          current.centroid.y -
          (gesture.centroid.y - gesture.camera.y) * ratio,
      });
      event.preventDefault();
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) {
        return;
      }

      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      if (pointers.size > 0) {
        resetGesture();
      } else {
        gesture = null;
        isDragging = false;
        viewport.classList.remove("canvas-viewport--dragging");
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopCameraAnimation();
      const rect = viewport.getBoundingClientRect();
      commitCamera(
        cameraFromWheelGesture({
          ctrlKey: event.ctrlKey,
          current: cameraRef.current,
          deltaMode: event.deltaMode,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          maxScale: MAX_SCALE,
          minScale: MIN_SCALE,
          pointer: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          scaleStep: CAMERA_SCALE_STEP,
          shiftKey: event.shiftKey,
          viewportHeight: viewport.clientHeight,
        }),
      );
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (!isInteractiveTarget(event.target)) {
        event.preventDefault();
      }
    };

    commitCamera(cameraRef.current);
    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointermove", handlePointerMove);
    viewport.addEventListener("pointerup", handlePointerEnd);
    viewport.addEventListener("pointercancel", handlePointerEnd);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("dblclick", handleDoubleClick);

    return () => {
      stopCameraAnimation();
      viewport.classList.remove("canvas-viewport--dragging");
      viewport.removeEventListener("pointerdown", handlePointerDown);
      viewport.removeEventListener("pointermove", handlePointerMove);
      viewport.removeEventListener("pointerup", handlePointerEnd);
      viewport.removeEventListener("pointercancel", handlePointerEnd);
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [commitCamera, stopCameraAnimation]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewport = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      setViewportSize({ width, height });
      setNodeWidth(
        width < 760 ? Math.max(296, Math.min(620, width - 32)) : 620,
      );
    };
    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const existing = [...instancesRef.current]
      .reverse()
      .find((instance) => instance.nodeId === focusContentId);
    if (existing) {
      if (skipNextRoutePanRef.current) {
        skipNextRoutePanRef.current = false;
        return;
      }
      if (
        initialCameraAppliedRef.current &&
        pendingTitleFocusRef.current !== existing.instanceId &&
        existing.nodeId !== contentGraph.rootId
      ) {
        requestAnimationFrame(() => panToInstanceTitle(existing));
      }
      return;
    }

    const routeInstances = layoutInstances(
      makeInitialInstances(focusContentId, nodeWidth),
    );
    commitInstances(routeInstances);
    initialCameraAppliedRef.current = false;
    animateEdgeGeometry();
  }, [
    animateEdgeGeometry,
    commitInstances,
    focusContentId,
    layoutInstances,
    nodeWidth,
    panToInstanceTitle,
  ]);

  useEffect(() => {
    if (initialCameraAppliedRef.current || !worldRef.current) {
      return;
    }

    const allNodesMeasured = instances.every(
      (instance) => dimensions[instance.instanceId],
    );
    const settledLayout = layoutInstances(instances);
    if (!allNodesMeasured || !hasSameLayout(instances, settledLayout)) {
      return;
    }

    const focusInstance = [...instances]
      .reverse()
      .find((instance) => instance.nodeId === focusContentId);
    if (!focusInstance || !dimensions[focusInstance.instanceId]) {
      return;
    }

    initialCameraAppliedRef.current = true;
    panToInstanceTitle(focusInstance, {
      duration: reducedMotion ? 0 : 420,
      scale: 1,
      side:
        focusInstance.nodeId === contentGraph.rootId ? "center" : "right",
    });
    animateEdgeGeometry();
  }, [
    animateEdgeGeometry,
    dimensions,
    focusContentId,
    instances,
    layoutInstances,
    panToInstanceTitle,
    reducedMotion,
  ]);

  useEffect(
    () => () => {
      stopCameraAnimation();
      if (edgeFrameRef.current !== null) {
        cancelAnimationFrame(edgeFrameRef.current);
      }
    },
    [stopCameraAnimation],
  );

  return (
    <main className="canvas-shell">
      <div
        aria-label="可缩放的认知画布"
        className="canvas-viewport"
        ref={viewportRef}
        role="region"
      >
        <div className="canvas-world" ref={worldRef}>
          <EdgeLayer edges={edges} />
          <AnimatePresence initial={false}>
            {instances.map((instance) => {
              const expandedAnchorKeys = new Set(
                instances
                  .filter(
                    (candidate) =>
                      candidate.parentInstanceId === instance.instanceId,
                  )
                  .flatMap((candidate) =>
                    candidate.anchorKey ? [candidate.anchorKey] : [],
                  ),
              );

              return (
                <MarkdownNode
                  expandedAnchorKeys={expandedAnchorKeys}
                  instance={instance}
                  isRoot={instance.instanceId === "root"}
                  key={instance.instanceId}
                  node={contentGraph.nodes[instance.nodeId]}
                  nodeWidth={nodeWidth}
                  onActivate={activateGraphLink}
                  onMeasure={measureNode}
                  onRegister={registerNode}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <nav aria-label="站点导航" className="canvas-home-island">
        <a
          className="canvas-home-island__author"
          href="https://minsecrus.github.io/"
        >
          Minsecrus&apos;
        </a>
        <button
          aria-label="回到主 Markdown"
          className="canvas-home-island__blog"
          onClick={returnHome}
          type="button"
        >
          Blog
        </button>
      </nav>

      <CanvasDirectory
        currentNodeId={focusContentId}
        onSelect={selectDirectoryNode}
      />
      <CanvasInfo />

      <CanvasHud
        onCurrent={returnToCurrentNode}
        onFit={() => fitScene()}
        onZoomPreset={zoomTo}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        scale={cameraScale}
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </main>
  );
}
