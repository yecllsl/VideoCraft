---
name: videocraft-edit
description: 在 VideoCraft 远程 MCP 上盘点 NAS 素材、逐段生成旁挂字幕、提交合成任务或验收成片时使用；也用于排查连接 401、OUTPUT_EXISTS、TOOL_TIMEOUT、INVALID_URI、PREVIEW_TOO_LARGE 等工具报错。
---

# VideoCraft 剪辑全流程

**核心原则**：只执行已在测试环境跑通的行为；未在真实运行里验证过的工具能力不要补写、不要猜测。媒体与产物都在 NAS，本地只放轻量记录，不复制媒体。

OpenCode 按 `description` 把本 skill 列入 `<available_skills>`，由 agent 按需加载；也可直接点名 `videocraft-edit`。

## 0. 运行环境（地址固定，不要改）

面向局域网内的 OpenCode V2 项目目录。以下地址由服务端固定，不要参数化或替换：

| 项 | 固定值 |
|---|---|
| MCP | `http://192.168.88.4:8000/mcp`；项目根 `opencode.json` 里 `oauth: false` + 静态 Bearer |
| 令牌 | `opencode.json` 用 `{env:VIDEOCRAFT_MCP_TOKEN}` 引用，**不写进任何文件、命令行或日志** |
| 命名空间 | `test`（服务端 `[storage].namespace`） |
| 素材 | `nas://raw/<项目>/`（只读） |
| 字幕 | `nas://projects/test/<项目>/captions/` |
| 成片 | `nas://output/test/<项目>/` |
| NAS SMB | `\\192.168.100.58\videocraft-{raw,projects,output}`（raw 只读，projects / output 可写） |
| 成片规格 | 1920×1080 / 25 fps |

只有 `<项目>`（项目名，也是 `nas://raw/` 下的目录名）由每次任务给出。

工具面（7 个）：`videocraft_selfcheck`、`probe_media`、`extract_frames`、`strict_subtitles`、`submit_assemble`、`get_job_status`、`cancel_job`（部署 `strict_subtitles` 前为 6 个）。

首次运行前置：OpenCode V2 打开的是解压后的项目根；`VIDEOCRAFT_MCP_TOKEN` 已设置且被进程继承；局域网可达 `192.168.88.4:8000` 与 `192.168.100.58`；服务端 MCP / Worker 在跑、三个存储根已挂载；项目根下已有 `projects/<项目>/` 与 `.scratch/videocraft-workflow/`。

> `oauth: false` 是直连静态 Bearer 的关键，**不要删**；删掉后 OpenCode 会进入 OAuth，而服务端没有授权服务器，必然卡在 401。

## 1. 预检

调用 `videocraft_selfcheck`，逐项确认；任一不满足即停止，并给出可执行的错误文案（区分未连内网 / 服务未启动 / 令牌无效 / NAS 未挂载）：

- core ok、三个存储根 healthy、worker alive、NVENC ok。
- `tools/list` 含上述 7 个工具；字幕写入命名空间为 `test`。
- `raw` 写入被拒、`projects` / `output` 可写：用唯一临时路径做一次创建/读取/删除探针并清理，**不要动 raw 里的既有文件**。
- 记录 `nas://output/test/<项目>/` 的既有文件基线，供第 6 步证明未覆盖。

## 2. 审批闸门（不可绕过）

先读 `projects/<项目>/mapping.md` 与 `.scratch/videocraft-workflow/` 下的候选稿 / 进度。

**对应表状态不是「已确认」时，停在盘点与草稿：不生成最终字幕、不调用 `submit_assemble`。**「已确认」只能由用户置位，且必须在合成之前；第 7 步只回填实际结果，不得事后补写确认。

`mapping.md` 至少含：素材清单（编号 / URI / 时长 / 类型）、对应表（顺序 / 主画面 / 内容范围 / 空镜 / 采用区间 / 匹配理由）、文案与字幕、成片记录、与方案的偏差、待定项。

- 文案按原音校订，**不照抄 ASR 错词**；口播保留口语。产品名 / 专有名词等高风险词从本项目 ASR 候选稿逐段推导核对，不要沿用任何样例词表。
- ASR 原文只放 `.scratch/videocraft-workflow/` 候选稿，避免与确认稿分叉。
- 低置信对齐、告警或文案与录音明显不匹配时暂停并上报。

## 3. 旁挂字幕

每段调用一次 `strict_subtitles`：

```json
{"video_uri":"nas://raw/<项目>/话术/<clip>.MP4",
 "text":"<逐句文本，一行一句>",
 "output_uri":"nas://projects/test/<项目>/captions/<段>-v<N>.srt"}
```

已验证行为：

- 目标必须是 `nas://projects/test/` 下的 `.srt`；写到别的命名空间 / raw / 非 `.srt` 返回 `INVALID_URI`；已存在目标返回 `OUTPUT_EXISTS`，**不覆盖**。用唯一 `-v<N>` 命名。
- 文本按行对齐 ASR 词锚点；长行按标点切到 ≤28 字一条 cue。
- 返回 `cues` 与 `warnings`，状态 `needs_review`。逐段自查首尾时间与段数；有告警或明显不匹配时暂停，不宣称字幕确认。
- CPU 冷加载首次调用可能超过 60s 触发 `TOOL_TIMEOUT`（服务端 `sync_tool_timeout_seconds` 应设为 180）。超时后 shielded worker **仍可能随后发布 SRT**：重试前先查目标文件是否已存在，别盲目重调。
- `INVALID_URI: target is a directory` 是旧服务端构建的已知缺陷（未含「一次解析目标 + 创建父目录」修复）；升级服务端，不要用手工建目录绕开。

## 4. 空镜审阅

先试看再定入出点。在服务端对每段空镜生成联系表（2.5 fps = 每 0.4s 一帧，4×4）：

```bash
ffmpeg -y -i "<空镜>.MP4" -vf "fps=2.5,scale=480:-2,tile=4x4" -frames:v 1 <sheet>.jpg
```

看曝光、镜头运动、有无内部切换；不要凭单帧中点推定区间。可用 `astats` / `silencedetect` 核对环境声电平。高分辨率 HEVC 上 `extract_frames` 可能返回 `PREVIEW_TOO_LARGE`，此时改用服务端 CLI 抽帧，**不要据此推断画面内容**。本会话不能真正听音时，必须在交付记录里写明这一限制，不得宣称已核听。

## 5. 合成

`submit_assemble` 已验证字段：`title`、`size`（`[1920,1080]`）、`fps`（`25`）、`shots`；每个 shot 用 `video`、可选 `audio`、`start`、`duration`。

- 每个 shot 的 audio 从自身 0 秒播放，`start` 只作用于画面；**不能在同一 audio 文件上做「中段插入」**。
- 空镜作为独立镜头插入（时长加总）并保留自身环境声；口播镜头整段保留。
- shot 不填 `subtitle` 时，任务结果的 `output_srt_uri` 为 null，不会发布空 SRT。

`output_uri` = `nas://output/test/<项目>/<唯一文件名>.mp4`，唯一命名、不覆盖。提交后轮询 `get_job_status(job_id)`；`state=succeeded` 且 `stage=publishing` 才算完成，记录 job_id、duration、size_bytes。

## 6. 校验

在**服务端**执行（需具备服务端命令通道；局域网内也可经 SMB 直接读取成片）：

```bash
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels \
  -show_entries format=duration,size -of json "<成片>.mp4"
ffmpeg -hide_banner -nostats -i "<成片>.mp4" -vf blackdetect=d=0.1:pix_th=0.10 -an -f null -
ffmpeg -hide_banner -nostats -i "<成片>.mp4" -af "silencedetect=noise=-35dB:d=2" -vn -f null -
```

确认 1920×1080 / 25 fps / 有音轨 / 时长 ≈ 各口播段之和 + 空镜插入时长，抽关键衔接点画面目检，并与第 1 步基线比对确认未覆盖既有文件。

旁挂字幕：按 storyboard 里每个口播镜头的**成片时间轴起点**偏移合并逐段 SRT，写成与成片同 stem 的 `.srt`。偏移必须从本次 storyboard 现算，**禁止复用任何历史样例的偏移值**（空镜布局一变即失效）。

## 7. 记录与清理

在已「已确认」的 `mapping.md` 中回填实际空镜区间、各段 SRT 段数、成片路径 / 大小 / 时长、任务 ID 与方案偏差；更新 `.scratch/videocraft-workflow/progress.md`。清理服务端 `/tmp` 与本机中间预览，保留审批记录与候选稿。

## 常见故障

| 现象 | 原因与处置 |
|---|---|
| 401 / 工具列表为空 | 先确认 `oauth: false` 还在、`VIDEOCRAFT_MCP_TOKEN` 已设置且被 OpenCode 进程继承（改环境变量后重开终端/应用）；再查局域网是否可达 `192.168.88.4:8000` |
| skill 没出现在 `<available_skills>` | 确认路径是项目内 `.agents/skills/videocraft-edit/SKILL.md`、文件名全大写、frontmatter 有 `name` / `description`，且 `permission.skill` 未设 `deny` |
| 令牌出现在日志 / 命令行 | 真实事故：扩展把整个 `process.env` 明文写日志。令牌不写进 `opencode.json`、命令行或日志；疑似泄露立即要求管理员轮换 |
| `TOOL_TIMEOUT` | CPU 冷加载 >60s；服务端超时设 180；超时后仍可能发布 SRT，先查目标再重试 |
| `PREVIEW_TOO_LARGE` | 高分辨率 HEVC 抽帧超限；改服务端 ffmpeg 联系表，不据此推断画面 |
| `INVALID_URI` / `OUTPUT_EXISTS` | 命名空间 / 后缀守卫与独占创建；换合法唯一路径，不覆盖、不绕开 |
| 本机打不开 NAS | 未接入该 LAN 或 VPN；改服务端核验，并在交付记录写明限制 |

## 红线

- 未「已确认」就 `submit_assemble`；把 ASR 当确认文案；把 `needs_review` 当合格字幕。
- 把令牌写进 `opencode.json`、命令行或日志；复用样例项目名、词表或偏移值。
- 覆盖既有成果，或宣称做过实际没做的核听 / 画面审阅。
