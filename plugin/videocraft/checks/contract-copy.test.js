"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 漂移时再生成：Copy-Item 'docs\agents\editing-mcp-capability-matrix.md' 'plugin\videocraft\docs\editing-mcp-capability-matrix.md'
const ROOT = path.join(__dirname, "..", "..", "..");
const src = fs.readFileSync(path.join(ROOT, "docs/agents/editing-mcp-capability-matrix.md"));
const copy = fs.readFileSync(path.join(ROOT, "plugin/videocraft/docs/editing-mcp-capability-matrix.md"));

assert.ok(src.length > 0, "契约编辑源不得为空，避免逐字比对空跑");
assert.ok(src.equals(copy), "随包副本必须与契约编辑源逐字一致");

console.log("contract-copy: ok");
