# 工作项分类标签

`/triage` 用五个状态角色推进工单。下表把技能里的角色名映射到本仓库实际使用的字符串；右列与角色名相同（无自定义别名）。

| 技能里的角色 | 本仓库字符串 | 含义 |
|---|---|---|
| `needs-triage` | `needs-triage` | 尚未完成初步分类 |
| `needs-info` | `needs-info` | 需要补充需求或复现信息 |
| `ready-for-agent` | `ready-for-agent` | 信息充分，可由代理执行 |
| `ready-for-human` | `ready-for-human` | 需要用户操作或判断 |
| `wontfix` | `wontfix` | 决定不处理 |

## 本地 Markdown 下如何「apply label」

本仓库没有标签系统。技能说「apply / change the state label」时，改写工作项文件顶部的 `- **标签：** \`xxx\`` 行，并同步该主题 `progress.md` 的列表项；**不要调用 `gh issue edit --add-label`**。每个工作项只带一个状态角色。

## `wontfix` 的层级

`wontfix` 是 **issue 级**状态。若只裁定某个处置项不执行（如 `06-token-log-exposure.md` 的「轮换令牌」），在该项正文写明「该处置 `wontfix`」，不要改掉 issue 的 `- **标签：**` 行。

## 未登记的角色

`/triage` 另有 `bug` / `enhancement` 两个 category roles；本仓库目前没有外部 bug report，也未使用这两个字段。将来需要时先在本文件补映射，再启用。
