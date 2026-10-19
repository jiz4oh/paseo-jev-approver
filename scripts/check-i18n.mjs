import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { exit } from "node:process";

const base = "client/locales";
const en = JSON.parse(readFileSync(join(base,"en.json"),"utf8"));
const localeFiles = readdirSync(base).filter(x => x.endsWith(".json"));
const problems = [];
const enKeys = Object.keys(en);
for (const file of localeFiles) {
  const catalog = JSON.parse(readFileSync(join(base,file),"utf8"));
  const missing = enKeys.filter(k => !(k in catalog));
  const extra = Object.keys(catalog).filter(k => !(k in en));
  const empty = Object.entries(catalog).filter(([,v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
  if (missing.length) problems.push(file + " missing: " + missing.join(", "));
  if (extra.length) problems.push(file + " extra: " + extra.join(", "));
  if (empty.length) problems.push(file + " empty: " + empty.join(", "));
}
function files(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(d => d.isDirectory() ? files(join(dir,d.name)) : /\.tsx?$/.test(d.name) ? [join(dir,d.name)] : []);
}
for (const file of [...files("client"), "index.client.tsx"]) {
  const src = readFileSync(file,"utf8");
  for (const match of src.matchAll(/\bt\(\s*["']([^"']+)["']\s*\)/g)) {
    if (!(match[1] in en)) problems.push(file + " untranslated key: " + match[1]);
  }
  // UI-facing attributes must be translated. Keep explicit identifiers/technical placeholders untouched.
  for (const match of src.matchAll(/\b(?:title|label|actionLabel|accessibilityLabel)\s*=\s*"([^"]+)"/g)) {
    problems.push(file + " hard-coded UI label: " + match[1]);
  }
  for (const match of src.matchAll(/<Text(?:\s[^>]*)?>\s*([A-Za-z][^<{]*?)\s*<\/Text>/g)) {
    problems.push(file + " hard-coded text: " + match[1].trim());
  }
}
if (problems.length) { console.error("i18n validation failed:\n" + problems.join("\n")); exit(1); }
console.log("i18n validation passed: " + localeFiles.join(", "));
