import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(rootDir, "scripts", "import-zombie-walk-video-sheet.py");

const result = spawnSync("python3", [scriptPath], { encoding: "utf8", cwd: rootDir });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

console.log(result.stdout.trim());
