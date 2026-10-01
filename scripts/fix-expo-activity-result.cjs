const fs = require("node:fs");
const path = require("node:path");

// Backport of Expo PR #41319:
// https://github.com/expo/expo/pull/41319
const root = path.dirname(require.resolve("expo-modules-core/package.json"));
const file = path.join(
  root,
  "android/src/main/java/expo/modules/kotlin/activityresult/AppContextActivityResultLauncher.kt"
);

let source = fs.readFileSync(file, "utf8");
const normalized = source.replace(/\r\n/g, "\n");
const before = [
  "  suspend fun launch(input: I): O = suspendCoroutine { continuation ->",
  "    launch(input) { output -> continuation.resume(output) }",
  "  }"
].join("\n");

const after = [
  "  suspend fun launch(input: I): O = suspendCancellableCoroutine { continuation ->",
  "    launch(input) { output ->",
  "      // Ignore duplicate results after completion or cancellation.",
  "      if (continuation.isActive) {",
  "        continuation.resume(output)",
  "      }",
  "    }",
  "  }"
].join("\n");

if (normalized.includes(after)) {
  console.log("Expo activity result patch already applied.");
} else {
  if (normalized.split(before).length !== 2 ||
      !normalized.includes("import kotlin.coroutines.suspendCoroutine")) {
    throw new Error("Unexpected Expo activity result source; no patch applied.");
  }
  source = normalized
    .replace(before, after)
    .replace(
      "import kotlin.coroutines.suspendCoroutine",
      "import kotlinx.coroutines.suspendCancellableCoroutine"
    );
  fs.writeFileSync(file, source);
  console.log("Expo activity result patch applied.");
}
