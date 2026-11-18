# VideoCraft OpenCode V2 插件

通过 GitHub git-source 分发，不依赖 npm registry。第一批只支持 OpenCode V2（不支持 DSH / Pi）。

## 安装

```bash
opencode plugin add 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'
```

需 OpenCode V2 2.0.15 或更新版本（早期版本不支持 `::path:` 子目录选择器）。

## 更新

```bash
opencode plugin check
opencode plugin update
```

只想更新这一个包时，用安装时的**完整目标串**：`opencode plugin update 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'`。用 npm 包名 `videocraft-opencode-plugin` 会报 `Plugin is not configured`。首次安装后 `plugin list` 可能滞后一次调用才显示插件，必要时重启 OpenCode 服务。

作者 push 到 `main` 后，用户机器上的插件**不会自动变化**：OpenCode 启动只检查更新，不替换已安装副本；只有执行 `opencode plugin update` 才会拉取新提交。`opencode plugin check` 只提示，不执行更新。本地路径安装与完整 commit hash 会被 `update` 跳过，因此不要改用这两种写法。

## 运行前置

插件从进程环境变量读取配置，令牌不写入文件、命令行或日志：

- `VIDEOCRAFT_MCP_URL`：MCP 服务 origin（如 `http://host:port`，不带路径）
- `VIDEOCRAFT_SMB_HOST`：SMB 主机
- `VIDEOCRAFT_MCP_TOKEN`：静态 Bearer 令牌

加载后应提供 11 个 MCP 工具，并注册 `videocraft-edit`、`videocraft-cut-decision` 两个 skill 与 `videocraft-contract` 查阅别名。
