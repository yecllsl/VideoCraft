# VideoCraft MCP 环境实施计划

> **执行要求：**按任务逐项执行，并用复选框记录进度。实施前须先取得用户对设计和本计划的确认。

**目标：**安全配置客户端（Windows 侧）工作目录，使其默认使用服务端测试环境的 MCP，并提供安全、按需使用服务端开发环境 MCP 的途径。

**方案结构：**OpenCode V2 项目配置通过 Windows 用户环境变量读取测试服务令牌。开发服务保持 stdio 方式；只有在确认无需修改远端内容即可通过 SSH 启动后，才配置对应入口。

**技术：**OpenCode V2 JSON 配置、Windows 用户环境变量、SSH、远端 Python MCP 启动脚本。

**设计说明：**`docs/superpowers/specs/2026-11-04-videocraft-mcp-environments-design.md`

## 全局约束

- 服务端测试环境 `/opt/videocraft/` 的 MCP 与 Worker 保持运行，不作改动。
- 不终止由 VS Code 管理的 MCP 进程。
- Bearer 令牌不写入项目文件，也不出现在命令输出中。
- 不创建或启用开发环境 systemd 服务或 HTTP 监听。
- 不调用会写入、合成或取消媒体任务的工具。

## 重点检查

- 未设置 `VIDEOCRAFT_MCP_TOKEN` 时，配置仍不得包含明文令牌；检查文件中只有环境变量引用。
- 开发入口默认不得启动；用 `opencode mcp list` 确认默认只连接测试服务。
- SSH stdio 启动失败不得影响测试监听；单独验证启动配置，远端运行状态保持不变。

---

### 任务一：将测试服务令牌移出项目配置

**文件：**
- 修改：`opencode.json`

**输入与输出：**
- 输入：Windows 当前用户环境变量 `VIDEOCRAFT_MCP_TOKEN`。
- 输出：OpenCode 远程服务器 `videocraft-remote` 使用请求头 `Authorization: Bearer {env:VIDEOCRAFT_MCP_TOKEN}`。

- [x] 将当前已配置的令牌保存为 Windows 当前用户环境变量；操作时不打印令牌值。
- [x] 将 `opencode.json` 中的令牌明文替换为 `{env:VIDEOCRAFT_MCP_TOKEN}`；保留 URL、Host 请求头、schema 及其他无关配置。
- [x] 解析 JSON，并验证文件中不含令牌明文、环境变量引用正确。
- [x] 运行 `opencode mcp list`；`videocraft-remote` 状态为已连接。

### 任务二：验证按需使用开发环境的方式

**文件：**
- 只有在验证开发 stdio 启动方式可用后，才修改 `opencode.json`。
- 否则提供经核实的手动启动说明，不改远端文件。

**输入与输出：**
- 输入：SSH 别名 `ZZZ.Video`、开发目录 `/root/projects/videocraft/`、启动脚本 `scripts/videocraft-mcp`。
- 输出：一个默认禁用、必须显式启用的独立开发 MCP 入口；若不修改配置就无法安全启动，则记录具体阻碍项。

- [x] 检查 MCP 启动脚本实际使用的配置加载路径；不另起开发服务，也不终止当前 VS Code 管理的进程。
- [x] 验证开发入口调用现有 `scripts/videocraft-mcp` stdio 启动器；该目录没有 `videocraft.local.toml`，因此使用已提交的通用配置。本次未实际启动第二个开发进程。
- [x] 添加独立且默认禁用的 SSH stdio MCP 配置，并检查 JSON 格式及默认禁用行为。
- [x] 无需另建远端配置；开发入口保持禁用，未启动。
- [x] `opencode mcp list` 显示测试服务已连接、开发入口已禁用。
- [x] 2026-11-05 复核：开发入口实际位于用户级 `~/.workbuddy/mcp.json` 的 `videocraft-development`（SSH stdio，列于 `disabledMcpServers`）；项目 `opencode.json` / `.mcp.json` 只保留测试 HTTP 入口，未出现开发环境常驻服务。

### 任务三：最终核验

- [x] 确认测试环境 systemd MCP 与 Worker 仍在运行；MCP `ActiveEnterTimestamp` 未改变，监听仍为 `192.168.88.4:8000`。
- [x] 未调用媒体处理工具，也未创建任务或输出文件。
- [x] 最终核验已完成；另有令牌轮换安全事项需用户处理，见执行结果汇报。
