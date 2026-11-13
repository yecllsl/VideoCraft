# OpenCode V2 插件一期 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在客户端仓库生成可分发给目标用户的零依赖 OpenCode V2 插件一期产物，并通过发布闸门。

**Architecture:** 纯函数生成 MCP 配置 → 零依赖 shim 注册三个 transform → 模板副本 + 随包副本 + 查阅别名 → 隔离临时目录验收。服务端两个 checkout 不改。

**Tech Stack:** Node 内置 `node:assert` / `node:fs`（无依赖）、PowerShell、Git。

---

执行约定：

- 所有 `git commit` 步骤执行前需用户明确批准。
- 不建 worktree：客户端仓库无代码，隔离靠**验收边界**的临时目录与服务端 dev/test 命名空间。
- 实施结论（2026-11-13）：三个 transform 已由 OpenCode v2.2.7 运行时探针实证，映射见 `GLOSSARY.md` 的 **插件钩子映射**（`ctx.mcp.transform` / `ctx.skill.transform` / `ctx.reference.transform`）。下文 Task 5 探针草稿里的 `config` / `options` 是实施前假设，已作废；勿照抄，以 `plugin/videocraft/index.js` 与 `GLOSSARY.md` 为准。

### Task 1: 清理悬空引用

**Files:**
- Modify: `AGENTS.md:43`、`docs/adr/0001-auth-architecture.md:5,27`、`docs/agents/plugin-distribution.md:5`、`.scratch/videocraft-plugin-distribution/03-plugin-client-hardening.md:4`、`04-token-lifecycle.md:4`、`05-compat-and-release-verification.md:4`、`06-token-log-exposure.md:5,99`、`progress.md:22,24,30,35`

**Step 1: 枚举**

```powershell
Select-String -Path 'AGENTS.md','docs\adr\*.md','docs\agents\*.md','.scratch\videocraft-plugin-distribution\*.md' -Pattern '2026-11-11-opencode|2026-11-12-opencode|11-11 spec|spec 第|spec §' | Select-Object Path,LineNumber
```

Expected: 当前约 13 行命中。

**Step 2: 逐处改写**

- 指向已删 spec 路径的子句 → 改指 `docs/adr/0001-auth-architecture.md`（决策）或 `docs/agents/plugin-distribution.md`（发布清单）。
- 指向已删 plan 路径的子句 → 改指 `.scratch/videocraft-plugin-distribution/progress.md`。
- `11-11 spec §X` / `spec 第 N 节` 这类章节号引用 → 整句删除；若承载仍需保留的事实，把事实写进 ADR-0001 或 `progress.md` 的现有段落。
- 不在 `AGENTS.md`、台账、工作项里写入任何新 spec / plan 路径。

**Step 3: 验证**

```powershell
(Select-String -Path 'AGENTS.md','docs\adr\*.md','docs\agents\*.md','.scratch\videocraft-plugin-distribution\*.md' -Pattern '2026-11-11-opencode|2026-11-12-opencode|11-11 spec|spec 第|spec §').Count
```

Expected: `0`。

### Task 2: Q6 红测与配置生成纯函数（TDD 红→绿）

**Files:**
- Create: `plugin/videocraft/checks/q6.test.js`
- Create: `plugin/videocraft/render-config.js`
- Create: `plugin/videocraft/templates/opencode.json.tpl`

**Step 1: 写红测**

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderConfig } = require("../render-config.js");

process.env.VIDEOCRAFT_MCP_TOKEN = "dummy-token-for-test";
const values = {
  "{{SERVER_URL}}": "http://192.0.2.1:8000",
  "{{TOKEN_ENV}}": "VIDEOCRAFT_MCP_TOKEN",
  "{{SMB_HOST}}": "192.0.2.2",
};
const cfg = renderConfig(values);
const tpl = fs.readFileSync(path.join(__dirname, "..", "templates", "opencode.json.tpl"), "utf8");

assert.doesNotMatch(tpl, /\{env:/, "随包配置不得含 {env:...} 占位符");
assert.doesNotMatch(tpl, /Bearer\s+[A-Za-z0-9._-]{16,}/, "随包配置不得含令牌字面值");
assert.equal(cfg.mcp["videocraft-remote"].oauth, false);
assert.match(cfg.mcp["videocraft-remote"].headers.Authorization, /^Bearer dummy-token-for-test$/);
console.log("q6: ok");
```

**Step 2: 跑出红**

Run: `node plugin/videocraft/checks/q6.test.js`
Expected: FAIL，`Cannot find module '../render-config.js'`。

**Step 3: 写模板与实现**

`plugin/videocraft/templates/opencode.json.tpl`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "videocraft-remote": {
        "type": "remote",
        "url": "{{SERVER_URL}}/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {{TOKEN_ENV}}"
        }
      }
    }
  }
}
```

`plugin/videocraft/render-config.js`:

```js
"use strict";

const ALLOWED = ["{{SERVER_URL}}", "{{TOKEN_ENV}}", "{{SMB_HOST}}"];
const TOKEN_RE = /\{\{[A-Z_]+\}\}/g;

function renderTemplate(text, values) {
  for (const match of text.matchAll(TOKEN_RE)) {
    if (!ALLOWED.includes(match[0])) throw new Error(`illegal template token: ${match[0]}`);
  }
  return text.replace(TOKEN_RE, (token) => {
    if (!(token in values)) throw new Error(`missing template value: ${token}`);
    return values[token];
  });
}

function renderConfig(values) {
  const origin = values["{{SERVER_URL}}"];
  const envName = values["{{TOKEN_ENV}}"];
  if (!origin) throw new Error("missing template value: {{SERVER_URL}}");
  if (!envName) throw new Error("missing template value: {{TOKEN_ENV}}");
  const token = process.env[envName];
  if (!token) throw new Error(`missing token env: ${envName}`);
  return {
    mcp: {
      "videocraft-remote": {
        type: "remote",
        url: `${origin}/mcp`,
        oauth: false,
        headers: {
          Authorization: `Bearer ${token}`,
          Host: new URL(`${origin}/mcp`).host,
        },
      },
    },
  };
}

module.exports = { ALLOWED, renderTemplate, renderConfig };
```

**Step 4: 跑出绿**

Run: `node plugin/videocraft/checks/q6.test.js`
Expected: `q6: ok`，exit 0。

**Step 5: 提交**（需批准）

```powershell
git add plugin/videocraft/checks/q6.test.js plugin/videocraft/render-config.js plugin/videocraft/templates/opencode.json.tpl
git commit -m "feat(plugin): Q6 red test and config renderer"
```

### Task 3: 模板白名单与不可变流程基线

**Files:**
- Create: `plugin/videocraft/checks/templates.test.js`
- Create: `plugin/videocraft/templates/videocraft-edit.SKILL.md.tpl`
- Create: `plugin/videocraft/templates/videocraft-cut-decision.SKILL.md.tpl`
- Read: `.agents/skills/videocraft-edit/SKILL.md`、`.agents/skills/videocraft-cut-decision/SKILL.md`

**Step 1: 生成模板副本**

复制两个 skill 原文到对应 `.tpl`，只把其中的 MCP 地址、令牌环境变量名、SMB 主机名替换成 `{{SERVER_URL}}` / `{{TOKEN_ENV}}` / `{{SMB_HOST}}`；其余字节不动。

**Step 2: 写检查**

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { ALLOWED, renderTemplate } = require("../render-config.js");

const pairs = [
  [".agents/skills/videocraft-edit/SKILL.md", "plugin/videocraft/templates/videocraft-edit.SKILL.md.tpl"],
  [".agents/skills/videocraft-cut-decision/SKILL.md", "plugin/videocraft/templates/videocraft-cut-decision.SKILL.md.tpl"],
];
const values = { "{{SERVER_URL}}": "http://192.0.2.1:8000", "{{TOKEN_ENV}}": "VIDEOCRAFT_MCP_TOKEN", "{{SMB_HOST}}": "192.0.2.2" };

for (const [src, tpl] of pairs) {
  const original = fs.readFileSync(src, "utf8");
  const template = fs.readFileSync(tpl, "utf8");
  assert.equal(renderTemplate(template, values), original, `${src}: 模板还原后必须与原文逐字一致`);
  for (const match of template.matchAll(/\{\{[A-Z_]+\}\}/g)) {
    assert.ok(ALLOWED.includes(match[0]), `${tpl}: 白名单外 token ${match[0]}`);
  }
}
assert.throws(
  () => renderTemplate("{{ILLEGAL}}", values),
  /illegal template token/,
  "白名单外 token 必须构建失败"
);
console.log("templates: ok");
```

**Step 3: 跑出绿**

Run: `node plugin/videocraft/checks/templates.test.js`
Expected: `templates: ok`。若还原后不一致，说明改动碰到了**不可变流程基线**，恢复模板而非放宽断言。

**Step 4: 提交**（需批准）

```powershell
git add plugin/videocraft/checks/templates.test.js plugin/videocraft/templates
git commit -m "feat(plugin): whitelist templating and immutable baseline check"
```

### Task 4: 随包副本与逐字比对

**Files:**
- Create: `plugin/videocraft/docs/editing-mcp-capability-matrix.md`
- Create: `plugin/videocraft/checks/contract-copy.test.js`

**Step 1: 生成随包副本**

```powershell
Copy-Item 'docs\agents\editing-mcp-capability-matrix.md' 'plugin\videocraft\docs\editing-mcp-capability-matrix.md'
```

**Step 2: 写检查**

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync("docs/agents/editing-mcp-capability-matrix.md");
const copy = fs.readFileSync("plugin/videocraft/docs/editing-mcp-capability-matrix.md");
assert.ok(src.equals(copy), "随包副本必须与契约编辑源逐字一致");
console.log("contract-copy: ok");
```

**Step 3: 跑出绿**

Run: `node plugin/videocraft/checks/contract-copy.test.js`
Expected: `contract-copy: ok`。

**Step 4: 提交**（需批准）

```powershell
git add plugin/videocraft/docs plugin/videocraft/checks/contract-copy.test.js
git commit -m "feat(plugin): ship verbatim contract copy with byte comparison"
```

### Task 5: 插件入口、三个 transform 与加载自检

**Files:**
- Create: `plugin/videocraft/probe.js`
- Create: `plugin/videocraft/index.js`
- Create: `plugin/videocraft/checks/load.test.js`

> 实施前草稿，已由 2026-11-13 实证结果取代：插件定义是 `export default { id, setup }`，三个钩子为 `ctx.mcp.transform` / `ctx.skill.transform` / `ctx.reference.transform`（见 `GLOSSARY.md` 的 **插件钩子映射**）。以下 `config` / `options` 写法勿照抄。

**Step 1: 写探针（throwaway，答案记入 `progress.md` 后删除）**

```js
"use strict";
module.exports = function probe(ctx) {
  console.log(JSON.stringify({
    ctxKeys: Object.keys(ctx || {}),
    mcp: typeof ctx?.mcp?.transform,
    skill: typeof ctx?.skill?.transform,
    reference: typeof ctx?.reference?.transform,
  }));
};
```

**Step 2: 在隔离临时目录用真实 OpenCode 加载探针，记录三个 transform 的实际挂载点**

Run: 由执行者按本机 OpenCode 的插件加载方式运行，输出写入 `.scratch/videocraft-plugin-distribution/progress.md` 的「插件钩子探针」段。
Expected: 三项均为 `function`。若不是 → **STOP**，上报后按探针结论改写 Task 5 剩余步骤，不改断言迁就实现。

**Step 3: 按探针结论写 `index.js`**

零依赖 shim：默认导出 `{ id, setup }` 定义对象，在 `setup(ctx)` 中注册配置注入（`ctx.mcp.transform` 调用 `draft.set`）、两个 skill（`ctx.skill.transform` 调用 `draft.add`）、**查阅别名** `videocraft-contract`（`ctx.reference.transform` 调用两参数 `draft.add(别名, source)`，带 `description`，指向 `plugin/videocraft/docs/editing-mcp-capability-matrix.md`）。全部可失败工作预计算完成后再注册。

**Step 4: 写加载自检并跑绿**

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
for (const f of ["index.js", "render-config.js", "templates/opencode.json.tpl", "docs/editing-mcp-capability-matrix.md"]) {
  assert.ok(fs.existsSync(`plugin/videocraft/${f}`), `missing ${f}`);
}
const plugin = require("../index.js");
assert.equal(typeof plugin, "function", "插件入口必须导出注册函数");
console.log("load: ok");
```

Run: `node plugin/videocraft/checks/load.test.js`
Expected: `load: ok`。

**Step 5: 删除 `probe.js`，提交**（需批准）

```powershell
Remove-Item 'plugin\videocraft\probe.js'
git add plugin/videocraft
git commit -m "feat(plugin): zero-dependency shim with three transforms"
```

### Task 6: 隔离验收与发布闸门

**Files:**
- Create: `plugin/videocraft/checks/release-gate.js`
- Create（临时）: 系统临时目录下的收敛后配置副本，验收后删除

**Step 1: 生成收敛后配置副本**

在临时目录里用 `renderTemplate` 渲染 `opencode.json.tpl`，得到带令牌字面值的**验收用**配置副本；设置临时目录权限仅当前用户可读，验收结束即删除。该副本不进包、不进仓库、不进日志。

**Step 2: 写发布闸门**

```js
"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const checks = ["q6.test.js", "templates.test.js", "contract-copy.test.js", "load.test.js"];
for (const check of checks) {
  const out = execFileSync(process.execPath, [`plugin/videocraft/checks/${check}`], { encoding: "utf8" });
  process.stdout.write(out);
}
const src = fs.readFileSync("docs/agents/editing-mcp-capability-matrix.md", "utf8");
const stray = [...src.matchAll(/\{\{(?!SERVER_URL|TOKEN_ENV|SMB_HOST)[A-Z_]+\}\}/g)];
if (stray.length) throw new Error(`白名单外 token: ${stray.length}`);
console.log("release-gate: ok");
```

**Step 3: 跑闸门**

Run: `node plugin/videocraft/checks/release-gate.js`
Expected: 四行 `*: ok` + `release-gate: ok`，exit 0。任一失败即阻塞**插件发布**，不引用上轮结论。

**Step 4: 复核契约上线**

在测试环境跑 `tools/list`，实测 11 个工具；`accept-remote` 12/12 沿用既有 live 证据，本轮不重复跑。若工具数不是 11 → 阻塞发布。

**Step 5: 删除临时副本，提交**（需批准）

```powershell
git add plugin/videocraft/checks/release-gate.js
git commit -m "feat(plugin): isolated acceptance and release gate"
```

**Step 6: 停止点**

作者本机 `opencode.json` / `.agents/skills/` 切换、main push、P1 人工项处理均不在本计划；分别需要用户单独批准。
