# VideoCraft 领域术语表

单一领域上下文：Windows 客户端工作目录 + 服务端 NAS 剪辑链路 + OpenCode V2 插件分发。只收录本项目特有概念，不收录通用编程概念。术语由 2026-11-12 `/grill-with-docs` 评审解析；约定见 `docs/agents/domain.md`。

## 环境与用户

**目标用户**:
一期插件的接收者：局域网内使用较新 OpenCode V2 的用户，能匿名 HTTPS 访问公开 GitHub 仓库，但机器不能假定可访问 npm registry。
_Avoid_: 局域网用户（范围含糊）、终端用户、codebuddy / WorkBuddy 用户（一期非目标）

**验收边界**:
一期验收在隔离临时目录内用「收敛后配置副本」运行；作者本机 `opencode.json` 与 `.agents/skills/` 不在验收阶段改动，只在批准实施后的切换步骤一次性收敛。
_Avoid_: 干净环境（无干净测试机）、临时移开（可逆动作，与永久收敛混淆）

## 服务端契约与发布

**部署命名空间**:
由服务端 `[storage].namespace` 决定、并投影到 `nas://` URI 首段与 `capabilities.subtitle_namespace` 的部署期事实；一期测试环境固定 `test`，客户端不可配置。
_Avoid_: namespace 选项、命名空间配置、客户端可覆盖的 namespace

**契约上线**:
服务端契约变更在测试环境部署并通过 live 验收、且 `tools/list` 实际包含新工具的那一刻。它是插件发布的前置闸门。
_Avoid_: 服务端发版、契约变更（未区分代码 / 文档 / 副本三层）

**插件发布**:
客户端仓库 `yecllsl/VideoCraft` main 分支上插件目录的源码变更；git-source 插件在用户侧执行 `opencode plugin update` 后才更新本地已安装副本，作者 push 本身不改变用户机器上的插件。
_Avoid_: push 即可见、自动更新、同步发布、同批次原子发布

## 文档与分发

**契约编辑源**:
`docs/agents/editing-mcp-capability-matrix.md`，唯一可编辑的工具契约正文；`AGENTS.md` 与所有 harness 都指向它。
_Avoid_: 唯一事实源（未区分编辑 / 副本 / 入口）、`videocraft-contract` reference（那是查阅别名）

**随包副本**:
`plugin/videocraft/docs/editing-mcp-capability-matrix.md`，由契约编辑源生成的只读分发副本，发布前须与编辑源逐字一致。
_Avoid_: 移动、stub、第二份正文

**查阅别名**:
OpenCode 内由 `ctx.reference.transform` 注册的 `videocraft-contract`，提供按需 attach 的访问入口，必须带 `description`；不是事实源，也不进 MCP 预检。
_Avoid_: 单一事实源、reference 预检、自动注入的上下文

**用户安装块**:
随插件 README 分发的一段可整块复制的 PowerShell 命令：掩码录入令牌、把 MCP / SMB / 令牌写入用户级环境变量、执行 git-source `plugin add` 并重启 OpenCode 服务；用户不需要懂 git-source 语法或环境变量名，也不改 `opencode.json`。
_Avoid_: 安装向导、首次运行向导、远程脚本拉取执行（一期不做）

**插件钩子映射**:
OpenCode v2.2.7 运行时实证：插件定义为 `export default { id, setup }`，`setup(ctx)` 用 `ctx.mcp.transform`（`draft.set(name, config)`）、`ctx.skill.transform`（`draft.add(info)`）、`ctx.reference.transform`（`draft.add(别名, source)`）注册三类能力；宿主自动发现 `.opencode/plugin/` 下的文件与含 `index.js` 的目录。
_Avoid_: `config.transform`、`options.transform`（上一轮原型笔记的误记；`ctx.config` 不存在、`ctx.options.transform` 不存在）

## 安全与模板

**令牌驻留面**:
令牌以字面值存在的载体集合（环境变量 / 进程内 config 对象 / 文件 / 命令行 / 日志）。一期目标是不扩大该集合，而不是「插件不写日志」。
_Avoid_: 令牌不进日志（把泄露当成插件可单方控制的动作）

**可变字段白名单**:
模板中允许精确替换的 3 个 token：`{{SERVER_URL}}`、`{{TOKEN_ENV}}`、`{{SMB_HOST}}`；白名单外的 `{{…}}` 视为构建错误。
_Avoid_: 全局字符串替换、模板化（未指明替换方式）

**不可变流程基线**:
两个 skill 的审批闸门与红线段落，模板化时逐字锁定、发布前比对，任一字节变化即阻塞发布。
_Avoid_: 原样保留（只是结果描述）、人工 review、流程内容（混含可改与不可改两类）
