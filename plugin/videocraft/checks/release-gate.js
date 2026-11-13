"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ALLOWED, renderTemplate, renderConfig } = require("../render-config.js");

const ROOT = path.join(__dirname, "..", "..", "..");
const PLUGIN = path.join(ROOT, "plugin/videocraft");
const TEMPLATES = path.join(PLUGIN, "templates");

// 退出码约定：0 只表示「本地检查通过」，不代表允许插件发布；发布另需 live tools/list 复核。
const CHECKS = [
  ["q6.test.js", "q6: ok"],
  ["templates.test.js", "templates: ok"],
  ["contract-copy.test.js", "contract-copy: ok"],
  ["load.test.js", "load: ok"],
];

for (const [file, expected] of CHECKS) {
  const out = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
  process.stdout.write(out);
  assert.ok(out.trim().split(/\r?\n/).includes(expected), `${file} 未输出整行 ${expected}`);
}

let stray = 0;
for (const file of fs.readdirSync(TEMPLATES).filter((name) => name.endsWith(".tpl"))) {
  const text = fs.readFileSync(path.join(TEMPLATES, file), "utf8");
  for (const match of text.matchAll(/\{\{[^}]+\}\}/g)) {
    if (!ALLOWED.includes(match[0])) stray += 1;
  }
}
assert.equal(stray, 0, "白名单外 token 计数必须为 0");

const ENV = "VIDEOCRAFT_GATE_DUMMY_TOKEN";
const previous = process.env[ENV];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "videocraft-accept-"));
try {
  process.env[ENV] = "dummy-token-for-gate";
  const values = {
    "{{SERVER_URL}}": "http://192.0.2.1:8000",
    "{{TOKEN_ENV}}": ENV,
    "{{SMB_HOST}}": "192.0.2.2",
  };
  const packaged = renderTemplate(fs.readFileSync(path.join(TEMPLATES, "opencode.json.tpl"), "utf8"), values);
  assert.ok(!/\{env:/i.test(packaged), "随包模板渲染后不得含 {env:...} 占位符");

  const converged = JSON.parse(packaged);
  converged.mcp.servers["videocraft-remote"] = renderConfig(values).mcp["videocraft-remote"];
  const file = path.join(tmp, "opencode.json");
  fs.writeFileSync(file, JSON.stringify(converged, null, 2));

  const onDisk = fs.readFileSync(file, "utf8");
  assert.ok(!/\{env:/i.test(onDisk), "收敛后配置副本不得含 {env:...} 占位符");
  const server = JSON.parse(onDisk).mcp.servers["videocraft-remote"];
  assert.equal(server.oauth, false);
  assert.equal(server.headers.Authorization, "Bearer dummy-token-for-gate");
  assert.equal(server.headers.Host, "192.0.2.1:8000");
} finally {
  if (previous === undefined) delete process.env[ENV];
  else process.env[ENV] = previous;
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (error) {
    console.error(`release-gate: 临时目录清理失败，请手动删除 ${tmp}: ${error.message}`);
  }
}

console.log("release-gate: local checks passed (exit 0 = local only; release NOT approved)");
console.log("plugin-release: requires separate live tools/list verification (this script cannot approve release)");
