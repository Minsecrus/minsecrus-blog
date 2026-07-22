import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const clientDirectory = path.join(projectDirectory, "build", "client");
const pagesDirectory = path.join(projectDirectory, "build", "pages");
const configuredBasePath = process.env.BASE_PATH
  ?.trim()
  .replace(/^\/+|\/+$/gu, "");

if (!configuredBasePath) {
  throw new Error("BASE_PATH is required when preparing GitHub Pages output.");
}

const pathSegments = configuredBasePath.split("/");
if (
  pathSegments.some(
    (segment) =>
      !segment || segment === "." || segment === ".." || !/^[a-z0-9._-]+$/iu.test(segment),
  )
) {
  throw new Error(`Unsafe BASE_PATH: ${configuredBasePath}`);
}

const prerenderDirectory = path.join(clientDirectory, ...pathSegments);
await stat(path.join(prerenderDirectory, "index.html"));
const spaFallback = await readFile(path.join(clientDirectory, "index.html"));

await rm(pagesDirectory, { force: true, recursive: true });
await mkdir(pagesDirectory, { recursive: true });
await cp(clientDirectory, pagesDirectory, { recursive: true });
await cp(prerenderDirectory, pagesDirectory, {
  force: true,
  recursive: true,
});
await writeFile(path.join(pagesDirectory, "404.html"), spaFallback);

console.log(`GitHub Pages artifact prepared at ${pagesDirectory}`);
