// Bundles the unpacked extension (repo root) into public/undoomed-extension.zip
// so the site's "Download extension" button always serves the current build.
import AdmZip from "adm-zip";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "public");
const outFile = path.join(outDir, "undoomed-extension.zip");

const files = [
  "manifest.json",
  "background.js",
  "content.js",
  "md.js",
  "config.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
];

const zip = new AdmZip();
for (const f of files) zip.addLocalFile(path.join(repoRoot, f));
zip.addLocalFolder(path.join(repoRoot, "icons"), "icons");

fs.mkdirSync(outDir, { recursive: true });
zip.writeZip(outFile);
console.log(`wrote ${outFile} (${zip.getEntries().length} entries)`);
