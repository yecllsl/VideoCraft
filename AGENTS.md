# 工作环境

- 当前 Windows 目录 `D:\yecll\Documents\LocalCode\VideoCraft` 是视频剪辑的 Windows 侧工作目录。
- SSH 别名 `ZZZ.Video` 指向主机 `debian12chong`。已通过 SSH 确认以下目录均存在：
  - `/opt/videocraft/` 是测试环境。
  - `/root/projects/videocraft/` 是开发环境。
- 在远端执行操作时，按上述路径区分测试与开发环境；不要混淆两者。

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
