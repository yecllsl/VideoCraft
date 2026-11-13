# OpenCode V2 插件一期可分发产物设计

- **日期**：2026-11-12
- **状态**：已冻结（一次评审；问答 B / A / A 与两段设计确认后落盘，不再回填）
- **决策固定点**：`docs/adr/0001-auth-architecture.md`
- **术语**：`GLOSSARY.md`
- **契约编辑源**：`docs/agents/editing-mcp-capability-matrix.md`

## 目的

把作者本机的 OpenCode 连接配置收敛成可分发给**目标用户**的一期插件：在不能假定 npm registry 可达的前提下，仅靠静态 Bearer 直连测试环境，并随包提供同一份工具契约与两个流程 skill。

## 范围

一期覆盖插件入口、配置注入、两个 skill 的模板副本、**随包副本**、**查阅别名**、隔离验收与**插件发布**闸门。作者本机 `opencode.json` 与 `.agents/skills/` 的收敛属批准后的独立切换步骤，不在本轮。

## 非目标

服务端两个 checkout 不改（ADR-0001）：不实现 OAuth 2.1 授权服务器、不做令牌签发 / 轮换 / 吊销、不做 WorkBuddy / 多用户客户端硬化、不做 `05-compat-and-release-verification.md` 的兼容矩阵与整机验证、不改智能剪辑流程与 MCP 工具契约。`06-token-log-exposure.md` 的 P1 人工项不因本轮关闭。

## 架构

插件落在 `plugin/videocraft/`，零依赖 shim，不引入运行时安装步骤。三个 transform 钩子沿用原型已验证的形态：配置注入、`options`、**查阅别名**（`ctx.reference.transform`，必须带 `description`，按需 attach、不进 MCP 预检）。钩子的确切 API 名不在本设计固化，由实施计划首任务的加载自检锁定；探针结果与假设不符时按 `executing-plans` 的 STOP 规则停下上报，不猜。

## 组件

插件入口；两个 skill 的模板副本；**随包副本** `plugin/videocraft/docs/editing-mcp-capability-matrix.md`；查阅别名 `videocraft-contract`；隔离验收目录。模板替换严格走**可变字段白名单**的 3 个 token，白名单外出现 `{{…}}` 即构建失败。两个 skill 的审批闸门与红线段落是**不可变流程基线**，逐字锁定、发布前比对，任一字节变化即阻塞发布。

## 数据流

**插件发布**（main push，跟踪 `#main`）→ 目标用户加载 → config transform 运行时从环境取令牌、注入进程内 config 对象的完整 `Authorization` header → 静态 Bearer 直连测试环境 → **部署命名空间**固定 `test`，客户端不可配置。随包落盘配置不含 `{env:...}` 占位符、不含令牌字面值；环境变量与进程内 config 对象都是既有**令牌驻留面**，一期不新增文件 / 命令行 / 日志载体。隔离验收用的收敛后配置副本按**验收边界**临时存在、验收后删除，不进包、不进仓库、不进日志。

## 错误处理

三类 fail-fast：白名单外 `{{…}}` → 构建失败；不可变流程基线或随包副本比对不一致 → 阻塞发布；缺 `<TOKEN_ENV>` / `{{SERVER_URL}}` → 明确报缺失项，不写默认值、不重试、错误信息不带令牌字面值。Q3 的保守路径不依赖 OpenCode 是否展开 `{env:...}`：即便平台意外展开，仍由 transform 注入的 header 生效。不实现四态友好报错（属 `03-plugin-client-hardening.md`，一期外）。

## 验收与发布闸门

按**验收边界**：隔离临时目录内用收敛后配置副本运行，作者本机文件在验收阶段不动。五条可运行检查全部先红后绿：Q6 红测（无 `{env:...}`、无令牌字面值）；零依赖 shim + 三个 transform 加载自检；白名单 3 token 精确替换与白名单外报错；不可变流程基线逐字比对；随包副本与契约编辑源逐字一致。按 `verification-before-completion`，「完成」必须挂当次命令输出。

发布闸门：**契约上线**已复核（`tools/list` 实测 11 工具）、五条全绿、白名单外 `{{…}}` 计数为 0 → 才允许插件发布。作者本机切换不进本轮；P1 人工项不因发布关闭。服务端两 checkout 本轮不改，`accept-remote` 12/12 沿用既有 live 证据，不重复跑。

## 文档关系

本设计不引用任何实施计划文档，也不使用「第 N 节」式内部引用；`AGENTS.md`、`.scratch/` 台账与工作项不写指向本设计或计划文档的路径，现存悬空引用由实施计划的清理任务移除。本轮只有 ADR-0001 一个决策固定点，避免上轮「改 A → 同步 B → 又发现 C」的镜像网。
