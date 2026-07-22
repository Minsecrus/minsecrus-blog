import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ContentNode } from "../content/types";
import type {
  GraphActivation,
  NodeInstance,
  Size,
} from "./types";

interface MarkdownNodeProps {
  expandedAnchorKeys: Set<string>;
  instance: NodeInstance;
  isRoot: boolean;
  node: ContentNode;
  nodeWidth: number;
  onActivate: (instance: NodeInstance, activation: GraphActivation) => void;
  onMeasure: (instanceId: string, size: Size) => void;
  onRegister: (instanceId: string, element: HTMLElement | null) => void;
}

export function MarkdownNode({
  expandedAnchorKeys,
  instance,
  isRoot,
  node,
  nodeWidth,
  onActivate,
  onMeasure,
  onRegister,
}: MarkdownNodeProps) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    onRegister(instance.instanceId, element);
    if (!element) {
      return;
    }

    const reportSize = () => {
      onMeasure(instance.instanceId, {
        height: element.offsetHeight,
        width: element.offsetWidth,
      });
    };
    reportSize();

    const observer = new ResizeObserver(reportSize);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onRegister(instance.instanceId, null);
    };
  }, [instance.instanceId, onMeasure, onRegister]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const anchors = element.querySelectorAll<HTMLAnchorElement>(
      "a[data-graph-target]",
    );
    for (const anchor of anchors) {
      const anchorKey = anchor.dataset.anchorKey;
      anchor.setAttribute(
        "aria-expanded",
        anchorKey && expandedAnchorKeys.has(anchorKey) ? "true" : "false",
      );
    }
  }, [expandedAnchorKeys]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest<HTMLAnchorElement>("a[data-graph-target]");
    if (!anchor || !elementRef.current?.contains(anchor)) {
      return;
    }

    const anchorKey = anchor.dataset.anchorKey;
    const graphKind = anchor.dataset.graphKind;
    const targetId = anchor.dataset.graphTarget;
    if (
      !anchorKey ||
      !targetId ||
      (graphKind !== "article" && graphKind !== "concept")
    ) {
      return;
    }

    event.preventDefault();
    onActivate(instance, {
      anchorElement: anchor,
      anchorKey,
      kind: graphKind,
      targetId,
    });
  };

  return (
    <motion.article
      animate={{ opacity: 1, scale: 1, x: instance.x, y: instance.y }}
      aria-label={node.title}
      className={[
        "markdown-node",
        isRoot ? "markdown-node--root" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-node-id={node.id}
      exit={{
        opacity: 0,
        scale: 0.965,
        x: instance.origin.x,
        y: instance.origin.y,
      }}
      initial={{
        opacity: isRoot ? 1 : 0,
        scale: isRoot ? 1 : 0.94,
        x: instance.origin.x,
        y: instance.origin.y,
      }}
      onClick={handleClick}
      ref={elementRef}
      style={{ width: nodeWidth }}
      transition={{
        opacity: { duration: 0.28 },
        scale: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
        x: { type: "spring", stiffness: 170, damping: 25 },
        y: { type: "spring", stiffness: 170, damping: 25 },
      }}
    >
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: node.html }}
      />
    </motion.article>
  );
}
