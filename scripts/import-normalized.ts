import fs from "node:fs";
import path from "node:path";

import { importNormalized } from "../app/lib/importer";
import type { NormalizedImport } from "../app/lib/types";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: npm run import -- .local/imports/example.json");
  process.exit(1);
}

const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
const payload = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as NormalizedImport;
const result = importNormalized(payload);

console.log(JSON.stringify(result, null, 2));
