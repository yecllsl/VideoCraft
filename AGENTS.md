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

## Agent skills

### 视频剪辑全流程

素材盘点、旁挂字幕、远程合成与校验使用 `.agents/skills/videocraft-edit/SKILL.md`（`/videocraft-edit`）。

### 工作项跟踪

工作项使用 `.scratch/` 下的本地 Markdown 文件管理。约定见 `docs/agents/issue-tracker.md`。

### 分类标签

使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human` 和 `wontfix`。说明见 `docs/agents/triage-labels.md`。

### 领域文档

本目录采用单一领域上下文，使用根目录 `GLOSSARY.md` 和 `docs/adr/`。约定见 `docs/agents/domain.md`。

### 插件分发

面向其他 WorkBuddy 用户的发布要求见 `docs/agents/plugin-distribution.md`。当前实现为单机定制，发布前须先完成该清单第 1 节的服务端 OAuth 授权服务器，否则规范客户端一律无法完成授权。
