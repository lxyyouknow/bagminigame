import { createServer } from "vite";
import os from "node:os";
import { spawn } from "node:child_process";

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

const serverAddress = server.httpServer?.address();
const actualPort = typeof serverAddress === "object" && serverAddress ? serverAddress.port : PORT;
const address = `http://localhost:${actualPort}/`;
const gamePath = "game.html";
const gameUrl = `${address}${gamePath}`;

function openBrowser(url) {
  if (process.env.OPEN_GAME === "0") return;
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

console.log("");
console.log("背包小游戏 Demo 已启动");
console.log("");
console.log(`电脑访问: ${gameUrl}`);
for (const ip of localIps()) {
  console.log(`手机访问: http://${ip}:${actualPort}/${gamePath}`);
}
console.log("");
console.log("手机测试要求: 手机和电脑连接同一个 Wi-Fi。");
console.log("关闭服务器: 在这个窗口按 Ctrl + C。");
console.log("");

openBrowser(gameUrl);
