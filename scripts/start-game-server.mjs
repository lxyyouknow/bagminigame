import { createServer } from "vite";
import os from "node:os";

const PORT = Number(process.env.PORT || 5173);

function localIps() {
  const result = [];
  for (const netList of Object.values(os.networkInterfaces())) {
    for (const net of netList || []) {
      if (net.family === "IPv4" && !net.internal) {
        result.push(net.address);
      }
    }
  }
  return result;
}

const server = await createServer({
  server: {
    host: "0.0.0.0",
    port: PORT,
  },
});

await server.listen();

const address = server.resolvedUrls?.local?.[0] || `http://localhost:${PORT}/`;
const gamePath = "game.html";

console.log("");
console.log("背包小游戏 Demo 已启动");
console.log("");
console.log(`电脑访问: ${address}${gamePath}`);
for (const ip of localIps()) {
  console.log(`手机访问: http://${ip}:${PORT}/${gamePath}`);
}
console.log("");
console.log("手机测试要求: 手机和电脑连接同一个 Wi-Fi。");
console.log("关闭服务器: 在这个窗口按 Ctrl + C。");
console.log("");

