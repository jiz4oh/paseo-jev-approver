import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
function files(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(join(dir,entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir,entry.name)] : []);
}
let failed = false;
for (const file of [...files("client"),"index.client.tsx"]) {
  const src = readFileSync(file,"utf8");
  const result = ts.transpileModule(src, {fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  for (const d of result.diagnostics ?? []) {
    if (d.category === ts.DiagnosticCategory.Error) {
      failed = true;
      console.error(file + ": " + ts.flattenDiagnosticMessageText(d.messageText,"\n"));
    }
  }
}
if (failed) process.exit(1);
console.log("Client TSX syntax validation passed");
