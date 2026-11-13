"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ALLOWED, renderTemplate, renderConfig } = require("../render-config.js");

process.env.VIDEOCRAFT_MCP_TOKEN = "dummy-token-for-test";
const values = {
  "{{SERVER_URL}}": "http://192.0.2.1:8000",
  "{{TOKEN_ENV}}": "VIDEOCRAFT_MCP_TOKEN",
  "{{SMB_HOST}}": "192.0.2.2",
};
const tpl = fs.readFileSync(path.join(__dirname, "..", "templates", "opencode.json.tpl"), "utf8");
const cfg = renderConfig(values);

const parsed = JSON.parse(tpl);
const srv = parsed.mcp.servers["videocraft-remote"];
assert.equal(srv.oauth, false, "随包配置必须保留 oauth: false");
assert.equal(srv.url, "{{SERVER_URL}}/mcp", "MCP 地址必须由白名单 token 表达");
assert.equal(srv.headers.Authorization, "Bearer {{TOKEN_ENV}}", "随包配置不得含令牌字面值");
assert.doesNotMatch(tpl, /\{env:/i, "随包配置不得含 {env:...} 占位符");
assert.doesNotMatch(tpl, /Bearer\s+[A-Za-z0-9+/=._-]{16,}/, "随包配置不得含令牌字面值");
for (const match of tpl.matchAll(/\{\{[^}]+\}\}/g)) {
  assert.ok(ALLOWED.includes(match[0]), `白名单外 token: ${match[0]}`);
}
assert.throws(() => renderTemplate("{{foo}}", values), /illegal template token/, "白名单外 token 必须构建失败");

const remote = cfg.mcp["videocraft-remote"];
assert.equal(remote.oauth, false);
assert.equal(remote.url, "http://192.0.2.1:8000/mcp");
assert.equal(remote.headers.Host, "192.0.2.1:8000");
assert.equal(remote.headers.Authorization, "Bearer dummy-token-for-test");
assert.equal(
  renderConfig({ ...values, "{{SERVER_URL}}": "http://192.0.2.1:8000/" }).mcp["videocraft-remote"].url,
  "http://192.0.2.1:8000/mcp",
  "origin 带尾斜杠时不得产生双斜杠"
);
assert.throws(
  () => renderConfig({ ...values, "{{SERVER_URL}}": "not-a-url" }),
  /invalid \{\{SERVER_URL\}\}/,
  "非法地址必须给出可行动的错误"
);
assert.throws(
  () => renderConfig({ ...values, "{{SERVER_URL}}": "http://192.0.2.1:8000/mcp" }),
  /invalid \{\{SERVER_URL\}\}/,
  "带路径的地址必须 fail-fast，避免拼出 /mcp/mcp"
);

console.log("q6: ok");
