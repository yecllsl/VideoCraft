"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ALLOWED, renderTemplate } = require("../render-config.js");

const ROOT = path.join(__dirname, "..", "..", "..");
const ORIGINAL = {
  "{{SERVER_URL}}": "http://192.168.88.4:8000",
  "{{TOKEN_ENV}}": "VIDEOCRAFT_MCP_TOKEN",
  "{{SMB_HOST}}": "192.168.100.58",
};

// 重算基线：node -e "const c=require('node:crypto'),f=require('node:fs');process.argv.slice(1).forEach(p=>console.log(p,c.createHash('sha256').update(f.readFileSync(p)).digest('hex')))" <源1> <源2>
// ponytail: 整文件哈希把非闸门正文也一并锁住，改动两个 skill 的任意字节都要显式更新 BASELINE；
// 它同时在 CRLF checkout 上会失败（下面的 LF 断言给出可行动报错）。升级路径：只哈希
// 「审批闸门 / 红线 / 闸门」段落，并在仓库加 `.gitattributes` 固定 `*.md text eol=lf`。
const BASELINE = {
  ".agents/skills/videocraft-edit/SKILL.md": "7a46686bc3185b4a9caedf68b73c1a49561fd5547fd43ce29e6640c8f63c0d47",
  ".agents/skills/videocraft-cut-decision/SKILL.md": "9366ace7df4dce0dbcdc9256dbe5eefc9f1d022d118bdc3e505a910b9628207d",
};
const REQUIRED_TOKENS = {
  ".agents/skills/videocraft-edit/SKILL.md": ["{{SERVER_URL}}", "{{TOKEN_ENV}}", "{{SMB_HOST}}"],
};
const PAIRS = [
  [".agents/skills/videocraft-edit/SKILL.md", "plugin/videocraft/templates/videocraft-edit.SKILL.md.tpl"],
  [".agents/skills/videocraft-cut-decision/SKILL.md", "plugin/videocraft/templates/videocraft-cut-decision.SKILL.md.tpl"],
];

function baselineHash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

assert.deepEqual(ALLOWED, ["{{SERVER_URL}}", "{{TOKEN_ENV}}", "{{SMB_HOST}}"], "可变字段白名单必须恰为 3 个 token");

for (const [src, tpl] of PAIRS) {
  const srcBytes = fs.readFileSync(path.join(ROOT, src));
  const original = srcBytes.toString("utf8");
  const template = fs.readFileSync(path.join(ROOT, tpl), "utf8");
  assert.ok(!original.includes("\r\n"), `${src}: 源文件必须是 LF 行尾；CRLF checkout 会改变基线字节`);
  assert.equal(baselineHash(srcBytes), BASELINE[src], `${src}: 不可变流程基线哈希不匹配，闸门或红线疑似被改动`);

  const required = REQUIRED_TOKENS[src] || [];
  for (const token of required) {
    assert.ok(template.includes(token), `${tpl}: 缺少 ${token}，模板化可能被回退`);
  }
  if (required.length) {
    assert.notEqual(template, original, `${tpl}: 模板不得退化为原文逐字副本`);
  }
  assert.ok(
    Buffer.from(renderTemplate(template, ORIGINAL), "utf8").equals(srcBytes),
    `${src}: 模板以原值渲染后必须与原文逐字一致`
  );
}

console.log("templates: ok");
