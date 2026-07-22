import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { toString } from "mdast-util-to-string";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type {
  ContentGraph,
  ContentLink,
  ContentLinkKind,
  ContentNode,
} from "../app/content/types";
import type { Heading, Link, Root } from "mdast";

export const contentDirectory = fileURLToPath(
  new URL("../content/", import.meta.url),
);

interface ParsedContent {
  body: string;
  id: string;
  isRoot: boolean;
  relativePath: string;
  summary: string;
  title?: string;
}

async function findMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findMarkdownFiles(absolutePath);
      }
      return entry.isFile() && entry.name.endsWith(".md")
        ? [absolutePath]
        : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

function normaliseId(rawId: unknown, filePath: string): string {
  const fallback = path.basename(filePath, path.extname(filePath));
  const id = String(rawId ?? fallback).trim();

  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) {
    throw new Error(
      `Invalid content id "${id}" in ${filePath}. Use lowercase letters, numbers, and hyphens.`,
    );
  }

  return id;
}

async function parseContentFile(filePath: string): Promise<ParsedContent> {
  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);
  const relativePath = path
    .relative(contentDirectory, filePath)
    .split(path.sep)
    .join("/");

  return {
    body: parsed.content.trim(),
    id: normaliseId(parsed.data.id, relativePath),
    isRoot: relativePath === "home.md" || parsed.data.root === true,
    relativePath,
    summary: String(parsed.data.summary ?? "").trim(),
    title:
      typeof parsed.data.title === "string"
        ? parsed.data.title.trim()
        : undefined,
  };
}

function parseGraphUrl(url: string): {
  kind: ContentLinkKind;
  targetId: string;
} | null {
  const match = /^(concept|article):([a-z0-9][a-z0-9-]*)$/u.exec(url);
  if (!match) {
    return null;
  }

  return {
    kind: match[1] as ContentLinkKind,
    targetId: match[2],
  };
}

async function compileMarkdown(
  content: ParsedContent,
): Promise<{ html: string; links: ContentLink[]; title: string }> {
  const links: ContentLink[] = [];
  let title = content.title;
  let linkIndex = 0;

  const collectContentMetadata = () => (tree: Root) => {
    if (!title) {
      const firstHeading = tree.children.find(
        (child): child is Heading => child.type === "heading",
      );
      if (firstHeading) {
        title = toString(firstHeading).trim();
      }
    }

    visit(tree, "link", (node: Link) => {
      const graphUrl = parseGraphUrl(node.url);
      if (!graphUrl) {
        return;
      }

      const anchorKey = `${content.id}-${linkIndex}`;
      linkIndex += 1;

      links.push({
        anchorKey,
        kind: graphUrl.kind,
        label: toString(node).trim(),
        targetId: graphUrl.targetId,
      });

      node.url =
        graphUrl.kind === "article"
          ? graphUrl.targetId
          : `#${graphUrl.targetId}`;
      node.data = {
        ...node.data,
        hProperties: {
          "aria-expanded":
            graphUrl.kind === "concept" ? "false" : undefined,
          className: [
            "graph-link",
            graphUrl.kind === "concept"
              ? "graph-link--concept"
              : "graph-link--article",
          ],
          "data-anchor-key": anchorKey,
          "data-graph-kind": graphUrl.kind,
          "data-graph-target": graphUrl.targetId,
        },
      };
    });
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(collectContentMetadata)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content.body);

  return {
    html: String(file),
    links,
    title: title || content.id,
  };
}

function validateLinks(nodes: Record<string, ContentNode>): void {
  for (const node of Object.values(nodes)) {
    for (const link of node.links) {
      if (!nodes[link.targetId]) {
        throw new Error(
          `${node.sourcePath} links to missing content node "${link.targetId}".`,
        );
      }
    }
  }
}

function assertAcyclic(nodes: Record<string, ContentNode>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (nodeId: string, trail: string[]) => {
    if (visiting.has(nodeId)) {
      throw new Error(
        `Content expansion cycle detected: ${[...trail, nodeId].join(" -> ")}.`,
      );
    }
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    for (const link of nodes[nodeId].links) {
      walk(link.targetId, [...trail, nodeId]);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of Object.keys(nodes)) {
    walk(nodeId, []);
  }
}

function buildPaths(
  rootId: string,
  nodes: Record<string, ContentNode>,
): Record<string, string[]> {
  const paths: Record<string, string[]> = { [rootId]: [rootId] };
  const queue = [rootId];

  while (queue.length > 0) {
    const sourceId = queue.shift();
    if (!sourceId) {
      break;
    }

    for (const link of nodes[sourceId].links) {
      if (paths[link.targetId]) {
        continue;
      }
      paths[link.targetId] = [...paths[sourceId], link.targetId];
      queue.push(link.targetId);
    }
  }

  const unreachable = Object.keys(nodes).filter((nodeId) => !paths[nodeId]);
  if (unreachable.length > 0) {
    throw new Error(
      `Every content node must be reachable from "${rootId}". Unreachable: ${unreachable.join(", ")}.`,
    );
  }

  return paths;
}

export async function buildContentGraph(): Promise<ContentGraph> {
  const files = await findMarkdownFiles(contentDirectory);
  if (files.length === 0) {
    throw new Error(`No Markdown files found in ${contentDirectory}.`);
  }

  const parsedFiles = await Promise.all(files.map(parseContentFile));
  const roots = parsedFiles.filter((content) => content.isRoot);
  if (roots.length !== 1) {
    throw new Error(
      `Exactly one root Markdown is required. Use content/home.md or declare "root: true". Found ${roots.length}.`,
    );
  }

  const nodes: Record<string, ContentNode> = {};
  for (const content of parsedFiles) {
    if (nodes[content.id]) {
      throw new Error(`Duplicate content id "${content.id}".`);
    }

    const compiled = await compileMarkdown(content);
    nodes[content.id] = {
      html: compiled.html,
      id: content.id,
      links: compiled.links,
      sourcePath: content.relativePath,
      summary: content.summary,
      title: compiled.title,
    };
  }

  validateLinks(nodes);
  assertAcyclic(nodes);

  const rootId = roots[0].id;
  return {
    nodes,
    paths: buildPaths(rootId, nodes),
    rootId,
  };
}

export async function listContentRoutes(): Promise<string[]> {
  const graph = await buildContentGraph();
  return [
    "/",
    ...Object.keys(graph.nodes)
      .filter((nodeId) => nodeId !== graph.rootId)
      .sort((left, right) => left.localeCompare(right))
      .map((nodeId) => `/${nodeId}`),
  ];
}
