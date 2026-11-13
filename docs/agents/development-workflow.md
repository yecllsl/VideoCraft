# 项目开发流程规则

## 总原则

本项目采用双方法论组合开发：

- **规划与治理**：Matt Pocock Skills（项目方向、路线图、迭代规划、spec/票据、领域语言沉淀）
- **迭代执行**：Superpowers（单任务计划、TDD、subagent 派发、review）

核心边界：**Matt 侧产出"决策"，Superpowers 侧执行"步骤"。两者不混用、不跳步。**

命令来源：两套 skills 现均扁平安装在用户级 `~/.codebuddy/skills/` 与 `~/.workbuddy/skills/`，命令名以各 `SKILL.md` frontmatter 的 `name` 为准；合集升级后须重新核对本文件。

---

## 阶段一：规划期（仅 Matt 流程，Superpowers 禁止介入）

1. 需求澄清走 `/grill-with-docs`（领域问题先带 `GLOSSARY.md`）。
2. 方案锁定走 `/to-spec`，spec 必须落到 `.scratch/` 下（本项目 issue tracker 的本地语义见 `docs/agents/issue-tracker.md`），
   **不允许只存在于对话中**。
3. 任务切分走 `/to-tickets`。
4. 架构/技术选型决策必须写成 ADR，存入 `docs/adr/`。
5. 跨迭代的大规划用 `/wayfinder`。
6. **本阶段禁止触发 Superpowers 的 `brainstorming` / `writing-plans`，也禁止 Matt 的 `/implement` 与 `/implement-spec`。**

### Spec 书写要求（为后续交接做准备）

- 验收标准必须写成**可执行断言**（命令 + 期望输出），禁止"handle edge cases"这类模糊表述。
- spec 必须标注测试切入点（test seam）。
- 每条术语更新到 `GLOSSARY.md`。

---

## 阶段二：交接期（契约式转换）

**禁止把 spec 直接丢给执行 agent，必须先经 `writing-plans` 转换。**

1. 在**干净的 session**（不带规划期长对话）中调用 Superpowers 的 `writing-plans`。
2. 输入为三件套：spec 本体 + `GLOSSARY.md` + 相关 ADR。
3. 明确声明：只做 spec → plan 转换，**不进入 `brainstorming`，不质疑、不修改 spec 决策**。
4. plan 保存到 `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`。
5. **人工审查映射表，逐项核对后才能进入执行。**

### 字段映射核对表

| Matt 侧产物 | 必须映射到 Plan 中的 | 核对要点 |
|---|---|---|
| 需求条目 | Context / Scope | 原样保留，不得重新措辞 |
| 每条验收标准 | 至少一个任务的 Verification step | **一条不落**，漏映射即打回 |
| Ticket（含依赖） | Task 序列 | 顺序遵循 blocking edges |
| `GLOSSARY.md` | plan 开头的术语速查块 | 执行 agent 零领域背景 |
| ADR | 任务内的约束条目 | 显式写"遵循 ADR-XXX，不得替换方案" |
| 测试 seam | RED 阶段测试步骤 | 不得由 `writing-plans` 重新设计测试 |

---

## 阶段三：执行期（仅 Superpowers 流程）

1. 执行走 `executing-plans`，严格 RED-GREEN-REFACTOR，测试先于实现（TDD 细节见 `test-driven-development`）。
2. 每任务由独立 subagent 执行（`subagent-driven-development`），任务级 review + 整支 review。
3. critical 问题阻塞进入下一任务，不得跳过。
4. Git worktree 隔离（`using-git-worktrees`），不污染主干。

### 执行期禁止事项

- **不得回改 spec/plan 打补丁。** 发现 spec 有问题时：停下当前任务 →
  回阶段一修改 spec/ADR → 重新走阶段二交接 → 再执行。
- 不得让执行 agent 对已定 ADR 做任何"改进"。
- 禁止走 Matt 的 `/implement-spec` 直接从 spec/ticket 跳到实现，它会绕过阶段二交接。
- review 只用 Superpowers 的 review 流程（`requesting-code-review` / `receiving-code-review`），
  **不混用 Matt 的 `/code-review`**（除非单独立项决定替换，两者不得同时生效）。

---

## 优先级声明（给所有 agent）

1. 用户显式指令 > 本规则文件
2. 规划期内：Matt Skills 优先，Superpowers 的自动触发技能（`brainstorming`、
   `writing-plans`）一律绕过。
3. 执行期内：Superpowers 流程优先，禁止中途切回 Matt 的 `/implement` / `/implement-spec`。
4. `GLOSSARY.md` 与 ADR 永远是领域语言和架构决策的唯一事实源。

---

## 违规的典型症状（自查）

- spec 只存在于对话里 → 交接时信息丢失
- 执行 agent 大量自主选型 → 没带 ADR 或没写约束条目
- 测试全绿但验收标准对不上 → 映射表核对被跳过
- plan 中出现 spec 没有的决策 → `writing-plans` 越权改了方案
