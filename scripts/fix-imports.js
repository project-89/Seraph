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

async function fixImports() {
  for await (const file of findTypeScriptFiles(path.join(rootDir, "src"))) {
    let content = await fs.readFile(file, "utf8");

    // Fix relative imports
    content = content.replace(
      /from\s+['"](\.[^'"]*)['"]/g,
      (match, importPath) => {
        if (!importPath.endsWith(".js")) {
          return `from '${importPath}.js'`;
        }
        return match;
      }
    );

    await fs.writeFile(file, content, "utf8");
    console.log(`Fixed imports in ${path.relative(rootDir, file)}`);
  }
}

fixImports().catch(console.error);
