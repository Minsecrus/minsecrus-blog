import type {
  CameraTransform,
  ExpansionDirection,
  Point,
  Rect,
  Size,
} from "./types";

export const HORIZONTAL_GAP = 168;
export const VERTICAL_GAP = 56;

interface NodePlacementInput {
  horizontalMargin: number;
  nodeWidth: number;
  placement: "center" | "right";
  scale: number;
  viewportWidth: number;
}

export function nodeLeftForPlacement({
  horizontalMargin,
  nodeWidth,
  placement,
  scale,
  viewportWidth,
}: NodePlacementInput): number {
  if (placement === "center") {
    return (viewportWidth - nodeWidth * scale) / 2;
  }

  return Math.max(
    24,
    viewportWidth - horizontalMargin - nodeWidth * scale,
  );
}

export function edgePath(
  start: Point,
  end: Point,
  direction: ExpansionDirection,
): string {
  if (direction === "down") {
    const bend = Math.max(64, Math.abs(end.y - start.y) * 0.48);
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`;
  }

  const sign = direction === "right" ? 1 : -1;
  const bend = Math.max(72, Math.abs(end.x - start.x) * 0.46);
  return `M ${start.x} ${start.y} C ${start.x + bend * sign} ${start.y}, ${end.x - bend * sign} ${end.y}, ${end.x} ${end.y}`;
}

export function boundsForRects(rects: Rect[]): Rect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function fitBounds(
  bounds: Rect,
  viewport: Size,
  maxScale = 1,
  padding = 72,
): CameraTransform {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const k = Math.max(
    0.28,
    Math.min(
      maxScale,
      availableWidth / Math.max(bounds.width, 1),
      availableHeight / Math.max(bounds.height, 1),
    ),
  );

  return {
    k,
    x: viewport.width / 2 - (bounds.x + bounds.width / 2) * k,
    y: viewport.height / 2 - (bounds.y + bounds.height / 2) * k,
  };
}

export function panWorldPointToViewport(
  worldPoint: Point,
  viewportPoint: Point,
  current: CameraTransform,
): CameraTransform {
  return {
    k: current.k,
    x: viewportPoint.x - worldPoint.x * current.k,
    y: viewportPoint.y - worldPoint.y * current.k,
  };
}
