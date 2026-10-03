const fs = require("node:fs");
const file = require.resolve("query-string");
const source = fs.readFileSync(file, "utf8");
const pattern = /require\((['"])decode-uri-component\1\)/g;
const marker = "/* snapsplit-decoder-compat */";
if (source.includes(marker)) {
  console.log("Decoder patch already applied.");
} else {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error("Unexpected query-string decoder import.");
  const updated = source.replace(pattern,
    '(() => { const m = require("decode-uri-component"); return m.default || m; })() ' + marker);
  fs.writeFileSync(file, updated);
  console.log("Decoder compatibility patch applied.");
}
