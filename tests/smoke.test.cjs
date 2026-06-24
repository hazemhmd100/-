const assert = require("assert");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = 5510;
const base = `http://127.0.0.1:${port}`;

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method,
      headers: body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : undefined
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      const res = await request("GET", `${base}/`);
      if (res.status === 200) return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not start");
}

(async () => {
  const child = spawn(process.execPath, ["server.cjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: "ignore"
  });

  try {
    await waitForServer();

    const home = await request("GET", `${base}/`);
    assert.strictEqual(home.status, 200);
    assert(home.body.includes("دفتر المقهى"));

    const traversal = await request("GET", `${base}/%2e%2e/hazem.bat`);
    assert.notStrictEqual(traversal.status, 200);
    assert(!traversal.body.includes("@echo off"));

    const bad = await request("GET", `${base}/%`);
    assert.strictEqual(bad.status, 400);

    const backupPayload = JSON.stringify({ ok: true, createdAt: new Date().toISOString() });
    const backup = await request("POST", `${base}/api/backup`, JSON.stringify({
      fileName: "smoke-test-backup.json",
      payload: backupPayload
    }));
    assert.strictEqual(backup.status, 200);
    assert(JSON.parse(backup.body).ok);
    fs.rmSync(path.join(root, "backups", "smoke-test-backup.json"), { force: true });

    console.log("Smoke tests passed.");
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
