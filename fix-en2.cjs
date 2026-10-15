const fs = require('fs');
const path = require('path');
function walk(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}
const rules = [
  ["'../personas/", "'../people/"],
  ['"../personas/', '"../people/'],
  ["'./personas/", "'./people/"],
  ['"./personas/', '"./people/'],
];
let n = 0;
for (const f of walk('packages/db/src', [])) {
  let c = fs.readFileSync(f, 'utf8');
  let c2 = c;
  for (const [a, b] of rules) c2 = c2.split(a).join(b);
  if (c2 !== c) { fs.writeFileSync(f, c2); n++; }
}
console.log('fixed ' + n);
