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

Acceptance rule: all remote-required entries must have tested contracts and live test-environment evidence before a workflow is considered ready. Acceptance requires `capabilities.asr.status == "configured"` and fails closed before write actions otherwise. A candidate ASR result never confirms mapping text and never authorizes subtitle publication or assembly.
