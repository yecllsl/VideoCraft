# 局域网用户一键安装与更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让局域网用户复制一段 PowerShell 命令完成 OpenCode V2 插件安装与配置，以后只跑 `opencode plugin update` 拿到更新。

**Architecture:** 纯文档改动。根目录新增极短 README 作为 GitHub 首页入口；插件随包 README 增加安装块、验证下限与更新说明。`GLOSSARY.md` 词条已在规划期写入，实现期只提交、不修改；插件运行时、CI、包清单均不动。

**Tech Stack:** Windows PowerShell 5.1+、`opencode` CLI v2.3.2、git-source 插件包、本地 Markdown issue tracker。

**Spec:** `.scratch/videocraft-lan-onboarding/00-spec.md`（连同 `GLOSSARY.md`、`docs/adr/0001-auth-architecture.md`、`docs/adr/0003-plugin-git-source-distribution.md` 一并阅读）

## Global Constraints

- MCP origin 固定为 `http://192.168.88.4:8000`；SMB 主机固定为 `192.168.100.58`。
- 三个环境变量名逐字为 `VIDEOCRAFT_MCP_URL` / `VIDEOCRAFT_SMB_HOST` / `VIDEOCRAFT_MCP_TOKEN`。
- git-source 目标串逐字为 `github:yecllsl/VideoCraft#main::path:plugin/videocraft`。
- 安装块必须同时写 `User` 目标与进程目标（`'Process'` 或 `$env:`）；只写 `User` 会让当前进程读不到变量。
- 令牌只在运行时由 `Read-Host -AsSecureString` 掩码录入；随包文档不得出现令牌字面值，也不写 `opencode.json`。
- 不新增脚本文件、不新增 selfcheck、不改 `plugin/videocraft/index.js` / `render-config.js` / `checks/` / `package.json` / 模板 / 契约副本 / CI。
- 实现期不改 `GLOSSARY.md`；规划期新增的「用户安装块」词条须先提交，否则 AC8 会如实失败。
- 只做本地 commit；push 需用户另行批准。

## Glossary Quick Reference

- **用户安装块**：随插件 README 分发、可整块复制的 PowerShell 命令；掩码录令牌、写用户级环境变量、git-source `plugin add`、重启 OpenCode 服务。
- **插件发布**：main 上的源码变更；用户执行 `opencode plugin update` 后才更新本地副本，push 不自动生效。
- **令牌驻留面**：令牌字面值所在的载体集合；一期目标是不扩大它。
- **验收边界**：一期验收在隔离临时目录内运行；本项 AC5 对 HKCU 注册表是显式例外，用备份/恢复保证可逆。

## ADR Constraints

- ADR-0001：一期静态 Bearer；令牌人工发放，不进仓库、命令行或日志。
- ADR-0003：git-source 由用户显式 `opencode plugin update` 更新；不锁完整 commit hash、不做自动更新。
- 本项不新建 ADR（G1 已确认：纯文档、可回滚）。

## Review Focus

以下 5 项按写作时判断自行补测；每项都落到对应任务的 Verification 步骤。其中 #1 已被 spec 的 AC2 升级为硬断言，其余为计划自检。

1. 安装块漏写进程目标：用户机器写 User 后当前进程读不到，插件 fail-fast → Task 3 Step 1 / Step 4 用 AC2 双目标正则断言钉住。
2. 新开终端是否立即看到 User 变量未知（不广播 `WM_SETTINGCHANGE`）→ Task 3 Step 3 写入「重开终端或重新登录」提示，Task 3 Step 4 验证 AC2/AC3。
3. 首次安装后 `plugin list` 滞后一次调用，用户会误判安装失败 → Task 3 Step 3 写入「重启后重试」，Task 4 Step 1 复核 AC6。
4. 合法实现风格被文本断言误伤（类全名/短名、单双引号）→ Task 3 Step 7 用双引号 `"User"` + `[System.Net.NetworkCredential]` + `$env:` 夹具实跑 AC2/AC3。
5. 根 README 变长或混入令牌字面值 → Task 2 Step 3 / Step 4 用 AC1 行数断言与无令牌字面量断言钉住。

## Spec → Task Coverage

| 来源 | 任务 |
|---|---|
| AC1 根 README 入口 | Task 2 |
| AC2 安装块命令齐全 | Task 3 |
| AC3 令牌不落盘/不进命令行 | Task 3 |
| AC4 更新默认与脚注 | Task 4 |
| AC5 User env 往返与恢复 | Task 3 |
| AC6 用户侧验收下限 | Task 3 Step 3（交付）、Task 4 Step 1（复核） |
| AC7 术语防回退 | Task 1、Task 5 |
| AC8 插件运行时与 GLOSSARY 零改动 | Task 1、Task 5 |
| Ticket 01（单个） | Task 1 → Task 2 → Task 3 → Task 4 → Task 5 |
| Test seam S1/S2/S3/S4 | Task 2-4 / Task 3 / Task 1、5 / Task 1、5 |

---

### Task 1: 提交规划期术语（GLOSSARY 基线归零）

**Files:**
- Modify（仅提交，不编辑）: `GLOSSARY.md`（工作区已含规划期新增的「用户安装块」4 行）
- Test: 使用 `.scratch/videocraft-lan-onboarding/00-spec.md` 的 AC7 / AC8 命令，不新建测试文件

**Interfaces:**
- Consumes: 规划期已写入的 GLOSSARY 词条
- Produces: 干净的 `GLOSSARY.md` 基线，使后续 AC8 可运行

- [ ] **Step 1: 运行 AC7 基线检查（应已绿）**

从 `.scratch/videocraft-lan-onboarding/00-spec.md` 复制 AC7 命令块并在仓库根逐字运行。
Expected: `GLOSSARY_OK=1`，exit 0（该词条已在规划期写入，此项是防回退守卫，不应失败）。

- [ ] **Step 2: 运行 AC8 观察当前失败**

从 spec 复制 AC8 命令块逐字运行。
Expected: 打印 ` M GLOSSARY.md`，exit 1（规划期改动尚未提交）。

- [ ] **Step 3: 提交 GLOSSARY 规划期改动**

```powershell
git add GLOSSARY.md docs/superpowers/plans/2026-11-19-lan-onboarding.md
git commit -m "docs: 新增用户安装块术语并提交实施计划"
```

- [ ] **Step 4: 验证 AC8 转为通过**

从 spec 复制 AC8 命令块逐字运行。
Expected: `PLUGIN_RUNTIME_UNCHANGED=1`，exit 0。

---

### Task 2: 根目录极短 README 入口

**Files:**
- Create: `README.md`
- Test: 使用 spec 的 AC1 命令

**Interfaces:**
- Consumes: Task 1 的干净 GLOSSARY 基线
- Produces: GitHub 首页可见的入口文件，指向 `plugin/videocraft/README.md`

- [ ] **Step 1: 运行 AC1 确认失败**

从 spec 复制 AC1 命令块在仓库根运行。
Expected: `ROOT_README_MISSING`，exit 1。

- [ ] **Step 2: 新建 `README.md`**

内容逐字为：

```markdown
# VideoCraft

局域网用户的 OpenCode V2 插件安装与更新说明见 [plugin/videocraft/README.md](plugin/videocraft/README.md)。
```

共 3 行（含空行）；不写令牌、地址、命令或版本号。

- [ ] **Step 3: 运行 AC1 确认通过**

从 spec 复制 AC1 命令块运行。
Expected: `ROOT_README_OK=1 LINES=3`，exit 0。

- [ ] **Step 4: 验证根 README 未混入令牌字面量**

```powershell
if(Select-String -Path README.md -Pattern 'VIDEOCRAFT_MCP_TOKEN','Bearer','sk-' -Quiet){ 'ROOT_TOKEN_LEAK'; exit 1 }; 'ROOT_README_CLEAN=1'
```

Expected: `ROOT_README_CLEAN=1`，exit 0。

- [ ] **Step 5: 提交**

```powershell
git add README.md
git commit -m "docs: 添加仓库根 README 作为插件说明入口"
```

---

### Task 3: 插件 README 安装块与令牌处理

**Files:**
- Modify: `plugin/videocraft/README.md`（在现有「## 安装」段加入安装块和验证句）
- Test: 使用 spec 的 AC2 / AC3 / AC5 命令

**Interfaces:**
- Consumes: Task 2 的根 README 入口；GLOSSARY「用户安装块」定义
- Produces: 可整块复制的安装命令；后续 Task 4 保留其更新段

- [ ] **Step 1: 运行 AC2 / AC3 确认失败**

从 spec 复制 AC2、AC3 命令块分别在仓库根运行。
Expected: AC2 打印 `MISSING=...` 或 `PATTERN_MISSING=...`，exit 1；AC3 打印 `NO_MASKED_INPUT`，exit 1。

- [ ] **Step 2: 用完整安装块替换现有 bash 块**

删除 `plugin/videocraft/README.md` 安装段现有的 bash 代码块（三行：标题 ```` ```bash ````、裸 `opencode plugin add ...`、收尾 ```` ``` ````）。在原位置放入以下 PowerShell 代码块，其后原有的「需 OpenCode V2 2.0.15…」版本说明保留：

````markdown
```powershell
$u='http://192.168.88.4:8000'; $s='192.168.100.58'
$t=[Net.NetworkCredential]::new('',(Read-Host 'VideoCraft 令牌' -AsSecureString)).Password
foreach($p in @(@('VIDEOCRAFT_MCP_URL',$u),@('VIDEOCRAFT_SMB_HOST',$s),@('VIDEOCRAFT_MCP_TOKEN',$t))){
  [Environment]::SetEnvironmentVariable($p[0],$p[1],'User')
  [Environment]::SetEnvironmentVariable($p[0],$p[1],'Process')
}
opencode plugin add 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'
opencode service restart
```
````

- [ ] **Step 3: 添加验证与终端提示句**

紧接新写入的 PowerShell 安装块之后、原有版本要求说明之前，写一句：

```markdown
验证：`opencode plugin list` 应显示 `videocraft` 与 git-source 目标；若首次为空，重启 OpenCode 服务后重试。若新开终端仍报缺变量，重开终端或重新登录。
```

必须包含字面串 `opencode plugin list`、`重启 OpenCode 服务后重试`、`重开终端或重新登录`；不得出现 `selfcheck`。

- [ ] **Step 4: 运行 AC2 / AC3 确认通过**

从 spec 复制 AC2、AC3 命令块运行。
Expected: `INSTALL_BLOCK_OK=1` 与 `TOKEN_HANDLING_OK=1`，均 exit 0。

- [ ] **Step 5: 运行 AC5 验证 User/Process 机制与恢复**

从 spec 复制 AC5 命令块在仓库根运行。
Expected: 两行，第一行为 `ROUNDTRIP_OK=1`，第二行为验收前三个 User env 原值（无原值则三个空段），exit 0。

- [ ] **Step 6: 验证双目标顺序**

```powershell
$t=Get-Content -Raw -Encoding utf8 plugin/videocraft/README.md; $u=[regex]::Match($t,"SetEnvironmentVariable\([^)]*'User'\)").Index; $p=[regex]::Match($t,"SetEnvironmentVariable\([^)]*'Process'\)").Index; $r=$t.IndexOf('opencode service restart'); if($u -lt 0 -or $p -lt 0 -or $r -lt 0 -or -not ($u -lt $r -and $p -lt $r)){ 'TARGET_ORDER_INVALID'; exit 1 }; 'TARGET_ORDER_OK=1'
```

Expected: `TARGET_ORDER_OK=1`，exit 0（防止安装块在 `service restart` 后才写进程变量）。

- [ ] **Step 7: 验证合法实现风格不被 AC2/AC3 误伤**

临时把 README 换成等价但风格不同的实现（双引号 `"User"` + `[System.Net.NetworkCredential]` + `$env:` 写进程目标），在子进程运行 spec 的 AC2 / AC3 命令块，运行完立即恢复原 README。

夹具的安装块关键行（其余断言所需字面串保留）：

```powershell
$t=[System.Net.NetworkCredential]::new("",(Read-Host 'VideoCraft 令牌' -AsSecureString)).Password
[Environment]::SetEnvironmentVariable('VIDEOCRAFT_MCP_URL',$u,"User")
$env:VIDEOCRAFT_MCP_URL=$u
opencode plugin add 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'
opencode service restart
```

Expected: AC2 `INSTALL_BLOCK_OK=1`、AC3 `TOKEN_HANDLING_OK=1`，均 exit 0；恢复后 README 字节数与原文件一致。若失败，修 AC2/AC3 的正则，不改 spec 的断言语义。

- [ ] **Step 8: 安装块本体 stub 干跑（临时变量名）**

从 README 抽出 PowerShell 安装块，做四项替换后用子进程执行：`Read-Host ... -AsSecureString` → `ConvertTo-SecureString 'dummy-token' -AsPlainText -Force`；`opencode` → 写日志的 stub 函数；`VIDEOCRAFT_` → `VC_DRY_`；在块尾追加打印三个临时变量的 `User` / `Process` 值与一次清理（注册表 API 删除 User 值）。脚本以 UTF-8 带 BOM 写到 OS 临时目录，运行后删除脚本与临时变量。

Expected: 三个变量在 `User` 与 `Process` 两目标下均有值；stub 日志顺序为 `plugin add …` 先于 `service restart`；作者本机 `VIDEOCRAFT_MCP_URL` / `VIDEOCRAFT_SMB_HOST` / `VIDEOCRAFT_MCP_TOKEN` 的 User 值全程未被触碰、临时变量已删除。此步把 review-02 C1 的修复从文本断言变成可重复验证。

- [ ] **Step 9: 提交**

```powershell
git add plugin/videocraft/README.md
git commit -m "docs: 插件 README 增加局域网一键安装块"
```

---

### Task 4: 更新说明与用户侧验收下限

**Files:**
- Test only: 使用 spec 的 AC4 / AC6 命令；不修改文件（AC4 现有 README 已绿，AC6 字面串由 Task 3 Step 3 交付）

**Interfaces:**
- Consumes: Task 3 的安装块与验证句
- Produces: 默认裸 `opencode plugin update` 与精确目标串脚注；满足用户侧下限

- [ ] **Step 1: 运行 AC6 验证 Task 3 的交付**

从 spec 复制 AC6 命令块运行。
Expected: `USER_FLOOR_OK=1`，exit 0（字面串在 Task 3 Step 3 已加入；若失败，回到 Task 3 Step 3 补齐，不得改断言）。

- [ ] **Step 2: 核对更新段**

从 spec 复制 AC4 命令块运行。
Expected: `UPDATE_DOC_OK=1`，exit 0（现有 README 已满足，属守卫；不得因已绿而跳过本任务其余步骤）。

- [ ] **Step 3: 确认无 selfcheck 引导**

```powershell
if(Select-String -Path plugin/videocraft/README.md -Pattern 'selfcheck' -Quiet){ 'UNEXPECTED_SELFCHECK'; exit 1 }; 'NO_SELFCHECK_OK=1'
```

Expected: `NO_SELFCHECK_OK=1`，exit 0。

- [ ] **Step 4: 提交（仅在 Step 1/2/3 任一处确有文档改动时）**

```powershell
git add plugin/videocraft/README.md
git commit -m "docs: 明确用户侧验收下限与更新命令"
```

若无改动，跳过此步，不制造空提交。

---

### Task 5: 最终门禁复核

**Files:**
- Test only: AC1–AC8（spec 命令块）
- No new files

**Interfaces:**
- Consumes: Task 1–4 的提交
- Produces: 全部门禁通过、无越界改动的工作树

- [ ] **Step 1: 逐条运行 AC1–AC8**

从 spec 复制 8 个命令块，在仓库根按顺序运行。
Expected: AC1 `ROOT_README_OK=1 LINES=3`；AC2 `INSTALL_BLOCK_OK=1`；AC3 `TOKEN_HANDLING_OK=1`；AC4 `UPDATE_DOC_OK=1`；AC5 `ROUNDTRIP_OK=1` + 原值行；AC6 `USER_FLOOR_OK=1`；AC7 `GLOSSARY_OK=1`；AC8 `PLUGIN_RUNTIME_UNCHANGED=1`；全部 exit 0。

- [ ] **Step 2: 运行 release-gate 确认插件基线未回归**

```powershell
node plugin/videocraft/checks/release-gate.js
```

Expected: 四项 `ok`、`release-gate: local checks passed (exit 0 = local only; release NOT approved)`、`plugin-release: requires separate live tools/list verification (this script cannot approve release)`，exit 0。stderr 可能出现 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告（建议给 package.json 加 `type: module`）；这是既有现象，按 Global Constraints 不改 package.json，不作为失败。

- [ ] **Step 3: 核对提交范围**

```powershell
git --no-pager log --oneline -5
```

Expected: 最近 5 条中可见本计划 Task 1 / Task 2 / Task 3 的提交（Task 4 无文件改动、无提交）；`git status --short` 除既有的未跟踪 PDF 外干净，**不含**本计划文件 `docs/superpowers/plans/2026-11-19-lan-onboarding.md`。若计划文件仍未跟踪，在 Task 1 的提交中一并 `git add` 它（G2 产物应入库），再重跑本步。

- [ ] **Step 4: 在台账记录 G5 证据摘要**

把 AC1–AC8、release-gate、提交哈希与未验证项（git 客户端依赖、新终端变量可见性）写入 `.scratch/videocraft-lan-onboarding/progress.md` 的 G5 证据节；确认该台账与 `00-spec.md` 的评审指针已指向实际存在的 `review-01.md` / `review-02.md`（评审 `review-03.md` 的 M6 已在 plan 生成时修正）；**不**标记 G5 通过，等人签核。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-19-lan-onboarding.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — 每个任务由新 subagent 实现，再由新 reviewer 在下一任务开始前检查；最后整支 review。最彻底，按本项目 `docs/agents/development-workflow.md` 的 G3/G4/G5 门禁执行。
- **Native** — 我在本 session 顺序实现全部任务，最后再做一次整体 review；更快但只有末端独立评审。

本计划推荐 **Subagent-driven**：项目流程已规定 G3/G4/G5，且 AC5 涉及 HKCU 备份/恢复，任务间虽简单但失败信号必须逐个核验。请确认计划是否符合预期，并选择执行方式。
