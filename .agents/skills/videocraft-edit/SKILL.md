---
name: videocraft-edit
description: 连接 VideoCraft 远程 MCP 并执行剪辑：预检、把已确认的删除清单转成 shots 提交合成、轮询验收、按本次 storyboard 生成校订字幕中间态、记录与清理；也用于排查 401、OUTPUT_EXISTS、TOOL_TIMEOUT、INVALID_URI、PREVIEW_TOO_LARGE 等工具报错。判读、删除清单与字幕校订表由 videocraft-cut-decision 负责。
---

# VideoCraft 远程剪辑执行

**核心原则**：只执行已在服务端测试环境跑通的行为；工具契约以 `docs/agents/editing-mcp-capability-matrix.md` 为**单一事实源**，不在本文档复制参数表。媒体与产物都在 NAS，客户端工作目录只放轻量记录，不复制媒体、不安装任何额外工具。

OpenCode 按 `description` 把本 skill 列入 `<available_skills>`，由 agent 按需加载；也可直接点名 `videocraft-edit`。

## 0. 运行环境（地址固定，不要改）

本 skill 运行在客户端（Windows 侧）工作目录的 OpenCode V2 项目根；服务端开发环境不参与剪辑流程。

| 项 | 固定值 |
|---|---|
| MCP | 服务端测试环境 `http://192.168.88.4:8000/mcp`；客户端项目根 `opencode.json` 里 `oauth: false` + 静态 Bearer |
| 令牌 | `opencode.json` 用 `{env:VIDEOCRAFT_MCP_TOKEN}` 引用，**不写进任何文件、命令行或日志** |
| 命名空间 | `test` |
| 素材 | `nas://raw/<项目>/`（只读） |
| ASR 候选 | `nas://projects/test/<项目>/asr/`（按契约模板写 URI；目录由服务端自动创建，无需预建） |
| 成片 | `nas://output/test/<项目>/` |
| NAS SMB | `\\192.168.100.58\videocraft-{raw,projects,output}`（局域网下可顺畅访问音视频；raw 只读） |
| 成片规格 | 1920×1080 / 60 fps |

> `oauth: false` 是直连静态 Bearer 的关键，**不要删**；删掉后 OpenCode 会进入 OAuth，而测试环境没有授权服务器，必然卡在 401。

## 1. 预检（干净客户端先跑这一段）

**首次接入或换了客户端环境**：确认令牌已由进程继承、`oauth: false` 仍在、`<available_skills>` 同时列出两个流程 skill、契约文档 `docs/agents/editing-mcp-capability-matrix.md` 存在；IDE 内置 MCP 面板显示「需要认证」时改用 `oauth: false` 的直连客户端（或 PowerShell 静态 Bearer 直连），不要据此判定服务不可用。再确认三处 SMB 共享可读可写（raw 只读）。

调用 `videocraft_selfcheck`，逐项确认；任一不满足即停止并给出可执行文案（区分未连内网 / 服务未启动 / 令牌无效 / NAS 未挂载）：

- `ok`、`core_ok`、三个存储根 healthy、worker alive；`capabilities.nvenc.status` 只把 `ok` 视为可用。
- `tools/list` 含契约文档列出的 10 个工具；`capabilities.subtitle_namespace` 必须为 `test`；`capabilities.asr.status` 必须为 `configured`。
- 显式调用 `storage_probe`：raw `write_denied=passed`，projects/output 的 create/read/delete/cleanup 均 `passed`。
- 用 `list_directory` 读取素材清单与输出基线，遍历分页 cursor 至结束；**URI 不带尾部 `/`**；输出基线用项目级 URI（如 `nas://output/test/<项目>`），只给到 `nas://output/test` 会被拒；目录尚不存在时返回空 `entries`，可当基线，且**不代表不可写、不是阻塞**。
- **开项目验收点**：确定本次唯一项目名（不复用历史），按契约速查的模板提交一段真实 `transcribe_candidate`（`nas://projects/test/<项目>/asr/<文件名>.txt` + 同目录 `.srt`），确认 `queued → succeeded`；这段可直接作为第一段话术的候选产物，不重复提交。项目目录由服务端自动创建，**不预建目录、不新增 MCP 接口、不改写到 `output`**。失败时原样记录 `error_code` / `error_detail` 再按故障表处置，不得自行归因或整体停机。
- 任何工具失败都先原样记录 `error_code` / `error_detail`，再决定下一步；不要把推断当成错误信息。
- 不要在日志或命令行打印令牌。

## 2. 审批闸门（不可绕过）

删除清单状态不是「已确认」时，停在判读与草稿：**不调用 `submit_assemble`**。「已确认」只能由用户置位，且必须在合成之前；第 5 步只回填实际结果，不得事后补写确认。

删除清单由 `videocraft-cut-decision` 产出；用户一次确认时可能勾掉删除项或改写空镜区间，以确认后的版本为准。字幕中间态另需用户一次确认（见 3.5）；未确认不得当作定稿字幕。

**硬阻塞与待补信息分开**：只有连接 / 预检 / 上述闸门失败才整体停止。空镜入出点等待用户回填、`extract_frames` 拿不到帧等属于「待补信息」，清单里写「待用户指定」即可继续推进 ASR 与草稿，由一次确认闸门收口；不得因此停掉整条流程。

## 3. 编排与提交

- 把删除清单的「保留片段」按时间顺序转成 shots：每个 clip 用 `video`、`audio`（同源 URI）、`start`、`audio_start`（与 `start` **同值**）、`duration`。
- 空镜作为独立 shot 插入，使用清单里用户审定的入出点，保留自身 `audio`；不得复用历史样例的区间或偏移值。
- storyboard 顶层 `title` / `size` / `fps`；`size` 固定 `[1920,1080]`，成片用 `fps=60`。
- `output_uri` = `nas://output/test/<项目>/<唯一文件名>.mp4`，唯一命名、不覆盖；重复目标返回 `OUTPUT_EXISTS` 时换名，不绕开。
- 提交后轮询 `get_job_status(job_id)`；`state=succeeded` 且 `stage=publishing` 才算完成。

## 3.5 字幕中间态（LLM 校订后）

- 校订表由 `videocraft-cut-decision` 产出，写进生成脚本常量；脚本只做词级确定性替换，**不删语音、不改语序、不动原时间轴**。
- SRT 时间轴从**本次 storyboard** 的 shots `start` / `duration` / 累计起点现算：按「原片 cue 区间 ∩ shot 源区间」映射，被删区间的 cue 自动丢弃；**禁止复用历史偏移值**。
- 远程 MCP 未暴露 `burn_subtitles`：外挂 SRT 直接落 output 项目目录；硬字幕走服务端受控 `burnsub` CLI（`nvenc_1080_final`），不改 MCP 工具契约。
- 中间态片子 + 外挂 SRT + 校订表一起交付，唯一命名、不覆盖；用户一次确认后才定稿，校订表须可逐条推翻。
- 不调用 `strict_subtitles` 重新对齐（会改变断句并输出 `needs_review`）；若要启用需另行评估。
- 用户确认后：把中间态登记为最终交付成片（**不改名、不重编码、不覆盖无字幕母版**），回填校订报告 / 删除清单 / 台账状态为「已确认」，清理无用的审片版与中间母版，保留外挂 SRT、ASR 候选证据与审批记录。

## 4. 验收

- 与预检的输出基线比对，确认未覆盖既有文件；记录 job_id、duration、size_bytes。
- 成片 1920×1080 / 60 fps / 有音轨；时长 ≈ 各保留片段 + 空镜时长之和。
- 被删区间的语音确实消失、保留段音画同步：用客户端 SMB 看片听音复核，或服务端受控 ffprobe；不做过的检查不得宣称做过。
- 字幕中间态：抽查校订后 SRT 无残留错词、尾部 cue 落在成片时长内；抽帧比较母版与硬字幕版的底部 / 顶部像素差异，确认字幕确实烧上且只出现在有字幕时段。

## 5. 记录与清理

回填删除清单的实际执行结果、成片路径 / 大小 / 时长、任务 ID、方案偏差与待定项；更新 `.scratch/` 进度台账。清理中间预览与临时产物，保留审批记录、候选稿与判读证据。

## 常见故障

| 现象 | 原因与处置 |
|---|---|
| 401 / 工具列表为空 | 确认 `oauth: false` 还在、`VIDEOCRAFT_MCP_TOKEN` 已设置并被进程继承；改环境变量后重开应用 |
| `INVALID_URI: empty/dot/dotdot path segment` | `list_directory` 的 URI 带了尾部 `/`，去掉即可 |
| `INVALID_URI: directory must be within an allowed project` | 非 `raw` 根只给到 namespace 一级（如 `nas://output/test`）；补上项目名 |
| `INVALID_URI: outputs must be .txt/.srt in one configured project` | 候选输出 URI 结构不合规：层级不足、`namespace` 段错、两个输出不同目录或后缀不对。按契约速查模板写 `nas://projects/test/<项目>/asr/<文件名>.txt` + 同目录 `.srt`；**与项目目录是否存在无关，不要去建目录、改路径或改写到 `output`** |
| `TOOL_TIMEOUT` | CPU 冷加载 >60s；服务端 `sync_tool_timeout_seconds` 应为 180；超时后 worker 仍可能随后发布结果，重试前先查目标 |
| `PREVIEW_TOO_LARGE` / SSE 事件超限 | 高分辨率帧超过预览预算；改用服务端 CLI 抽帧或经 SMB 看片；不据此推断画面，也不因此停止流程 |
| `OUTPUT_EXISTS` / `INVALID_STORYBOARD` | 独占创建或 storyboard 字段 / 取值不合契约；换唯一命名或按契约速查修正字段 |
| 客户端打不开 NAS | 检查是否接入该 LAN / VPN；改由服务端核验，并在交付记录写明限制 |
| skill 没出现在 `<available_skills>` | 确认路径、文件名 `SKILL.md`、frontmatter 的 `name` / `description`，且 `permission.skill` 未设 `deny` |

## 红线

- 删除清单未「已确认」就 `submit_assemble`；字幕中间态未经用户确认就定稿；静默删除不确定项。
- 把令牌写进配置、命令行或日志；复用样例项目名、词表、空镜区间或偏移值。
- 覆盖既有成果，或宣称做过实际没做的核听 / 画面审阅。
- 在客户端安装任何操作系统自带工具以外的工具。
