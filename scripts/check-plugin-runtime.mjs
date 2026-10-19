import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
function walk(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(d => d.isDirectory()? walk(join(dir,d.name)) : /\.tsx?$/.test(d.name)?[join(dir,d.name)]:[]); }
const allowed = new Set(["react","react-native","@getpaseo/plugin/client","@getpaseo/plugin/client/ui"]);
const failures=[];
for(const file of [...walk("client"),"index.client.tsx"]){
 const src=readFileSync(file,"utf8");
 for(const m of src.matchAll(/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)){
  const id=m[1]; if(!id.startsWith(".") && !allowed.has(id))failures.push(file+": unsupported runtime import "+id);
 }
}
if(failures.length){console.error(failures.join("\n"));process.exit(1)}
console.log("Plugin runtime imports use supported host modules or local files");
