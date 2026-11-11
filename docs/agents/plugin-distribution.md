# 插件分发与多用户适配约定

> 面向"把 VideoCraft 能力发布给其他 WorkBuddy 用户"的工程约定。
> 当前实现是**单机单用户定制**，直接发给别的用户会大面积失败。本清单是发布前的准入条件。

## 0. 现状定性：哪些是服务端的固有约束，哪些是我的定制

### 服务端固有（必须解决，否则 100% 用户复现"需要认证"）

已核实（2026-11-04，服务端测试环境 `/opt/videocraft/`）：

- MCP 使用 MCP Python SDK **2.3.0** 的 bearer-auth 中间件。
- `mcp/videocraft_mcp/remote.py` 的 `derive_auth()` 把 `issuer_url` 与 `resource_server_url` **都指向 MCP 服务自身**——即声明"我既是受保护资源，又是授权服务器"。
- 401 响应返回 `WWW-Authenticate: Bearer ... resource_metadata=".../.well-known/oauth-protected-resource"`；该元数据端点**返回 200** 并把自己宣称为授权服务器；但 `/authorize`、`/token`、`/register` **未注册 → 404**。
- 后果：任何遵循 MCP 规范的客户端（WorkBuddy 桌面版、官方 SDK 客户端）在 401 后必然启动 OAuth 流程，并因授权服务器端点 404 而失败，界面表现为"需要认证 / 未连接"。
- OpenCode 之所以正常：其配置支持 `oauth: false` 旁路，可跳过 OAuth 直发静态 Bearer。**WorkBuddy 桌面版对 HTTP 连接器没有该旁路。**

这不是配置失误，是 M0 阶段"只做静态令牌"的取舍留下的缺口，发布前必须补齐。

### 我的定制（**不可发布**，必须参数化或替换）

| 项 | 当前硬编码值 | 发布要求 |
|---|---|---|
| 桥接脚本路径 | `C:\Users\yecll\.workbuddy\videocraft-mcp-bridge.cmd` | 随插件分发到插件目录，路径由插件运行时解析 |
| Node 路径 | `D:\Program Files\nodejs\npx.cmd` | 改为 `npx`（PATH）或插件自带 runtime；不得假设安装位置 |
| 令牌读取 | Windows 注册表 `HKCU\Environment` | 跨平台：Win 注册表 / macOS `launchctl` / Linux 环境；并提供插件内录入路径 |
| 启动方式 | `cmd /c`（仅 Windows） | 跨平台：Windows `.cmd` + POSIX `.sh` 双份，或用 Node 入口统一 |
| MCP 地址 | `http://192.168.88.4:8000/mcp` | 改为用户可配置项（settings/首次运行向导） |
| 依赖 | 需用户机器有 Node + npm registry 可达（拉 `mcp-remote`） | 去掉对 npx 联网的运行时依赖；随包分发桥接产物 |
| 令牌暴露面 | 令牌出现在 `npx mcp-remote` 进程命令行 | 改为进程内设置 header，令牌不出现在任何命令行 |
| NAS 凭据 | mount options 内明文 `username=drche` | 迁移到凭据文件 / secret 引用，不写进文档或配置分发 |

### 与 harness 的隔离（已核实，无需担心）

- WorkBuddy 桌面版读 `~/.workbuddy/mcp.json`；codebuddy CLI 读 `~/.codebuddy/mcp.json`——两者配置目录独立。
- 项目内 `opencode.json` 属 OpenCode harness，**不要与 WorkBuddy 插件配置混用**；WorkBuddy 侧只走 `~/.workbuddy/mcp.json`（无点前缀；同目录的 `.mcp.json` 是系统生成的代理文件，禁止手改）。
- 改 MCP 配置会改变配置哈希 → 需重新「信任」（审批键为 `<配置哈希>::<服务器名>`）。
- 禁用服务器的正确写法是顶层 `disabledMcpServers: ["<name>"]`；**在 server 条目里写 `disabled: true` 是非 schema 字段，会被忽略**。

---

## 1. 服务端工作（硬性前置）

### 1.1 实现真正的 OAuth 2.1 授权服务器（推荐路径）

SDK 已自带组件（`mcp/server/auth/handlers/`：`authorize.py` / `token.py` / `register.py` / `revoke.py` / `metadata.py`），无需从零造。

需注册：

- `/.well-known/oauth-authorization-server` —— 授权服务器元数据
- `/.well-known/oauth-protected-resource` —— 指向真实 AS，而非自身
- `/authorize` —— 授权码 + PKCE
- `/token` —— 授权码换 token、刷新
- `/register` —— 动态客户端注册（RFC 7591）
- `/revoke` —— 撤销

令牌策略：复用现有 `StaticTokenVerifier` 的静态令牌作为 access token 载体（或新增管理员签发/轮换流程）；**保留静态令牌直连能力**，供 OpenCode 等不支持 OAuth 的客户端使用。

**验收标准**

- WorkBuddy 桌面版用**标准 HTTP 连接器**（`type: http` + `headers`）完成 OAuth 后连上并列出当前 7 个工具。
- 官方 MCP SDK 客户端 `streamable_http_client` 在**不注入自定义头**的情况下能完成 OAuth 并连接。
- 现有 OpenCode 路径（`oauth:false` + 静态 Bearer）不回归。
- 无凭据请求仍返回 401 + 正确的 `WWW-Authenticate`，但元数据指向可达的 AS。

### 1.2 若坚持不做 OAuth：客户端桥接方案的产品化要求

- 桥接产物随插件分发，**不依赖运行时 npx 联网**。
- 令牌由插件进程内注入 header，不进命令行、不进日志。
- 多平台启动器（Windows / macOS / Linux）。
- 明确记录这是**过渡方案**，并给出版本上限与迁移路径。

### 1.3 令牌生命周期（当前缺口）

- 服务端目前只有"校验静态令牌"，**没有签发、轮换、吊销流程**；多用户发布必须补齐。
- 每个用户独立令牌，便于审计与单独吊销。
- 令牌不得预置在插件包内；不得写入日志、命令行、示例配置。

---

## 2. 客户端 / 插件工作

### 2.1 配置生成与分发

- 插件安装时生成用户级 MCP 配置，**不覆盖用户已有条目**（追加语义）。
- 地址、挂载根、工作目录等一律参数化，集中在 settings。
- 首次运行向导：选择环境（测试 / 开发）、填 MCP 地址、录令牌、连通性自检。
- 自检失败要给出可执行的错误文案（未连内网 / 服务未启动 / 令牌无效 / 未挂载 NAS），不要只显示"未连接"。

### 2.2 跨平台与依赖

- 不假设 Node/Python/编译工具链位置；能自带就自带。
- 依赖的第三方包要么随包分发，要么固定版本并做可达性检查。
- 插件内不得写死任何用户目录、主机名、内网 IP、SSH 别名。

### 2.3 多环境隔离（面向终端用户）

- "服务端开发环境"对终端用户无意义，发布版默认只暴露测试/生产入口；开发入口置于 `disabledMcpServers`，需要时由用户显式启用。
- 可写数据按环境分区（`dev/` / `test/`）、输出名唯一、禁止覆盖既有成果——这些约束在插件层要再校验一次，不能只依赖服务端。

### 2.4 Skill 设计

- Skill 只描述可独立触发的分支，避免无关上下文加载。
- 审批闸门必须写进 Skill：删除清单未由用户置为「已确认」 → **不得调用 `submit_assemble`**；带校订字幕的中间态另需用户一次确认。
- 字幕/画面不匹配、告警时暂停并上报，不得把不可靠结果当合格结果。
- Skill 中每个原子步骤都必须能由远程 MCP 工具完成；禁止把交付步骤写成「服务端受控 CLI」或依赖 SSH 别名 / 密钥（终端用户没有该通道）。发布前用 `tools/list` 逐项核对 Skill 引用的工具名——2026-11-11 的字幕烧录故障即由此类隐式特权依赖造成。

---

## 3. 安全与合规

- 令牌：不进包、不进文件、不进命令行、不进日志；`raw` 只读、`projects`/`output` 可写但按环境分区。
- NAS 凭据：用凭据文件 / secret 引用，不写在 fstab 明文或文档示例里。
- 原始媒体不外传到 Windows、不进插件产物。
- 插件声明所需权限与网络范围（LAN / VPN）。

## 4. 兼容与测试

- 兼容矩阵：WorkBuddy 桌面版、codebuddy CLI、OpenCode、官方 MCP SDK 客户端，至少各跑一次"连上 + 列工具 + selfcheck"。
- 在**干净环境**验证安装（无 Node、无既有配置、无令牌）。
- 故障排查文档要覆盖本次踩到的坑："需要认证"→ 先看服务端是否声明了 OAuth、客户端是否拿到令牌、`~/.workbuddy/logs/*/workbuddyMainThread__*.log` 里的 `MCP-ManagerAuth` 报错。

## 5. 建议落地顺序

1. **服务端补 OAuth AS**（第 1 节）——不做这步，后续所有客户端适配都是打补丁。
2. 撤下本地桥接，改用标准 HTTP 连接器 + OAuth。
3. 参数化配置与跨平台化（第 2 节）。
4. 令牌签发/轮换/吊销（第 1.3 节）。
5. 兼容矩阵回归 + 干净环境安装验证（第 4 节）。
