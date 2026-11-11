# VideoCraft Editing MCP Capability Matrix

Scope: the approved NAS editing workflow, not parity between local stdio and remote HTTP tool counts. Updated 2026-11-07 from the registered development stdio tools, development remote tools, client `videocraft-edit` skill, and workflow requirements. Remote transcription is implemented, verified in development with a real model, and deployed and verified live in the test environment.

| Workflow stage | Local stdio / core capability | Remote HTTP capability | Classification | Evidence / remaining validation |
|---|---|---|---|---|
| Environment, worker and storage health | `selfcheck` | `videocraft_selfcheck`, `storage_probe` | Remote required | `tests/test_remote_tools.py`, live test MCP selfcheck and probe |
| Raw inventory and output baseline | local filesystem tools | `list_directory` | Remote required | `tests/test_remote_tools.py`; live project listing and pagination |
| Media metadata | `probe_media` | `probe_media` | Remote required | protocol contract and live NAS media probe |
| Visual review | `extract_frames` | `extract_frames` | Remote required | live test preview returns 2 frames; test env `[preview]` is tuned to 1 MiB frame / 6 MiB total and the acceptance client raises the SSE event limit to 8 MiB; default 512 KiB is below 2688×1512 fixture frames (adaptive downscale remains a known gap) |
| ASR candidate text and timestamped SRT | `caption_srt` / `tasks.caption` | `transcribe_candidate(video_uri, text_output_uri, srt_output_uri)` async job | Remote required | development handler/schema/worker/recovery tests pass; real faster-whisper inference succeeded in development and live in the test env (14 segments, 25.36 s audio, model small, zh); candidate-only and never mapping approval |
| Confirmed-script subtitle alignment | `strict_subtitles` | `strict_subtitles` | Remote required | existing tests and live per-clip review; output remains `needs_review` |
| Storyboard assembly | `assemble_storyboard` | `submit_assemble` | Remote required | existing storyboard validation, worker publishing and test acceptance; user approval gate is client-side |
| Long-job status and cancellation | local process supervision | `get_job_status`, `cancel_job` | Remote required | existing job/worker tests; ASR must use the same lifecycle |
| Final media inspection | local `probe_media`/ffmpeg | No general remote shell/ffprobe endpoint | Manual client/server action | Verified through approved server CLI or SMB; do not expose arbitrary command execution |
| Black/silence/transition QC | local ffmpeg | No remote shell endpoint | Manual review / documented operational procedure | workflow records must state checks actually performed; not represented as automatic MCP capability |
| Subtitle visual review and merged sidecar | local editor / filesystem | No general project-file read/write endpoint | Manual client action | SMB project share and locally calculated storyboard offsets; no guessed offsets |
| Work records and approval state | client project records | No server tool | Client responsibility | `projects/<project>/mapping.md` and `.scratch/videocraft-workflow/`; approval remains human-controlled |
| TTS generation | `tts_speak`, `tts_batch` | Not exposed | Intentionally excluded | Automatic narration is outside this workflow; raw speaker audio remains authoritative |
| Generic re-encoding | `encode_video` | Not exposed | Intentionally excluded | Arbitrary source/output paths and encoding choices are outside restricted NAS service contract |
| NLE project export | `export_nle` | Not exposed | Intentionally excluded | Writes editor-specific local project files; not required for remote assembly workflow |
| Script-to-storyboard skeleton | `script_to_storyboard_tool` | Not exposed | Intentionally excluded | Client can prepare/inspect the storyboard; remote assembly accepts validated structured storyboard |
| Burn subtitles / local assembly | `burn_subtitles`, `assemble_storyboard` | Not exposed as separate tools | Intentionally excluded | Remote assembly owns its constrained output path and explicit approval boundary |

Remote tool inventory deployed to the test environment: `videocraft_selfcheck`, `probe_media`, `extract_frames`, `list_directory`, `storage_probe`, `strict_subtitles`, `transcribe_candidate`, `submit_assemble`, `get_job_status`, `cancel_job`. Required differences are tracked by workflow stage above, not by local tool equivalence. The test HTTP service was verified live on 2026-11-07 with selfcheck, tools/list, preflight checks, ASR transcription, collision, and cancellation.

No "create project directory" tool exists or is needed: write targets create their parent directories at publish time (`mkdir(parents=True)`), and the project directory is determined by the project segment of the URI. Starting a new project only requires a unique project name and a contract-shaped output URI (verified 2026-11-10 against `/opt/videocraft/mcp/videocraft_mcp/tools.py` and `videocraft_core/tasks.py`).

Contract increment deployed 2026-11-09 (development suite 408 PASS, live `accept-remote` 12/12 PASS): `transcribe_candidate` now returns `words` (word / start / end / probability) and `last_word_end` in `job.result`; its input schema and the 10-tool inventory are unchanged, and no third artifact is published. `submit_assemble` shots accept optional `audio_start` (default 0) so audio and video share a source in-point, enabling multiple clips from one take; the shot render fingerprint includes this field. Word-level data lives only in job results and is lost if jobs are purged.

Acceptance rule: all remote-required entries must have tested contracts and live test-environment evidence before a workflow is considered ready. Acceptance requires `capabilities.asr.status == "configured"` and fails closed before write actions otherwise. A candidate ASR result never confirms mapping text and never authorizes subtitle publication or assembly.

## 工具契约速查（单一事实源）

两个流程 skill 都引用本节，不在各自文档里复制参数表；工具契约变更只改这里。

| 工具 | 入参 | 返回 / 产物 | 关键约束与错误码 |
|---|---|---|---|
| `videocraft_selfcheck` | 无 | `ok`、`core_ok`、`roots`、`worker`、`capabilities`（`nvenc` / `tools` / `subtitle_namespace` / `asr`） | 预检要求 `ok`、`core_ok`、三根 healthy、worker alive、`asr.status=configured`、`subtitle_namespace=test` |
| `probe_media` | `uri` | `media`（`duration`、`size_bytes`、`streams`、`uri`） | 只读；时长用于算尾部空白 |
| `extract_frames` | `uri`、`n` | 帧预览 | `PREVIEW_TOO_LARGE`（测试环境 1 MiB/帧、6 MiB/总）；普通客户端 SSE 事件上限可能不足；仅辅助判读，拿不到帧不得据此推断画面或停止流程 |
| `list_directory` | `uri`、`limit=25`、`cursor` | 目录项 + 分页 cursor | **URI 不能以 `/` 结尾**（`INVALID_URI: empty/dot/dotdot path segment`）；非 `raw` 根至少要有 `namespace/<项目>` 两级，只到 `nas://output/test` 会返回 `INVALID_URI: directory must be within an allowed project`；output 项目目录不存在时返回空 `entries`（**只表示目录为空或尚不存在，不代表不可写，也不是阻塞**）；每页最多 25 项、最多探测 10 个媒体；总目录 >1000 项拒绝 |
| `storage_probe` | 无 | raw `write_denied`、projects/output 的 create/read/delete/cleanup | 预检必须全 passed |
| `transcribe_candidate` | `video_uri`、`text_output_uri`、`srt_output_uri` | `job_id` / `state=queued` / `candidate=true`；成功后 `job.result` 含 `text_uri`、`srt_uri`、`model`、`language`、`segments`、`duration`、`seconds`、`words`（词 / start / end / probability）、`last_word_end` | 输入须 `nas://raw/`；两个输出模板 `nas://projects/test/<项目>/asr/<文件名>.txt` 与同目录同名 `.srt`：路径至少 `namespace/<项目>/<文件名>` 三段、首段须为 `test`、两输出父目录必须相同、不带尾部 `/`；**目标目录由服务端落盘时自动创建，无需预建项目或 `asr/` 目录**。`INVALID_URI: outputs must be .txt/.srt in one configured project` 只表示上述 URI 结构不合规（层级不足 / namespace 错 / 两输出不同目录 / 后缀错），与目录是否存在无关；`OUTPUT_EXISTS` 不覆盖；`TRANSCRIBE_FAILED`；结果仅候选，不授权字幕或合成。词级数据只在 `job.result`，任务记录被清理即丢失，不落第三个文件 |
| `strict_subtitles` | `video_uri`、`text`、`output_uri` | `cues`、`warnings`、`needs_review` | 目标须 `nas://projects/test/` 下 `.srt`；本次智能剪辑范围外（后续） |
| `submit_assemble` | `storyboard`（dict）、`output_uri`、`overwrite=false` | `job_id` / `state=queued` | 顶层 `title` / `size`（固定 `[1920,1080]`）/ `fps`（1–60，成片用 60）/ `shots`；shot 允许 `video`、`image`、`card`、`text`、`subtitle`、`audio`、`start`、`duration`、`audio_start`、`section`。`start` 是画面入点，`audio_start`（默认 0）是音频入点，**同源取段时两者填同值**，`duration` 为该镜头成片时长；`output_uri` 必须 `.mp4`；`OUTPUT_EXISTS` / `INVALID_STORYBOARD` / `TOO_MANY_SHOTS` / `STORYBOARD_TOO_LARGE` |
| `get_job_status` | `job_id` | `job`（`state`、`stage`、`result`、`error_code`、`error_detail`…） | 终态 `succeeded` / `failed` / `cancelled`；合成须 `state=succeeded` 且 `stage=publishing` |
| `cancel_job` | `job_id` | `ok` / `state` / `accepted` | queued 任务原子取消且不产生产物 |

连接：`http://192.168.88.4:8000/mcp`，`oauth: false` + 静态 Bearer（令牌只在环境变量中，不进文件、命令行、日志）。命名空间 `test`。客户端经 SMB 顺畅访问 NAS 音视频，不安装任何操作系统自带工具以外的工具。
