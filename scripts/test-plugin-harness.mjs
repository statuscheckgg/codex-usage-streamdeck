import { WebSocketServer } from "ws";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "com.statuscheck.codex-usage.sdPlugin", "bin", "plugin.js");

const scenarios = [
  {
    name: "green dual bars",
    env: { CODEX_USAGE_MOCK_PAYLOAD: path.join(root, "test-fixtures", "green-usage.json") },
    settings: { displayMode: "dual-bars" },
    expect: "data:image/svg+xml",
  },
  {
    name: "critical warning tile",
    env: { CODEX_USAGE_MOCK_PAYLOAD: path.join(root, "test-fixtures", "critical-usage.json") },
    settings: { displayMode: "warning-tile", redThreshold: 20, criticalThreshold: 10 },
    expectDecoded: "8%",
  },
  {
    name: "missing login",
    env: { CODEX_USAGE_MOCK_ERROR: "LOGIN" },
    settings: {},
    expectDecoded: "LOGIN",
  },
  {
    name: "auth expired",
    env: { CODEX_USAGE_MOCK_ERROR: "AUTH" },
    settings: {},
    expectDecoded: "EXPIRED",
  },
  {
    name: "endpoint changed",
    env: { CODEX_USAGE_MOCK_ERROR: "ENDPOINT" },
    settings: {},
    expectDecoded: "CHANGED",
  },
];

for (const scenario of scenarios) {
  await runScenario(scenario);
}

console.log(`ok ${scenarios.length} scenarios`);

async function runScenario(scenario) {
  const port = await freePort();
  const server = new WebSocketServer({ port });
  const child = spawn(process.execPath, [
    plugin,
    "-port", String(port),
    "-pluginUUID", "com.statuscheck.codex-usage",
    "-registerEvent", "registerPlugin",
  ], {
    cwd: root,
    env: { ...process.env, ...scenario.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const timeout = setTimeout(() => {
    child.kill();
    server.close();
  }, 10000);

  try {
    const [socket] = await once(server, "connection");
    await once(socket, "message");
    socket.send(JSON.stringify({
      event: "willAppear",
      action: "com.statuscheck.codex-usage.usage",
      context: "test-context",
      payload: { settings: scenario.settings },
    }));

    const imageMessage = await waitFor(socket, (message) => message.event === "setImage");
    const image = imageMessage.payload?.image || "";
    const decoded = decodeURIComponent(image.replace(/^data:image\/svg\+xml,/, ""));

    if (scenario.expect && !image.startsWith(scenario.expect)) {
      throw new Error(`${scenario.name}: expected image prefix ${scenario.expect}`);
    }
    if (scenario.expectDecoded && !decoded.includes(scenario.expectDecoded)) {
      throw new Error(`${scenario.name}: expected decoded SVG to include ${scenario.expectDecoded}`);
    }
  } finally {
    clearTimeout(timeout);
    child.kill();
    server.close();
  }
}

function waitFor(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for plugin message"));
    }, 5000);

    function onMessage(data) {
      const message = JSON.parse(String(data));
      if (predicate(message)) {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(message);
      }
    }

    socket.on("message", onMessage);
  });
}

async function freePort() {
  const server = new WebSocketServer({ port: 0 });
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
