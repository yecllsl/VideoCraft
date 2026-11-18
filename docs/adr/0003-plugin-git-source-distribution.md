# ADR-0003：OpenCode V2 插件以 git-source 分发，更新由用户显式触发

- **日期：** 2026-11-18
- **状态：** 已接受
- **关联：** 本地 `.scratch/videocraft-plugin-git-source/` 工作项；OpenCode 官方 Plugins / Building plugins 文档

## 背景

OpenCode V2 的 `opencode plugin add 'github:acme/plugins#main::path:packages/opencode-plugin'` 支持 npm 兼容 Git 包与 `::path:` 子目录选择器；服务启动只「checks unpinned npm and Git plugins for updates **without changing the installed package**」，真正替换本地副本的是 `opencode plugin update`；本地路径插件与完整 commit hash 会被 update 跳过。`GLOSSARY.md` 原「push 即对所有用户可见」与该机制冲突。

本地 npm 11.20 实测：`::path:` 子目录缺 `package.json` 时 manifest 解析即 `ENOENT`；含 `name` + `version` 后可解析。OpenCode issue #47517 曾记录 staging 阶段误读仓库根 `package.json`（已关闭；社区指南称 2.0.15+ 支持子目录安装，本机 CLI 为 2.3.2）。

## 决策

**第一批只深耕 OpenCode V2（不做 DSH / Pi 兼容）。插件以 git-source 分发：用户执行一次 `opencode plugin add 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'`，此后作者 push，用户执行 `opencode plugin update` 拿到更新；不承诺零操作自动更新。**

插件子目录补最小 `package.json`：`name` + `version` + `private: true` + `exports["."] = "./index.js"`，**不写 `type`**，不加 `files`；版本号固定 `0.1.0`，不作为更新判定依据。仓库根不补 `package.json`。更新比较粒度是 `#main` 分支的 commit，不是 minor / patch 版本号。

## 被否方案

- **零操作自动更新**：官方机制明确「checks … without changing the installed package」，做不到；不再写入文档。
- **锁完整 commit hash**：会被 `plugin update` 跳过，与用户选定的目标 B 相反。
- **加 `"type": "module"` 并改 `render-config.js` 为 `.cjs`**：需改入口 require 路径和既有 ponytail 注释，增加改动面；不写 `type` 时 Node ≥22 的语法自动探测已覆盖当前 ESM/CJS 边界。
- **只写 `name` + `version` 不写 `exports`**：官方 build 文档对「有 name 无 exports」的 fallback 行为未给精确承诺，显式 `exports["."]` 消除歧义。
- **仓库根补最小 `package.json`**：以本机 2.3.2 的真实安装验收为准；若验收复现 issue #47517 的根清单读取错误，再回到本 ADR 复核。
- **发布到 npm registry / 打 tag + 发布 CI**：超出一期范围。

## 后果

- 作者 push 后用户机器上的插件不会立刻变化；安装与更新命令必须随包写在插件 README 中。
- `index.js`（ESM）与 `render-config.js`（CJS）的边界不变；release-gate 四项与 live `tools/list` 11 工具为不得回归的基线。
- 验收在临时 `OPENCODE_CONFIG_DIR` 下进行，不改动作者本机全局配置；令牌只从进程环境读取。
- 命令改动只能经 `opencode plugin update` 到达用户；`plugin check` 仅提示，不替用户更新。

## 复核触发条件

OpenCode 官方支持非破坏性的自动更新、需要 DSH / Pi 兼容、需要发布到 npm registry、或实测在 2.3.2 上复现子目录安装读取根清单的旧错误时，重开本决策。
