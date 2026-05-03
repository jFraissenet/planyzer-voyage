/* eslint-disable */
// One-off migration: replace inline brand-color hex with theme imports.
// After running once, the codebase no longer hardcodes the primary palette
// and the only places to update for a color change are:
//   - global.css (CSS variables)
//   - lib/theme.ts (JS constants)
//
// Skips: global.css, tailwind.config.js, *.md, anything outside .ts/.tsx
// Skips lib/theme.ts itself.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const HEX_TO_KEY = {
  "#6050DC": "primary",
  "#4F3FD1": "primaryDeep",
  "#8B7BEE": "primaryLight",
  "#EEECFC": "primarySoft",
};

const SKIP_FILES = new Set([
  path.join(ROOT, "lib", "theme.ts"),
  path.join(ROOT, "global.css"),
  path.join(ROOT, "tailwind.config.js"),
  path.join(ROOT, "scripts", "migrate_brand_colors.js"),
]);

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".expo",
  "dist",
  "scripts",
  "android",
  "ios",
]);

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) walk(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

function ensureThemeImport(content) {
  if (/from\s+["']@\/lib\/theme["']/.test(content)) return content;
  const importLine = `import { theme } from "@/lib/theme";`;
  // Insert right after the last top-level import statement.
  const importRegex = /^import [\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
  let lastEnd = -1;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd >= 0) {
    return content.slice(0, lastEnd) + "\n" + importLine + content.slice(lastEnd);
  }
  return importLine + "\n" + content;
}

function migrate(file) {
  const original = fs.readFileSync(file, "utf8");
  let content = original;
  for (const [hex, key] of Object.entries(HEX_TO_KEY)) {
    // Match hex inside single or double quotes only (avoid touching comments/markdown).
    const re = new RegExp(`(["'])${hex}\\1`, "gi");
    content = content.replace(re, `theme.${key}`);
  }
  if (content === original) return false;
  content = ensureThemeImport(content);
  fs.writeFileSync(file, content);
  return true;
}

const all = walk(ROOT);
let changed = 0;
for (const f of all) {
  if (SKIP_FILES.has(f)) continue;
  try {
    if (migrate(f)) {
      console.log("✓", path.relative(ROOT, f));
      changed++;
    }
  } catch (err) {
    console.error("✗", path.relative(ROOT, f), err.message);
  }
}
console.log(`\nMigrated ${changed} file(s).`);
