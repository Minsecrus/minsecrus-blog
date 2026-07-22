import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Minsecrus" },
    {
      name: "description",
      content: "从首页根节点逐步展开的空间化 Markdown 博客。",
    },
  ];
}

export default function Home() {
  return null;
}
