# VideoCraft MCP Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the client workflow to verify required VideoCraft capabilities, safely enumerate a project’s media and output baseline, and test storage boundaries before editing.

**Architecture:** Extend the existing selfcheck with structured capability status; add a bounded, read-only logical-URI listing tool; add an explicit storage probe that never overwrites existing objects. Implement and test in the server development checkout, then deploy and verify in the server test checkout only after development verification and deployment authorization.

**Tech Stack:** Existing VideoCraft Python MCP service, storage URI resolver, pytest, configured NAS roots, and the existing client-side VideoCraft workflow records.

**Spec:** `docs/superpowers/specs/2026-11-06-videocraft-mcp-preflight-design.md`

## Global Constraints

- raw is read-only; projects/output writes are limited to the configured namespace (`dev` in development, `test` in testing).
- Reuse existing URI resolver and root/namespace guards; never construct physical paths to bypass them.
- Do not expose physical paths, credentials, bearer tokens, or sensitive exception details.
- Do not alter subtitle alignment, assembly, Worker scheduling, or encoding behavior.
- Do not generate final subtitles or submit assembly during preflight verification.
- Develop and verify in `/root/projects/videocraft/` on the user-approved `main` branch; deploy only to `/opt/videocraft/` after development checks pass and deployment is separately authorized.
- Never overwrite or remove pre-existing NAS objects. Probe objects must be uniquely named, exclusively created, read back, and precisely cleaned up.

## Review Focus

- Path traversal, URI scheme confusion, and symlink escape must be rejected by list-tool tests.
- Large directories and malicious page sizes must be bounded by pagination/limit tests.
- Probe collisions and partial failures must not overwrite prior objects, and cleanup failures must be reported.
- NVENC detection unavailable or failing must not be represented as healthy.
- Error and success responses must not disclose physical paths, token values, or environment contents.

---

## Repository Mapping Gate

An authorized SSH route is available. The user explicitly approved direct changes on the development checkout `main`; use `/root/projects/videocraft/` and do not edit `/opt/videocraft/` before development verification and separate deployment authorization. Exact implementation paths: `mcp/videocraft_mcp/tools.py`, `videocraft_core/tasks.py`, `videocraft_core/storage.py`, tests `tests/test_remote_tools.py`, `tests/test_storage_resolver.py`, `tests/test_selfcheck_readonly.py`, `tests/test_remote_protocol.py`, and acceptance `videocraft_core/acceptance.py` / `tests/test_acceptance.py`. Run tests with `.venv/bin/python -m pytest`.

### Task 1: Inspect development checkout and pin interfaces

**Files:**
- Read-only inspection in `/root/projects/videocraft/`.
- Update this plan with exact source and test paths discovered.

**Interfaces:**
- Consumes: approved design at `docs/superpowers/specs/2026-11-06-videocraft-mcp-preflight-design.md`.
- Produces: confirmed locations and signatures for selfcheck, MCP tool registration, URI resolver, storage configuration, and test fixtures; confirmed NVENC probe behavior and available NAS test strategy.

- [ ] **Step 1: Verify remote identity and checkout state**

Run non-mutating status/log commands in `/root/projects/videocraft/`; confirm repository root, branch/HEAD, worktree state, and that this is the development checkout.

- [ ] **Step 2: Map existing implementations and tests**

Locate selfcheck result construction, MCP tool registration/schema, URI resolution and namespace enforcement, existing storage tests, and encoder/NVENC detection. Record exact paths and test commands here.

- [ ] **Step 3: Confirm safe NAS probe semantics**

Inspect existing exclusive-create and cleanup patterns and confirm the configured development namespace behavior. Do not write to NAS during this inspection. If safe exclusive creation cannot be established from code and tests, stop and revise the design before implementing probes.

**Gate:** Existing resolver rejection of raw writes (`READ_ONLY_ROOT`) and output exclusive-create pattern (`os.open(... O_EXCL ...)`) were confirmed. A live storage probe remains subject to separate approval.

## Task 2: Expand selfcheck capability report

**Files:**
- Modify: exact selfcheck implementation path, determined in Task 1.
- Test: exact selfcheck test path, determined in Task 1.

**Interfaces:**
- Consumes: existing selfcheck configuration and encoder probe.
- Produces: backward-compatible structured statuses for core, roots, Worker, NVENC (`ok`, `unavailable`, `error`), registered tool names/schema capability, and subtitle write namespace.

- [ ] **Step 1: Write tests for NVENC states and MCP configuration fields**

Assert available NVENC reports `ok`, absent capability reports `unavailable`, probe exception reports `error`; assert configured namespace and registered tools are represented without secrets.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Use the repository’s established pytest invocation for the exact test path identified in Task 1.

- [ ] **Step 3: Implement backward-compatible selfcheck fields**

Reuse existing encoder detection; do not infer NVENC health from core or Worker health. Retain current fields and add the design’s structured capability data.

- [ ] **Step 4: Run focused and related test suites**

Expected: new tests and existing selfcheck/MCP tests pass; response contains no physical paths or secrets.

## Task 3: Add bounded read-only logical URI listing

**Files:**
- Create or modify: listing implementation and registration paths identified in Task 1.
- Test: storage URI / MCP tool test paths identified in Task 1.

**Interfaces:**
- Produces: a versioned MCP list operation taking a logical directory URI, bounded page size and optional cursor; returns logical child URI, entry type, size and reliable modification time, plus media probe metadata where applicable. Exact names/schema are selected to match repository conventions and recorded in Task 1.

- [ ] **Step 1: Write tests for allowed raw project and test output listings**

Assert child entries are logical URIs and media entries include available metadata.

- [ ] **Step 2: Write rejection and bound tests**

Cover root/parent listing, non-directory URI, unknown scheme, namespace escape, path traversal, symlink escape, unavailable root, permission denial, pagination, and over-limit requests; assert no physical path is returned.

- [ ] **Step 3: Run focused tests and verify they fail for missing behavior**

Use the repository’s established pytest invocation for the identified paths.

- [ ] **Step 4: Implement read-only listing through the existing resolver**

Allow only raw project directories and exact test project output directories; bound page size, traversal depth, metadata work, response size and duration. Do not return file contents or permit mutation.

- [ ] **Step 5: Run focused and related storage/MCP tests**

Expected: allowed listings work; all boundary and pagination tests pass.

## Task 4: Add explicit storage permission probe

**Files:**
- Create or modify: probe implementation and MCP registration paths identified in Task 1.
- Test: storage permission and MCP tool test paths identified in Task 1.

**Interfaces:**
- Produces: explicit probe result with independent per-root/per-stage `passed`, `failed`, or `not_run` statuses and cleanup outcome. Probe paths are logical URIs only.

- [ ] **Step 1: Write tests for successful probe lifecycle**

Assert raw write denial; projects/test and output/test each exclusively create a unique object, read back exact fixed content, delete only that object, and verify it is absent.

- [ ] **Step 2: Write failure, collision, and cleanup tests**

Cover pre-existing collision, permission denial, read mismatch, root unavailable, exception at each stage, retry with a fresh identifier, and cleanup failure. Assert a colliding or pre-existing object is never modified or removed and residue is reported.

- [ ] **Step 3: Run focused tests and verify they fail for missing behavior**

Use the repository’s established pytest invocation for the identified paths.

- [ ] **Step 4: Implement explicit probe with exclusive creation**

Use the dedicated reserved probe area confirmed in Task 1, unpredictable unique names, exclusive create semantics, fixed non-sensitive payload, exact-object cleanup, and independent status reporting. If raw write rejection cannot be safely tested without touching existing files, report a configuration/boundary verification rather than attempting a write to user content.

- [ ] **Step 5: Run focused and related storage/MCP tests**

Expected: lifecycle passes, all injected failures are represented accurately, and no test leaves artifacts.

## Task 5: Development environment integration verification

**Files:**
- Modify only if required: `.agents/skills/videocraft-edit/SKILL.md` and local progress/mapping records.
- Tests: server integration checks plus client workflow validation, if automated coverage exists.

**Interfaces:**
- Consumes: selfcheck, list, and probe capabilities from Tasks 2–4.
- Produces: recorded development verification evidence and a clear initialization gate.

- [ ] **Step 1: Run complete development test suite and static checks**

Run repository-prescribed pytest, lint/type/compile checks found during Task 1. Expected: all pass.

- [ ] **Step 2: Run authorized real development NAS probe**

Code changes on development `main` are authorized; this does not authorize NAS writes or test deployment. Before a live probe, obtain explicit approval. Use configured `dev` namespace here, never `test`; verify raw rejection and projects/dev plus output/dev create/read/delete on unique paths, then compare before/after and ensure no pre-existing object changed.

- [ ] **Step 3: Run real selfcheck and listing integration checks**

Confirm NVENC is accurately reported, required tools are listed, and fixture/project URIs list only allowed entries with no physical path disclosure.

- [ ] **Step 4: Update the client preflight gate**

Document how the existing workflow calls the capabilities, blocks when a required tool or check is missing/failed, distinguishes transport/authentication/service/root failures where the client can observe them, records the output baseline, and proceeds to mapping only after all required checks pass. Do not loosen the confirmation gate for subtitles or assembly.

- [ ] **Step 5: Record verification and deployment readiness**

Record exact commit/revision, commands, results, capability statuses, and whether all temporary probes were removed. Do not claim test namespace verification from dev results.

## Task 6: Deploy and verify test environment

**Files:**
- Deployment target: `/opt/videocraft/` only after Task 5 passes and deployment authorization is confirmed.
- Update: local workflow documentation and `.scratch/videocraft-workflow/progress.md` with observed results.

**Interfaces:**
- Consumes: verified development revision and tool schemas from Tasks 2–5.
- Produces: test MCP capability/tool verification and clean test-namespace probe evidence.

- [ ] **Step 1: Capture test checkout and output baseline**

Verify test checkout identity/status and record the target test project output baseline before deployment or probes; do not overwrite or clean pre-existing files.

- [ ] **Step 2: Deploy the verified revision**

Use the established test deployment procedure only after separate explicit deployment authorization; preserve local configuration and secrets, and restart services only when required by that established procedure.

- [ ] **Step 3: Verify test selfcheck, tool schemas, and permissions**

Run selfcheck, list the newly exposed tools, and explicitly probe raw/test-projects/test-output behavior using unique probe paths. Confirm all probe objects were deleted.

- [ ] **Step 4: Initialize `宝马5-20261106` using read-only discovery**

List `nas://raw/宝马5-20261106/` and `nas://output/test/宝马5-20261106/`; capture the exact raw file inventory/media metadata and output baseline in local project records. If the project is absent or empty, record that fact. Do not generate subtitles or submit assembly.

- [ ] **Step 5: Record deployment and integration results**

Update progress and project mapping with revision, tool results, probe cleanup status, discovered inventory, output baseline, and any limitations. Keep approval status pending.

## Task 7: Final verification and review

**Files:**
- Review changes to server implementation/tests, deployment evidence, client workflow records, and this progress ledger.

- [ ] **Step 1: Verify no unrelated or destructive changes**

Inspect diff/status in development and test checkouts; confirm no raw data changed, no existing output was overwritten/deleted, and no unintended artifacts remain.

- [ ] **Step 2: Run final required checks**

Re-run relevant tests and compare test output directory against the baseline. Confirm no subtitle/assembly jobs were submitted.

- [ ] **Step 3: Review implementation against the design**

Check every design acceptance condition and report any unverified condition explicitly; do not claim completion for unexecuted remote operations.
