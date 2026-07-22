import { contentGraph } from "virtual:minsecrus-content";
import type { Route } from "./+types/focus";

export function meta({ params }: Route.MetaArgs) {
  const node = params.nodeId ? contentGraph.nodes[params.nodeId] : undefined;
  if (!node) {
    return [{ title: "节点不存在 · Minsecrus" }];
  }

  return [
    { title: `${node.title} · Minsecrus` },
    {
      name: "description",
      content: node.summary || `在认知画布中阅读${node.title}。`,
    },
  ];
}

export default function FocusRoute() {
  return null;
}
