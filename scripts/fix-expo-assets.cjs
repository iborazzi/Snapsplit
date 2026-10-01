const fs = require("node:fs");
const path = require("node:path");

const replacements = [
  {
    file: path.join(path.dirname(require.resolve("@expo/plist/package.json")), "build/parse.js"),
    before: 'new xmldom_1.DOMParser({ errorHandler() { } }).parseFromString(xml)',
    after: 'new xmldom_1.DOMParser().parseFromString(xml, "application/xml")'
  },
  {
    file: path.join(path.dirname(require.resolve("metro/package.json")), "src/Assets.js"),
    before: 'const getImageSize = require("image-size");',
    after: 'const getImageSize = input => require("image-size").imageSize(typeof input === "string" ? require("fs").readFileSync(input) : input);'
  }
];

const changes = replacements.map(({ file, before, after }) => {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(after)) return { file, source };
  if (source.split(before).length !== 2) {
    throw new Error(`Unexpected dependency source: ${file}`);
  }
  return { file, source: source.replace(before, after) };
});

for (const { file, source } of changes) fs.writeFileSync(file, source);
console.log("XML and image-size compatibility patches applied.");
