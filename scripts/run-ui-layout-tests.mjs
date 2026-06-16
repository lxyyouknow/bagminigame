import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outDir = ".tmp/ui-layout-tests";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} 退出码 ${code}`));
    });
  });
}

await rm(outDir, { recursive: true, force: true });
await run("npx", [
  "tsc",
  "--ignoreConfig",
  "--target",
  "ES2022",
  "--module",
  "NodeNext",
  "--moduleResolution",
  "NodeNext",
  "--lib",
  "ES2022,DOM",
  "--skipLibCheck",
  "--strict",
  "--outDir",
  outDir,
  "tests/ui-layout.test.ts",
  "src/ui/layout/UiLayout.ts",
]);
await run("node", [`${outDir}/tests/ui-layout.test.js`]);
