import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
} from "react-router";

import type { Route } from "./+types/root";
import { CanvasExperience } from "./canvas/CanvasExperience";
import "./app.css";

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    href: `${import.meta.env.BASE_URL}favicon.svg`,
    type: "image/svg+xml",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta
          content="width=device-width, initial-scale=1, viewport-fit=cover"
          name="viewport"
        />
        <meta content="#ffffff" name="theme-color" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <CanvasExperience />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "无法打开这个节点";
  let details = "画布遇到了一个未预期的问题。";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "没有这个节点" : "画布暂时中断";
    details =
      error.status === 404
        ? "这个地址没有对应的 Markdown 内容。"
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="error-canvas">
      <article className="error-node">
        <h1>{message}</h1>
        <p>{details}</p>
        {stack && (
          <pre>
            <code>{stack}</code>
          </pre>
        )}
      </article>
    </main>
  );
}
