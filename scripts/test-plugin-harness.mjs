import { WebSocketServer } from "ws";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "com.statuscheck.codex-usage.sdPlugin");
const plugin = path.join(pluginRoot, "bin", "plugin.js");
const registrationInfo = JSON.stringify({
  application: {
    font: "Arial",
    language: "en",
    platform: "windows",
    platformVersion: "10",
    version: "7.1.0",
  },
  colors: {
    buttonMouseOverBackgroundColor: "#222222",
    buttonPressedBackgroundColor: "#111111",
    buttonPressedBorderColor: "#333333",
    buttonPressedTextColor: "#ffffff",
    highlightColor: "#34e977",
  },
  devicePixelRatio: 1,
  devices: [
    {
      id: "test-device",
      name: "Test Stream Deck",
      size: { columns: 5, rows: 3 },
      type: 0,
    },
  ],
  plugin: {
    uuid: "com.statuscheck.codex-usage",
    version: "0.1.0.0",
  },
});

const scenarios = [
  {
    name: "green dual bars",
    env: { CODEX_USAGE_MOCK_PAYLOAD: path.join(root, "test-fixtures", "green-usage.json") },
    settings: { displayMode: "dual-bars" },
    expect: "data:image/svg+xml",
  },
  {
    name: "mixed dual bars split colors",
    env: { CODEX_USAGE_MOCK_PAYLOAD: path.join(root, "test-fixtures", "mixed-usage.json") },
    settings: { displayMode: "dual-bars", yellowThreshold: 50, redThreshold: 20, criticalThreshold: 10 },
    expectDecoded: "stroke=\"#34e977\"",
    expectDecodedAll: ["fill=\"#f6d84d\"", "fill=\"#34e977\""],
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
    "-info", registrationInfo,
    "-pluginUUID", "com.statuscheck.codex-usage",
    "-registerEvent", "registerPlugin",
  ], {
    cwd: pluginRoot,
    env: { ...process.env, ...scenario.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childStdout = "";
  let childStderr = "";
  child.stdout.on("data", (chunk) => {
    childStdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    childStderr += chunk.toString();
  });

  const timeout = setTimeout(() => {
    child.kill();
    server.close();
  }, 10000);

  try {
    const [socket] = await waitForConnection(server, child, scenario, () => childStdout, () => childStderr);
    await once(socket, "message");
    socket.send(JSON.stringify({
      event: "willAppear",
      action: "com.statuscheck.codex-usage.usage",
      context: "test-context",
      device: "test-device",
      payload: {
        controller: "Keypad",
        coordinates: { column: 0, row: 0 },
        settings: scenario.settings,
      },
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
    for (const expected of scenario.expectDecodedAll || []) {
      if (!decoded.includes(expected)) {
        throw new Error(`${scenario.name}: expected decoded SVG to include ${expected}`);
      }
    }
  } finally {
    clearTimeout(timeout);
    child.kill();
    server.close();
  }
}

function waitForConnection(server, child, scenario, stdout, stderr) {
  return Promise.race([
    once(server, "connection"),
    once(child, "exit").then(([code, signal]) => {
      throw new Error(`${scenario.name}: plugin exited before connecting code=${code} signal=${signal}\nstdout:\n${stdout()}\nstderr:\n${stderr()}`);
    }),
  ]);
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
