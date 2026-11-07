# VideoCraft MCP Workflow Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and close required remote MCP gaps for the editing workflow, including safe asynchronous ASR candidate text/SRT generation, then deploy and verify the tested capability in the test environment.

**Architecture:** Keep local stdio MCP and remote HTTP MCP intentionally distinct. Record a workflow capability matrix; add one remote transcription job that resolves raw/projects URIs through `StorageResolver`, runs the existing faster-whisper core implementation, and publishes paired candidate artifacts only on success. Validate in development first, then deploy the exact verified revision to `/opt/videocraft/` and run opt-in fixture-based acceptance with rollback on failure.

**Tech Stack:** Python 3.11-3.12, MCP SDK 2.3.x, existing asyncio job store/worker, `faster-whisper`, ffmpeg/ffprobe, pytest, Linux systemd, NAS logical URI resolver.

**Spec:** `docs/superpowers/specs/2026-11-06-videocraft-mcp-workflow-parity-design.md`

## Global Constraints

- Preserve existing user modifications in the development checkout; current uncommitted changes include remote MCP tools, acceptance logic, and tests.
- Raw storage is read-only; candidate artifacts may be written only under `nas://projects/<configured-namespace>/<project>/`; final video output remains under output.
- All remote file access must use `StorageResolver`; never accept physical paths or return physical paths.
- Never overwrite existing assets. For each candidate, create and fsync a job-specific `.partial` in the destination directory, persist its staging URI, final URI and device/inode in the job journal (including journal file and directory fsync), then publish by exclusive hard link. Recovery and rollback remove only matching logged inodes at both names; preserve mismatches and retain journals when reconciliation cannot be completed. Both NAS environments support same-directory hard links. Report success only when both outputs are visible; cross-filename atomicity is unavailable.
- ASR artifacts are candidates only; they do not satisfy mapping approval and must not trigger subtitles or assembly.
- Deployment target is only test checkout `/opt/videocraft/`; development checkout is `/root/projects/videocraft/` and has no resident service.
- Run development tests and real development inference before deployment; deploy only the verified revision; restart test service only under the approved deployment procedure and rollback on failed acceptance.
- Fixture acceptance must use a dedicated test project and clean only unique outputs created by that run; do not alter source media or finished videos.

## Review Focus

- Existing target URI collision or one-artifact publish failure must leave all pre-existing files untouched and no misleading half-pair; test in Task 3.
- Worker cancellation or service restart during inference must not publish incomplete artifacts or leave a permanently running job; test in Task 4.
- Model unavailable/offline-cache miss and empty/unsupported media must return actionable terminal errors without leaking physical paths; test in Task 3.
- Text transcript and SRT must represent the same recognized segments and preserve Chinese text/timestamps; test in Task 3 and fixture acceptance in Task 6.
- Namespace mismatch or a path traversal/symlink URI must be rejected before reading/writing; test in Task 3.
- A target replaced after a crash must not be removed by recovery; test in Task 3 with device/inode mismatch.
- Crashes after staging, after durable journal update, and after each final hard link must leave either no owned output after recovery or a complete successful pair; test in Task 3.

---

### Task 1: Establish the editing capability matrix

**Files:**
- Create: `/root/projects/videocraft/docs/agents/editing-mcp-capability-matrix.md`
- Modify: `/root/projects/videocraft/mcp/videocraft_mcp/tools.py` only if a discovered existing capability report is incomplete; otherwise defer code edits to later tasks.
- Test: `/root/projects/videocraft/tests/test_remote_tools.py` if the matrix is generated/validated from code; otherwise documentation review only.

**Interfaces:**
- Consumes: tool registrations in `mcp/videocraft_mcp/__init__.py` and `mcp/videocraft_mcp/tools.py`, core functions in `videocraft_core/tasks.py`, client workflow requirements in the approved spec.
- Produces: one maintained matrix with columns for workflow stage, local stdio tool/core, remote HTTP tool, status (`remote required`, `intentionally excluded`, `out of scope`), contract/test evidence, and deployment status.

- [x] **Step 1: Inspect and record all registered local and remote tools plus workflow-stage dependencies.** Include selfcheck, directory inventory, media probe/preview, candidate transcription, strict subtitles, assembly, job status/cancel, output validation and client recordkeeping.
- [x] **Step 2: Mark TTS, generic encoding, NLE export, and script-to-storyboard as intentionally not remotely exposed unless inspection proves one is a hard dependency of the approved NAS editing workflow.** Give each exclusion a short security/scope reason.
- [x] **Step 3: Add matrix rows for every known remote-required tool and identify concrete contract/test evidence.** Mark transcription as the known gap and record any additional gaps found during inspection.
- [x] **Step 4: Review the matrix against the client skill and approved workflow spec.** Expected: no workflow stage is unclassified; every required stage names its remote tool or a documented manual client action.

### Task 2: Add asynchronous candidate-transcription job contract

**Files:**
- Modify: `/root/projects/videocraft/mcp/videocraft_mcp/tools.py`
- Modify: `/root/projects/videocraft/videocraft_core/remote_storyboard.py` or the existing remote job schema module, only if a typed job payload validator belongs there after inspection.
- Modify: `/root/projects/videocraft/tests/test_remote_tools.py`
- Modify: `/root/projects/videocraft/tests/test_remote_protocol.py`

**Interfaces:**
- Consumes: `ToolContext`, `StorageResolver`, existing `JobStore`, worker dispatch/payload conventions, and `tasks.caption`.
- Produces: a remote `transcribe_candidate` tool accepting `video_uri`, `text_output_uri`, and `srt_output_uri`; returns a queued `job_id`. Job status uses existing `get_job_status`; cancellation uses existing `cancel_job`.

- [x] **Step 1: Write protocol and handler tests for tool schema and URI validation.** Assert all three URIs are logical NAS URIs; input is a supported raw media file; both output URIs are `.txt` and `.srt` under the configured projects namespace and same project; reject raw/output writes, wrong namespace, mismatched projects, traversal, symlink escape, and existing targets.
- [x] **Step 2: Run the targeted tests and confirm they fail because the tool is not registered.** Run: `pytest tests/test_remote_tools.py tests/test_remote_protocol.py -q`.
- [x] **Step 3: Implement `transcribe_candidate_remote(ctx, video_uri, text_output_uri, srt_output_uri) -> str` in `mcp/videocraft_mcp/tools.py`.** Reuse resolver checks and enqueue a typed worker payload; do not run inference in the request handler.
- [x] **Step 4: Register the remote MCP tool and add it to the capability/tool-name contract.** Ensure the JSON schema exposes only the three required URI fields; no physical path, arbitrary model path, output directory, or FFmpeg arguments.
- [x] **Step 5: Verify the targeted unit/protocol tests pass.** Include assertions that physical NAS roots are absent from all responses and errors.

### Task 3: Implement paired candidate text and SRT generation

**Files:**
- Modify: `/root/projects/videocraft/mcp/videocraft_mcp/tools.py` or add a focused worker module if that matches existing job-task organization.
- Modify: `/root/projects/videocraft/videocraft_core/tasks.py` only if needed to expose transcript segments in a reusable return contract without changing local CLI behavior.
- Modify: `/root/projects/videocraft/tests/test_remote_tools.py`
- Modify: `/root/projects/videocraft/tests/test_runner.py` or the current worker tests.

**Interfaces:**
- Consumes: queued transcription payload from Task 2; existing caption model/config loader and existing worker status lifecycle.
- Produces: terminal job result containing logical `text_uri`, logical `srt_uri`, model, detected language, segment count, recognized duration, elapsed seconds, and warnings; output artifacts contain UTF-8 plain transcript and SRT with corresponding segment text/timestamps.

- [x] **Step 1: Add core tests proving caption transcription can provide segment text/timestamps to both output renderers without changing existing `caption()` callers.** Mock faster-whisper segments; assert Chinese text, timestamps, detected language, and segment count.
- [x] **Step 2: Run the focused core tests and confirm failure.** Run: `pytest tests/test_tasks.py -k caption -q` (use the actual existing test module/name found during inspection).
- [x] **Step 3: Write crash-window tests before publisher changes.** Cover recovery after durable staged-file journal creation but before final link, after first final link, and after second final link; assert matching job-owned inode removal, preservation of mismatched/replaced target inodes, and journal retention when a URI cannot be resolved.
- [x] **Step 4: Run the new crash-window tests and confirm the current publisher fails them.** Run: `pytest tests/test_worker_asr.py -k 'recovery or journal' -q`.
- [x] **Step 5: Implement `CandidatePublisher` staging and journal protocol in `videocraft_core/publish.py`.** Create each `.partial` exclusively in its final target directory; write, flush and fsync it; record `{uri, stage_uri, dev, ino}` and durably replace/fsync the job journal before creating the final name with `os.link`. Ensure final names are exclusive and never overwritten.
- [x] **Step 6: Implement recovery/rollback reconciliation in `videocraft_core/worker.py`.** Resolve final and staging URIs via `StorageResolver`; unlink either name only when `lstat` device/inode matches; preserve mismatches; retain journal on malformed entries, storage errors, or incomplete reconciliation. Remove journal and fsync its directory only after all entries reconcile.
- [x] **Step 7: Run focused publisher and recovery tests.** Expected: crash at every tested boundary is recoverable, replacement files survive, second-target failure rolls back only owned files, and successful publication removes the journal.
- [x] **Step 8: Implement paired artifact generation and worker execution through shared caption logic.** Preserve configured model/language defaults, report candidate status, and redact all paths/errors.
- [x] **Step 9: Add failure tests for unavailable model, malformed media, empty recognition, collision, cancellation, second-artifact publish failure, and cleanup.** Assert job reaches a terminal state and no partial pair is visible.
- [x] **Step 10: Run focused worker/core tests.** Expected: both candidate files contain matching recognized segments, and failure cases leave no owned temporary artifact.

### Task 4: Harden capability discovery and client acceptance

**Files:**
- Modify: `/root/projects/videocraft/mcp/videocraft_mcp/tools.py`
- Modify: `/root/projects/videocraft/videocraft_core/acceptance.py`
- Modify: `/root/projects/videocraft/tests/test_acceptance.py`
- Modify: `/root/projects/videocraft/tests/test_remote_tools.py`
- Modify: `/root/projects/videocraft/tests/test_remote_protocol.py`
- Modify: `/root/projects/videocraft/docs/agents/editing-mcp-capability-matrix.md`

**Interfaces:**
- Consumes: registered remote tools from Tasks 1-3 and existing acceptance fail-closed behavior.
- Produces: selfcheck advertises the complete remote tool set and transcription capability/config status; acceptance checks required tool schemas and transcription readiness without writing user NAS assets in its default mode.

- [x] **Step 1: Add failing tests that remove the candidate tool from selfcheck/tools/list and expect acceptance to fail before any write-capable action.** Add schema assertions for exact parameters.
- [x] **Step 2: Add tests for absent model dependency/configuration and assert a clear unavailable capability rather than false healthy status.** Do not load the large model as part of ordinary selfcheck.
- [x] **Step 3: Update capability reporting and acceptance checks.** Required workflow tools must be present; intentional exclusions must not be required; acceptance remains read-only unless explicit fixture integration mode is selected.
- [x] **Step 4: Update matrix evidence/status after tests exist.** Run: `pytest tests/test_acceptance.py tests/test_remote_tools.py tests/test_remote_protocol.py -q`.

### Task 5: Validate in development, preserve local work, and stage deployment

**Files:**
- Modify: development checkout files from Tasks 1-4 only, carefully integrating existing dirty changes.
- Modify: client `.agents/skills/videocraft-edit/SKILL.md` only if its tool list/contracts or preflight procedure must change.
- Modify: client `.scratch/videocraft-workflow/progress.md` with verification records if applicable.

**Interfaces:**
- Consumes: completed implementation and matrix.
- Produces: verified development revision plus a deployment manifest listing exact files/commit or patch, service actions, fixture URI, and rollback target.

- [x] **Step 1: Re-check `git status` and inspect all development dirty diffs before editing or staging.** Do not discard or stage unrelated pre-existing work; coordinate same-file edits without erasing them.
- [x] **Step 2: Run full development unit suite and static/type checks documented by the repository.** Expected: all relevant tests pass; record commands/results.
- [x] **Step 3: Run development MCP protocol acceptance and verify tool list/schema/capability matrix against actual registrations.** Expected: every required capability is present; exclusions remain absent.
- [x] **Step 4: Execute actual development-environment ASR on a short dedicated fixture clip, writing unique candidate text/SRT under `projects/dev` through the resolver.** Check model cold-load, CPU/memory/time, segments, text/SRT correspondence, URI redaction, collision behavior, status/cancel behavior, then clean only those unique outputs.
- [x] **Step 5: Prepare deployment manifest and rollback snapshot/version.** Confirm tests and services use `/opt/videocraft/`; do not deploy if development inference or target permission checks fail.

### Task 6: Deploy and verify test environment

**Files:**
- Deploy only the verified implementation files to `/opt/videocraft/` using the established service deployment procedure.
- Update the workflow capability matrix and client skill only after remote behavior is verified.

**Interfaces:**
- Consumes: verified development revision and deployment manifest from Task 5; dedicated test fixture project approved in the design.
- Produces: running test MCP/Worker version with verified remote transcription and updated matrix evidence.

- [x] **Step 1: Verify test checkout state, active service paths, service user, NAS mounts, namespace, and fixture source before changing anything.** Stop if the target is dirty unexpectedly or fixture ownership is unclear.
- [x] **Step 2: Back up the test deployment version and deploy the exact verified files/revision.** Keep a precise rollback reference.
- [x] **Step 3: Restart the authorized test MCP/Worker services and verify they are running the new code.** Do not touch the development environment service state.
- [x] **Step 4: Through the live test HTTP MCP, run selfcheck, tools/list/schema, existing preflight checks, and an actual short-fixture transcription to unique `projects/test` candidate text/SRT URIs.** Verify queued/running/succeeded states, cancel test on a separate job if safe, matching artifacts, timing, permissions, and no physical path leakage.
- [x] **Step 5: Remove only the unique candidate text/SRT and temporary files created by this acceptance run; verify they are absent.** Preserve the fixture source and audit record.
- [x] **Step 6: If any deployment or acceptance check fails, restore the saved test version, restart services, and verify old-version health before reporting failure.** Never leave code and running service versions mismatched.
- [x] **Step 7: Update the matrix and deployment record with live tool/version/evidence, and update the client skill's preflight/tool contract if necessary.** Do not enable automatic transcription-to-subtitle/assembly progression.

## Self-Review

- Spec coverage: capability inventory is Task 1; URI-secure queued ASR is Tasks 2-3; fail-closed capabilities and contracts are Task 4; development validation and user-diff preservation Task 5; deployment, fixture acceptance, cleanup, rollback, and records Task 6.
- Failure cases: all five Review Focus conditions have owning tests in Tasks 2-4 and live verification in Tasks 5-6.
- Contract consistency: `transcribe_candidate(video_uri, text_output_uri, srt_output_uri)` enqueues a job; `get_job_status(job_id)` returns final logical artifact URIs and stats; `cancel_job(job_id)` controls queued/running work.
- Scope: local-only TTS/encode/NLE/script tools are classified, not exposed. No subtitle or assembly operation is authorized by transcription success.
- Open implementation detail is limited to matching existing worker payload conventions and test module names, which must be inspected before implementation; no product behavior is left ambiguous.
