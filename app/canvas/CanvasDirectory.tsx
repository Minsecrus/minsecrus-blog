import { useMemo } from "react";
import { contentGraph } from "virtual:minsecrus-content";
import { DirectoryIcon } from "./Icons";

interface CanvasDirectoryProps {
  currentNodeId: string;
  onSelect: (nodeId: string) => void;
}

interface DirectoryEntry {
  children: DirectoryEntry[];
  id: string;
  title: string;
}

function buildDirectoryTree(): DirectoryEntry {
  const childrenByParent = new Map<string, string[]>();

  for (const [nodeId, path] of Object.entries(contentGraph.paths)) {
    if (nodeId === contentGraph.rootId || path.length < 2) {
      continue;
    }
    const parentId = path.at(-2);
    if (!parentId) {
      continue;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(nodeId);
    childrenByParent.set(parentId, children);
  }

  for (const [parentId, children] of childrenByParent) {
    const sourceOrder = new Map(
      contentGraph.nodes[parentId].links.map((link, index) => [
        link.targetId,
        index,
      ]),
    );
    children.sort(
      (left, right) =>
        (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
        left.localeCompare(right),
    );
  }

  const makeEntry = (nodeId: string): DirectoryEntry => ({
    children: (childrenByParent.get(nodeId) ?? []).map(makeEntry),
    id: nodeId,
    title: contentGraph.nodes[nodeId].title,
  });

  return makeEntry(contentGraph.rootId);
}

function DirectoryBranch({
  currentNodeId,
  entry,
  onSelect,
}: {
  currentNodeId: string;
  entry: DirectoryEntry;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <li className="directory-tree__branch">
      <button
        aria-current={entry.id === currentNodeId ? "page" : undefined}
        className="directory-tree__link"
        onClick={() => onSelect(entry.id)}
        type="button"
      >
        {entry.title}
      </button>
      {entry.children.length > 0 && (
        <ul className="directory-tree__children">
          {entry.children.map((child) => (
            <DirectoryBranch
              currentNodeId={currentNodeId}
              entry={child}
              key={child.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CanvasDirectory({
  currentNodeId,
  onSelect,
}: CanvasDirectoryProps) {
  const root = useMemo(buildDirectoryTree, []);

  return (
    <div className="canvas-directory-island">
      <button
        aria-label="显示目录"
        className="canvas-island-button canvas-directory-island__trigger"
        type="button"
      >
        <DirectoryIcon />
      </button>
      <nav aria-label="文章目录" className="canvas-directory-island__panel">
        <ul className="directory-tree">
          <DirectoryBranch
            currentNodeId={currentNodeId}
            entry={root}
            onSelect={onSelect}
          />
        </ul>
      </nav>
    </div>
  );
}
