# 工作环境

- 当前 Windows 目录 `D:\yecll\Documents\LocalCode\VideoCraft` 是视频剪辑的客户端（Windows 侧）工作目录。
- SSH 别名 `ZZZ.Video` 指向主机 `debian12chong`。已通过 SSH 确认以下目录均存在：
  - `/opt/videocraft/` 是服务端测试环境。
  - `/root/projects/videocraft/` 是服务端开发环境。
- 在远端执行操作时，按上述路径区分测试与开发环境；不要混淆两者。
- 三者职责：客户端工作目录只放配置、skills 与轻量记录，媒体和产物都在服务端 NAS；服务端开发环境用于实现与验证、无常驻服务；服务端测试环境是常驻 MCP / Worker、客户端默认连接的目标。下文及文档中的「开发环境 / 测试环境」均指这两个服务端环境。

### 环境现状（2026-11-05 核查与对齐）

- 服务端开发、测试两个 checkout 均停在 `0f3b440`（默认帧率 60 fps），工作区干净；2026-11-05 已把测试环境 git 历史快进对齐，服务未重启。MCP / Worker 常驻服务的运行目录是 `/opt/videocraft`。
- 服务端开发环境不设常驻服务；其 SSH stdio 入口 `videocraft-development` 在用户级 `~/.workbuddy/mcp.json` 中默认禁用。客户端项目根的 `opencode.json` / `.mcp.json` 只连接服务端测试环境的 HTTP 服务。
- 服务端两环境共用三处 NAS 挂载（raw 只读，projects/output 可写，由 systemd automount 按需挂载）；写边界由 `[storage].namespace` 的 `dev` / `test` 区分。
- 核查与对齐记录见 `.scratch/videocraft-workflow/progress.md` 的「2026-11-05 开发环境现状核查」及后一节。
- 2026-11-07：ASR 候选转写（`transcribe_candidate`）已实现、开发环境真实推理通过，并部署到测试环境完成 live 验收（12/12 preflight + 转写/冲突/取消）。两个 checkout 仍含未提交改动；测试环境 `videocraft.local.toml` 的 `[preview]` 调整为 1 MiB/帧、6 MiB/总。详见 `.scratch/videocraft-workflow/progress.md` 的「2026-11-07 ASR 候选转写部署与验收」。
- 2026-11-09：智能剪辑契约增量已部署并 live 验收——`transcribe_candidate` 的 `job.result` 含 `words` / `last_word_end`，`submit_assemble` 的 shot 支持 `audio_start`（同源取段时与 `start` 同值）。详见 `.scratch/videocraft-smart-cut/progress.md` 与 `docs/agents/editing-mcp-capability-matrix.md`；任何写操作前先核实两个 checkout 当前状态。
- 2026-11-12 核查：`burn_subtitles`（第 11 个远程工具）两端均已提交且工作区干净——开发 `11ece3d`（已与 `origin/main` 同步）、测试 `2288bca`（无 remote）；两端这 7 个改动文件内容逐字节一致，HEAD 不同是既有历史分叉，不强行对齐。测试环境常驻服务未重启。认证架构定案见 `docs/adr/0001-auth-architecture.md`。

## 开发流程

双方法论（Matt 规划 / Superpowers 执行）的三阶段、交接映射表与阶段间禁止事项见 `docs/agents/development-workflow.md`。

## Agent skills

### 智能剪辑流程

- 判读与删除清单（ASR 候选、空镜入出点、字幕校订表）：`.agents/skills/videocraft-cut-decision/SKILL.md`（`/videocraft-cut-decision`）。
- 连接、预检、编排提交、验收、记录清理：`.agents/skills/videocraft-edit/SKILL.md`（`/videocraft-edit`）。
- 工具契约唯一事实源：`docs/agents/editing-mcp-capability-matrix.md`（参数、URI 约束、错误码只在此维护，两个 skill 都引用它）。
- 开新项目：先确定唯一项目名，按契约模板提交首段 `transcribe_candidate` 作为预检验收点；项目目录由服务端发布逻辑自动创建，不需要也不存在「创建项目目录」的 MCP 接口。

### 工作项跟踪 / Issue tracker

工作项使用 `.scratch/` 下的本地 Markdown 文件管理，不进 Git；GitHub 远程只是代码/文档的分发渠道，不是 tracker，外部 PR 也不是 triage 请求面。技能说「publish / fetch 工单」时按 `docs/agents/issue-tracker.md` 的本地语义执行。

### 分类标签 / Triage labels

使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human` 和 `wontfix`（五个状态角色，字符串即默认值）。「apply label」在本地 Markdown 下指改写工作项的 `- **标签：**` 行或 `progress.md` 列表项，不调用 `gh`。说明见 `docs/agents/triage-labels.md`。

### 领域文档 / Domain docs

单一领域上下文：术语表是根目录 `GLOSSARY.md`（等价 `CONTEXT.md`），历史决定在 `docs/adr/`；没有 `CONTEXT-MAP.md` 的多上下文结构。约定见 `docs/agents/domain.md`。

### 插件分发

面向其他 WorkBuddy 用户的发布要求见 `docs/agents/plugin-distribution.md`，适用范围由 `docs/adr/0001-auth-architecture.md` 定案：面向不支持 `oauth: false` 的规范客户端 / 多用户发布，须先完成该清单第 1 节的服务端 OAuth 授权服务器，否则一律无法完成授权；OpenCode V2 插件一期走静态 Bearer 直连，不以此为前置。
