export type ExpansionDirection = "down" | "left" | "right";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  height: number;
  width: number;
}

export interface Rect extends Point, Size {}

export interface CameraTransform {
  k: number;
  x: number;
  y: number;
}

export interface NodeInstance extends Point {
  anchorKey?: string;
  depth: number;
  direction?: ExpansionDirection;
  instanceId: string;
  nodeId: string;
  origin: Point;
  parentInstanceId?: string;
}

export interface EdgeGeometry {
  childInstanceId: string;
  direction: ExpansionDirection;
  end: Point;
  id: string;
  path: string;
  start: Point;
}

export interface GraphActivation {
  anchorElement: HTMLAnchorElement;
  anchorKey: string;
  kind: "article" | "concept";
  targetId: string;
}
