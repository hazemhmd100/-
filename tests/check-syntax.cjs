const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "server.cjs",
  "service-worker.js",
  ...fs.readdirSync(path.join(root, "js"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join("js", name))
];

for (const file of files) {
  execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "inherit" });
}

console.log(`Checked ${files.length} JavaScript files.`);
