# 领域文档约定

本仓库是**单一领域上下文**（single-context）：没有 `CONTEXT-MAP.md`，也没有 `CONTEXT.md`；术语表的等价物是根目录 **`GLOSSARY.md`**。重要且不易逆转的技术 / 工作流程决定记录在 `docs/adr/`（首份 `0001-auth-architecture.md`）。

## 探索前先读

- **`GLOSSARY.md`**（根目录）——本项目 `CONTEXT.md` 的等价物，按 `CONTEXT-FORMAT.md` 的术语 + `_Avoid_` 结构编写。
- **`docs/adr/`** ——读与当前工作区域相关的 ADR。

若两者缺失，**静默继续**，不要提示创建；`/domain-modeling` 会在术语或决策真正定下来时惰性建立。

## 文件结构

单一上下文：根目录 `GLOSSARY.md` + `docs/adr/`（系统级决策）；没有按模块划分的 `src/<context>/docs/adr/`。

## 使用术语表的词汇

输出中命名领域概念时（工单标题、重构建议、假设、测试名），用 `GLOSSARY.md` 定义的词，不要漂移到它 `_Avoid_` 列出的同义词。需要的词不在表里，说明要么在发明项目不用的语言（重想），要么确有缺口（留给 `/domain-modeling` 补）。

## 标注 ADR 冲突

若输出与既有 ADR 冲突，显式标出而非静默覆盖：

> _与 ADR-0001 冲突 —— 但值得重开，因为…_

## 新增术语或决定

先查 `GLOSSARY.md` / `docs/adr/` 是否已有条目，避免重复定义。ADR 只在「难以逆转 + 无背景会令人意外 + 来自真实取舍」三条都满足时才立。
