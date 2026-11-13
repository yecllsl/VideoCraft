# ADR-0001：插件分发的认证架构与 OAuth 前置范围

- **日期：** 2026-11-12
- **状态：** 已接受
- **关联：** `docs/agents/plugin-distribution.md`；01 认证架构决策工作项（本地 `.scratch/`，不进 Git）

## 背景

MCP 服务（`mcp/videocraft_mcp/remote.py` 的 `derive_auth()`）把自己同时声明为 issuer 与 resource server，但 `/authorize`、`/token`、`/register` 未注册（404）。遵循 MCP 规范的客户端在 401 后启动 OAuth 必然失败；OpenCode 因支持 `oauth: false` 可用静态 Bearer 直连。

`AGENTS.md` 与 `plugin-distribution.md` 曾把「服务端补 OAuth AS」写成所有发布的硬性前置（第 1 节）；而 2026-11-11 的 OpenCode V2 插件一期设计明确不做 OAuth，两套准入口径冲突，故有本决策（2026-11-12 已接受）。该前置的适用范围已由下节限缩。

## 决策

**一期（OpenCode V2 插件）采用静态 Bearer 直连，不实现服务端 OAuth 2.1 授权服务器。** 客户端通过 `oauth: false` + `Authorization: Bearer <env>` 注入；令牌由人工为每位用户发放，不进仓库、命令行或日志。保留静态令牌直连路径（OpenCode 依赖此路径）。

`plugin-distribution.md` 第 1 节的硬性前置**继续有效，但限定适用范围**：当发布目标包含不支持 `oauth: false` 的规范客户端（WorkBuddy 桌面版、官方 MCP SDK 客户端），或需要 per-user 令牌的签发 / 轮换 / 吊销时，必须先完成第 1 节（OAuth AS）与第 1.3 节（令牌生命周期）。第 5 节的落地顺序也在此范围内适用。

## 被否方案（本轮推迟，非永久否决）

- **A. 先补服务端 OAuth AS 再发布**：对标准客户端最通用，但一期目标用户是 OpenCode V2，本就能走静态 Bearer；把中等成本的服务端改动放进关键路径，属于不必要的前置阻塞。
- **C. OAuth 与客户端桥接都留**：工作量最大，且一期只需一条链路。

## 后果

- `02-server-oauth-as.md`、`04-token-lifecycle.md`、`05-compat-and-release-verification.md` 退出一期关键路径；`03-plugin-client-hardening.md` 保留给 WorkBuddy / 多用户客户端硬化。
- 一期验收按 `GLOSSARY.md` 的「验收边界」执行（隔离临时目录内的收敛后配置副本）。
- `06-token-log-exposure.md` 的「轮换令牌」处置按 2026-11-11 用户决定不执行；该决定针对轮换动作，不撤销本机 Trae 日志明文泄露这一事实及其余处置项。
- 已知取舍：静态令牌长期有效、无单用户吊销能力，只能整体更换。这是单机 / 局域网小范围分发的天花板；一旦出现多租户、需要单独吊销或审计，必须回到本决策的复核条件。

## 复核触发条件

新增非 OpenCode 客户端支持、需要 per-user 令牌、静态令牌需要单独吊销或审计、目标用户机器不能设置环境变量时，重新评估并优先落地第 1 节。
