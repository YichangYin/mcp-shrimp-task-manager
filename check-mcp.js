import { spawn } from "child_process";

const env = { ...process.env, DATA_DIR: "D:\\IdeaWorkspace\\project\\shrimp_data", TEMPLATES_USE: "zh", ENABLE_GUI: "false" };
const proc = spawn("node", ["dist\\index.js"], { env, stdio: ["pipe", "pipe", "pipe"] });

proc.stderr.on("data", (d) => process.stderr.write(d));
function send(obj) { proc.stdin.write(JSON.stringify(obj) + "\n"); }

let done = false;
proc.stdout.on("data", (chunk) => {
  if (done) return;
  for (const line of chunk.toString().trim().split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.method === "roots/list") {
        send({ jsonrpc: "2.0", id: msg.id, result: { roots: [] } });
      }
      if (msg.id === 2 && msg.result?.tools) {
        done = true;
        const tools = msg.result.tools;
        console.log(`✅ 共 ${tools.length} 个工具:`);
        tools.forEach((t) => console.log(`  - ${t.name}`));
        proc.kill();
      }
    } catch {}
  }
});

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } });
setTimeout(() => {
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 200);
setTimeout(() => { console.log("❌ 超时"); proc.kill(); }, 5000);
