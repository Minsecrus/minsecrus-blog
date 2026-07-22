export type ContentLinkKind = "article" | "concept";

export interface ContentLink {
  anchorKey: string;
  kind: ContentLinkKind;
  label: string;
  targetId: string;
}

export interface ContentNode {
  html: string;
  id: string;
  links: ContentLink[];
  sourcePath: string;
  summary: string;
  title: string;
}

export interface ContentGraph {
  nodes: Record<string, ContentNode>;
  paths: Record<string, string[]>;
  rootId: string;
}
