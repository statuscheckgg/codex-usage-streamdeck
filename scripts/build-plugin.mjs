import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  entryPoints: [path.join(root, "src", "plugin.mjs")],
  outfile: path.join(root, "com.statuscheck.codex-usage.sdPlugin", "bin", "plugin.js"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
});
