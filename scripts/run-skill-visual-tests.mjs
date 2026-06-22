import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outDir = ".tmp/skill-visual-tests";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} 退出码 ${code}`)));
  });
}

await rm(outDir, { recursive: true, force: true });
await run("npx", [
  "tsc", "--ignoreConfig", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
  "--lib", "ES2022,DOM", "--skipLibCheck", "--strict", "--outDir", outDir,
  "tests/skill-visual-rules.test.ts", "src/scenes/skillVisualRules.ts", "src/types.ts",
]);
await run("node", [`${outDir}/tests/skill-visual-rules.test.js`]);
await run("node", ["tests/skill-visual-config.test.mjs"]);
