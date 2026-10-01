const fs = require("node:fs");
const path = require("node:path");

const root = path.dirname(require.resolve("@expo/cli/package.json"));
const files = ["tar.js", "npm.js"];
const before = '_interopRequireDefault(require("tar"))';
const after = '({ default: require("tar") })';

const changes = files.map(name => {
  const file = path.join(root, "build/src/utils", name);
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(after)) return { file, source };
  if (source.split(before).length !== 2) {
    throw new Error(`Expo tar import changed: ${file}`);
  }
  return { file, source: source.replace(before, after) };
});

for (const { file, source } of changes) {
  fs.writeFileSync(file, source);
}
console.log("Expo tar compatibility patch applied.");
