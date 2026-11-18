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

**出口门禁：G1（见「评审门禁」）。**

---

## 阶段二：交接期（契约式转换）

**禁止把 spec 直接丢给执行 agent，必须先经 `writing-plans` 转换。**

1. 在**干净的 session**（不带规划期长对话）中调用 Superpowers 的 `writing-plans`。
2. 输入为三件套：spec 本体 + `GLOSSARY.md` + 相关 ADR。
3. 明确声明：只做 spec → plan 转换，**不进入 `brainstorming`，不质疑、不修改 spec 决策**。
4. plan 保存到 `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`。
5. **出口门禁 G2**：人工签核字段映射核对表（见「评审门禁」），通过后才能进入执行。

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

1. 执行走 `executing-plans`，严格 RED-GREEN-REFACTOR，测试先于实现（TDD 细节见 `test-driven-development`）。执行期门禁依次为 G3 → G4 → G5（见「评审门禁」）。
2. 每任务由独立 subagent 执行（`subagent-driven-development`）；任务级评审走 G4、整支评审走 G5。
3. G4 判为 critical 的问题阻塞进入下一任务，不得跳过。
4. Git worktree 隔离（`using-git-worktrees`），不污染主干。

### 执行期禁止事项

- **不得回改 spec/plan 打补丁。** 发现 spec 有问题时：停下当前任务 →
  回阶段一修改 spec/ADR → 重新走阶段二交接 → 再执行。
- 不得让执行 agent 对已定 ADR 做任何"改进"。
- 禁止走 Matt 的 `/implement-spec` 直接从 spec/ticket 跳到实现，它会绕过阶段二交接。
- review 只用 Superpowers 的 review 体系：由 `subagent-driven-development` 派发 reviewer，反馈处理走 `receiving-code-review`，
  **不混用 Matt 的 `/code-review`**（除非单独立项决定替换，两者不得同时生效）。

---

## 评审门禁

三条原则：

1. **批准是决策，归人；跑检查清单、收集证据是步骤，归 agent**（贴合总原则的双方法论边界）。
2. 结论必须落文件且只落一处，禁止只存在于对话中；不新建评审模板文件。
3. 每道门禁只做一次，打回须一次给全缺口清单；禁止「计划评审 → 回填 spec」式互相引用回填，禁止重开已冻结决策。

### 门禁表

| 门禁 | 位置 | 使用哪个 skill | 形成什么文档 | 判定 |
|---|---|---|---|---|
| G1 | 规划期出口 | 生成侧 `/grill-with-docs`、`/to-spec`、`/to-tickets`；**评审不调 skill** | `GLOSSARY.md`、`docs/adr/NNNN-*.md`、`.scratch/<主题>/NN-<slug>.md`（spec + 每 ticket 一份，blocking edges 写文本）、`progress.md` 登记行 | 人按检查清单一次签核；打回置 `needs-info`，缺口写工作项 `## Comments` |
| G2 | 交接期出口 | `writing-plans`（用其结尾的 "Please review the plan" 作交接点） | `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` | 人逐行签核字段映射核对表 6 项；结论只记 `.scratch/<主题>/progress.md` 一行，**不改 plan、不回填 spec** |
| G3 | Task 1 之前 | `subagent-driven-development` 的 `references/preflight.md` | SDD `progress.md` 里的 scan 表格（每对共享文件的任务一行）与冲突 rulings | 自动执行并写 ledger；冲突以 spec 为准裁定后才派 Task 1 |
| G4 | 每任务之后 | `subagent-driven-development` 的 task review（spec 符合性 + 代码质量两轴）；反馈处理 `receiving-code-review`；打回 `references/fix-loop.md`（每任务 ≤5 轮） | `task-<N>-brief.md`、`review-<base7>..<head7>.diff`、implementer report、ledger 的 `minor (deferred)` / `parked` 行 | agent 评审，人只裁决 critical |
| G5 | 整支出口 / 合入 | `subagent-driven-development` 的 `references/final-review.md` → `verification-before-completion` → `finishing-a-development-branch` | final review package、ledger rulings、验证命令输出；**删除 workspace 前**把结论与证据摘要回写 `.scratch/<主题>/progress.md` | 人签核合入 |

G1 检查清单：验收标准均为「命令 + 期望输出」、spec 标了 test seam、术语已入 `GLOSSARY.md`、ADR 已落 `docs/adr/`、每条验收标准至少被一个 ticket 覆盖且无 ticket 超出 spec、blocking edges 完整、版本一致性断言写明比较粒度（minor / patch）。

`requesting-code-review` 不单独派发：G4 / G5 的 reviewer 由 `subagent-driven-development` 内部引用其 `code-reviewer.md`，另派一次即重复评审（不改变执行期「只用 Superpowers review 体系」的禁令）。SDD 产物落在执行所在的 working tree（本项目通常在服务端开发 checkout），客户端 `.scratch/` 只留门禁结论与证据摘要。

### 两套 ledger，互不引用

- `.scratch/<主题>/progress.md`（`# SDD ledger — topic:`）：issue tracker 台账，记 G1 / G2 结论与 G5 证据摘要。
- `<repo-root>/.superpowers/sdd/<plan-basename>/progress.md`（`# SDD ledger — plan:`）：SDD 执行台账，记 G3 / G4 过程，自忽略，且 final review clean 后随 workspace 删除。

### 覆盖规则（skill 默认行为与本项目冲突时以本节为准）

- `/to-spec` 自动打的 `ready-for-agent` 无效：G1 通过前保持 `ready-for-human`，通过后由人改标签。
- 评审禁用 `/grilling`（会重开访谈）与 Matt `/code-review`（混用禁令）；`retro` 是环境复盘，不属门禁。
- fix-loop 的 5 轮是任务内修复，不得用来回填 spec / plan；门禁打回上限另见下节。
- **禁止修改验收断言让测试变绿。**

### 判定、记录与防死循环

- `critical` 只指三类：违反 ADR、与 spec 验收标准不符、会丢数据或越过安全边界；其余记录后可继续。
- 每道门禁最多一次打回，第二次仍不通过即停下、回阶段一整体重写，不允许第三次局部回填。
- 结论格式：`- [x] G2 plan 交接 — YYYY-MM-DD 通过（映射表 6/6，无 spec 外决策）`；打回写 `- [ ] Gx <门禁> — YYYY-MM-DD 打回，缺口清单见 <位置>`。标签只在 `ready-for-human` / `ready-for-agent` 间表达整体状态，不表达门禁进度。

### 不通过时的回退

| 发现的问题 | 回到哪 |
|---|---|
| spec / ADR 有问题 | 阶段一，改完重走 G1 → G2 → … |
| plan 映射漏项或夹带 spec 外决策 | 阶段二第 1 步重做转换；禁止就地改 plan、禁止回填 spec |
| 任务实现偏离 spec | 当前任务内按 fix-loop 修，不动 spec / plan |
| 验收断言未过 | 按映射表定位到对应任务，回该任务 RED |
| 验收断言本身写错 | 阶段一改 spec 并重走 G1 → G5；不得改断言迁就实现 |
| 信息不足 | 置 `needs-info` 暂停，等人补齐 |

---

## 优先级声明（给所有 agent）

1. 用户显式指令 > 本规则文件
2. 规划期内：Matt Skills 优先，Superpowers 的自动触发技能（`brainstorming`、
   `writing-plans`）一律绕过。
3. 执行期内：Superpowers 流程优先，禁止中途切回 Matt 的 `/implement` / `/implement-spec`。
4. `GLOSSARY.md` 与 ADR 永远是领域语言和架构决策的唯一事实源。
5. 各阶段出口以 G1–G5 的签核结论为准；任何 skill 的默认放行（含 `ready-for-agent` 自动置位）不得越过门禁。

---

## 违规的典型症状（自查）

- spec 只存在于对话里 → 交接时信息丢失
- 执行 agent 大量自主选型 → 没带 ADR 或没写约束条目
- 测试全绿但验收标准对不上 → 映射表核对被跳过
- plan 中出现 spec 没有的决策 → `writing-plans` 越权改了方案
- 评审结论只在对话里、台账无记录，或工作项状态标签从未变过 → 门禁没被触发
- 改验收断言迁就实现 → 整支验收失效
