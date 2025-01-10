#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

async function* findTypeScriptFiles(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const res = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      if (
        !file.name.startsWith(".") &&
        file.name !== "node_modules" &&
        file.name !== "dist"
      ) {
        yield* findTypeScriptFiles(res);
      }
    } else if (file.name.endsWith(".ts") && !file.name.endsWith(".d.ts")) {
      yield res;
    }
  }
}

async function undoImports() {
  for await (const file of findTypeScriptFiles(path.join(rootDir, "src"))) {
    let content = await fs.readFile(file, "utf8");

    // Remove .js from relative imports
    content = content.replace(
      /from\s+['"](\.[^'"]*\.js)['"]/g,
      (match, importPath) => {
        return `from '${importPath.replace(/\.js$/, "")}'`;
      }
    );

    await fs.writeFile(file, content, "utf8");
    console.log(`Removed .js extensions in ${path.relative(rootDir, file)}`);
  }
}

undoImports().catch(console.error);
