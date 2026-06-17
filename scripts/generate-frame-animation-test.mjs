import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(rootDir, "public/game-assets/effects/generated");

await mkdir(outputDir, { recursive: true });

const frameCount = 8;
for (let i = 0; i < frameCount; i += 1) {
  const t = i / (frameCount - 1);
  const core = Math.round(18 + Math.sin(t * Math.PI) * 36);
  const ring = Math.round(24 + t * 54);
  const alpha = (1 - t * 0.76).toFixed(2);
  const burst = Math.round(42 + t * 26);
  const rotate = Math.round(t * 42);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="none"/>
  <g transform="translate(80 80) rotate(${rotate})" opacity="${alpha}">
    <circle r="${ring}" fill="none" stroke="#fff2a8" stroke-width="${Math.max(4, 12 - i)}"/>
    <circle r="${core}" fill="#ffcf38"/>
    <circle r="${Math.round(core * 0.48)}" fill="#ffffff" opacity="0.9"/>
    <path d="M0 -${burst} L8 -18 L0 -28 L-8 -18 Z" fill="#ff7b2d"/>
    <path d="M0 ${burst} L8 18 L0 28 L-8 18 Z" fill="#ff7b2d"/>
    <path d="M-${burst} 0 L-18 8 L-28 0 L-18 -8 Z" fill="#ff7b2d"/>
    <path d="M${burst} 0 L18 8 L28 0 L18 -8 Z" fill="#ff7b2d"/>
    <path d="M-${burst * 0.72} -${burst * 0.72} L-18 -10 L-28 -20 L-10 -18 Z" fill="#9dfff0"/>
    <path d="M${burst * 0.72} ${burst * 0.72} L18 10 L28 20 L10 18 Z" fill="#9dfff0"/>
  </g>
</svg>
`;
  const name = `fx-merge-test-${String(i).padStart(2, "0")}.svg`;
  await writeFile(join(outputDir, name), svg, "utf8");
}

console.log(`已生成 ${frameCount} 帧测试序列帧：${outputDir}`);
