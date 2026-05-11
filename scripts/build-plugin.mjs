import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "com.statuscheck.codex-usage.sdPlugin", "manifest.json");
const usagePath = path.join(root, "com.statuscheck.codex-usage.sdPlugin", "ui", "usage.html");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const usageHtml = fs.readFileSync(usagePath, "utf8");
const syncedUsageHtml = usageHtml.replace(
  /Codex Usage Monitor <code>v[\d.]+<\/code>/,
  `Codex Usage Monitor <code>v${manifest.Version}</code>`,
);

if (syncedUsageHtml !== usageHtml) {
  fs.writeFileSync(usagePath, syncedUsageHtml);
}

await esbuild.build({
  entryPoints: [path.join(root, "src", "plugin.mjs")],
  outfile: path.join(root, "com.statuscheck.codex-usage.sdPlugin", "bin", "plugin.js"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
});
