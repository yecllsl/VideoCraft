# 测试环境 CUDA 字幕上线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans 逐任务执行本计划。worktree / TDD / subagent-driven 已按 ADR-0002 与 2026-11-16 Q2 裁剪为「不适用」；G4 任务级评审跳过，G5 与 `verification-before-completion` 保留。步骤用 checkbox（`- [ ]`）跟踪。

**Goal:** 把开发环境已验证的 CUDA 字幕链路以最小增量部署到服务端测试环境，live 验收并演练回滚。

**Architecture:** 零仓库代码改动。三段式：开发环境用与目标态一致的 `[caption]` 覆盖冒烟 → 测试 venv 从开发环境同机复制 CUDA 运行库并追加配置覆盖（备份 → 重启 worker → mcp）→ live MCP 验收与回滚演练。

**Tech Stack:** SSH 别名 `ZZZ.Video`（Debian 12 + RTX 3060）；原生 systemd 双单元 `videocraft-mcp` / `videocraft-worker`（`User=videocraft`）；Python 3.11 venv + CTranslate2 CUDA（cuBLAS/cuDNN wheel 库）；服务端 CLI `bash scripts/videocraft`；远程 MCP `http://192.168.88.4:8000/mcp`（静态 Bearer，令牌经 `VIDEOCRAFT_MCP_TOKEN` 环境变量继承）。

**Spec:** `.scratch/videocraft-cuda-deploy/01-cuda-caption-deploy-spec.md`（执行者须同时读 spec、`docs/adr/0002-deploy-form-and-cuda-caption.md` 与本计划）

## 术语速查（G2 映射：源自 `GLOSSARY.md`，执行 agent 零领域背景）

| 术语 | 含义 |
|---|---|
| 部署命名空间 | 由 `[storage].namespace` 决定、投影到 `nas://` URI 首段的部署期事实；测试环境固定 `test`，客户端不可配置 |
| 契约上线 | 服务端契约变更在测试环境部署并通过 live 验收、且 `tools/list` 实际包含新工具的那一刻 |
| 契约编辑源 | `docs/agents/editing-mcp-capability-matrix.md`，唯一可编辑的工具契约正文；MCP 工具参数与返回字段只查它，不在本计划复制 |
| 令牌驻留面 | 令牌以字面值存在的载体集合（环境变量 / 进程内 / 文件 / 命令行 / 日志）；目标是集合不扩大——令牌不写进任何文件、命令行或日志 |

## Context（需求条目，原样引自 spec，不得重新措辞）

> 测试环境的字幕/转写任务（`strict_subtitles`、`transcribe_candidate`）跑 CPU int8：26.9s 素材 warm 转写约 10.5s（全程），长素材逼近 `sync_tool_timeout_seconds=180`。GPU CUDA 链路仅在开发环境验证过（8s 音频 0.4s vs CPU 1.4s）；测试环境 venv 缺 cuBLAS/cuDNN，`_preload_cuda_libs` 返回 0。

> 最小增量把 CUDA 字幕部署到测试环境：开发环境先用与目标态一致的 `[caption]` 覆盖冒烟 → 测试 venv 从开发环境同机复制 CUDA 运行库 → 测试环境 `videocraft.local.toml` 追加 `[caption] device="cuda" compute_type="float16"` → 备份、重启、回滚演练 → live 验收。零仓库代码改动。

用户故事（原样）：1）GPU 跑转写，长素材不逼近同步超时；2）同段素材转写段数与 CPU 基线一致（37 段）；3）变更前完整备份（含 sha256），可按记录路径回滚到 CPU 基线；4）服务健康度与其他 GPU 链路（NVENC）不受影响；5）GPU 生效证据（显存占用、耗时对比）记录进台账。

## Scope

- **In**：ticket 02（开发环境 CUDA 冒烟）→ 03（测试环境部署）→ 04（live 验收与回滚演练），按 blocking edges 顺序执行。
- **Out（原样引自 spec Out of Scope）**：systemd 单元重装、`RequiresMountsFor`、`Nice`/`IOScheduling*`/`LimitNOFILE`/`UMask` 等 drop-in 调优；服务端/客户端 `AGENTS.md` 文档漂移修正（另立工作项）；源方案 P1（NAS staging 复核）与 P2（Worker 分道并行、NVENC 会话解锁、tts 并发、libx264 调参）；仓库任何代码与文档改动（本 spec 范围内为零）。

## Global Constraints（每个任务默认继承）

- **遵循 ADR-0002，不得替换方案**：不引入容器化；不重装 systemd 单元、不动 automount 挂载、不动账号/令牌/目录权限。
- 零仓库代码改动；不新增单元测试（spec Testing Decisions）；既有防线为 `selfcheck`（含 `--full` 的 NVENC 实测）。
- CUDA 运行库从开发环境 venv **同机复制**（同 Python 3.11、同 wheel 版本），**不联网安装**。
- `[caption]` 覆盖必须 `device` 与 `compute_type` **成对**：`device="cuda"` + `compute_type="float16"`（主配置显式 `int8`，单独覆盖 device 会得到 cuda+int8 组合）。
- 备份落 `/root/deploy-backups/`（沿用 2026-11-07 部署惯例）并记录 sha256；重启顺序 **worker → mcp**。
- **执行期发现 spec 外事实（如 CUDA 在服务账号下不可用）：停下回阶段一改 spec，不得就地打补丁。** 禁止修改验收断言迁就实现。
- 期望值基线（取自实测）：`广汽丰田-汉兰达-测试1/话术/2.MP4`（84.821s）CPU small/zh 转写 **37 段**、转写段 `seconds` **15.4s**（2026-11-18 开发环境实测，real 18.8s）；开发环境 `_preload_cuda_libs` 预加载 **17** 个库。
- 令牌不写进任何文件、命令行或日志；客户端零额外工具（只用 OS 自带能力）。
- 本计划零仓库改动，故各任务无 git commit 步骤；改动均在远端主机与 `.scratch/`（不进 Git），任务收尾以台账登记替代提交。

## Review Focus

1. **CUDA 在服务账号下不可用**（设备节点权限 / 环境差异）——期望 `User=videocraft` 形态下 `_preload_cuda_libs` 返回 17；失败即按 spec 停机规则回阶段一。测试：Task 2 Step 4。
2. **覆盖只改一半（cuda+int8 组合）**——期望两键必须成对写入。测试：Task 1 Step 3、Task 2 Step 5 的追加后 `grep` 验证 `device`/`compute_type` 同现。
3. **首次冷加载超过 `sync_tool_timeout_seconds=180` / 客户端超时**——期望 `TOOL_TIMEOUT` 后 worker 仍可能随后发布结果：先轮询既有 job，不重复提交。测试：Task 3 Step 2 的轮询与超时处置路径。
4. **CUDA 与 NVENC 在同一 RTX 3060 上并发争用**——期望启用 CUDA 后 NVENC 实测仍 ok。测试：Task 2 Step 6 `selfcheck --full`。
5. **复制的运行库与测试 venv 既有 wheel 版本错配**——期望 `_preload=17` 只是必要条件，真实推理必须跑通而非仅预加载成功。测试：Task 3 Step 2 live 转写断言（segments=37 且 seconds<15.4）。

## 验收断言 → 任务映射（G2 对照）

| 断言 | 覆盖步骤 |
|---|---|
| A1 冒烟还原 | Task 1 Step 7 |
| A2 开发冒烟 | Task 1 Step 5–6 |
| A3 依赖就位 | Task 2 Step 2（前置 0）、Step 4（17） |
| A4 服务健康 | Task 2 Step 6 |
| A5 live 生效 | Task 3 Step 1–2 |
| A6 GPU 证据 | Task 3 Step 3 |
| A7 回滚演练 | Task 3 Step 4 |
| A8 台账回写 | Task 3 Step 5–6 |

---

### Task 1: 开发环境 CUDA 冒烟（ticket 02）

**Files:**
- Modify（远端、临时、可还原）: `/root/projects/videocraft/videocraft.local.toml`
- Create（远端、临时、任务末删除）: `/tmp/cuda-smoke-20261116.srt`、`/tmp/gpu-poll-smoke.log`
- Create（远端）: `/root/deploy-backups/cuda-smoke-<时间戳>/videocraft.local.toml`
- Modify: `.scratch/videocraft-cuda-deploy/progress.md`（证据行）、`.scratch/videocraft-cuda-deploy/02-dev-cuda-smoke.md`（勾选）

**Interfaces:**
- Consumes: G1 已通过的 spec（无其他前置）。
- Produces: CUDA 转写实测数据（全程耗时、segments、显存 MiB）写入 `progress.md` Evidence 段——Task 2 的前置条件与对照基线；`[caption]` 追加命令（Task 2 Step 5 复用同款）。

（命令均在 `ssh ZZZ.Video` 进入的远端 root shell 中执行；`<时间戳>` 取执行当时，如 `20261116-1430`。）

- [ ] **Step 1: 开发环境 selfcheck**

```bash
cd /root/projects/videocraft && bash scripts/videocraft selfcheck
```

Expected: 输出含 `all_ok: true`。

- [ ] **Step 2: 备份 local.toml 并确认无既有 `[caption]`**

```bash
mkdir -p /root/deploy-backups/cuda-smoke-<时间戳>
cp -a /root/projects/videocraft/videocraft.local.toml /root/deploy-backups/cuda-smoke-<时间戳>/
sha256sum /root/deploy-backups/cuda-smoke-<时间戳>/videocraft.local.toml
grep -n '^\[caption\]' /root/projects/videocraft/videocraft.local.toml
```

Expected: sha256 一行（记录）；grep 无输出。若 grep 有输出（local.toml 已含 `[caption]`）→ spec 外事实，停下回阶段一。若 `cp` 报文件不存在 → 同样停下。

- [ ] **Step 3: 临时追加 `[caption]` 覆盖（device 与 compute_type 成对）**

```bash
printf '\n[caption]\ndevice = "cuda"\ncompute_type = "float16"\n' >> /root/projects/videocraft/videocraft.local.toml
tail -n 5 /root/projects/videocraft/videocraft.local.toml
```

Expected: tail 显示新增 `[caption]` 段，两键成对。

- [ ] **Step 4: 启动 GPU 轮询（后台）**

```bash
(timeout 180 sh -c 'while true; do nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader; echo ---; ps -eo pid,comm | grep -i python; echo ===; sleep 1; done' > /tmp/gpu-poll-smoke.log 2>&1 &)
```

Expected: 轮询进程后台运行（180s 自动退出，日志落盘）。

- [ ] **Step 5: 冒烟转写（A2）**

```bash
cd /root/projects/videocraft
time bash scripts/videocraft caption "/mnt/nas/raw/广汽丰田-汉兰达-测试1/话术/2.MP4" -o /tmp/cuda-smoke-20261116.srt
```

Expected: stdout JSON 含 `"segments": 37`；`time` 的 real 记为 CUDA 全程耗时（对照 CPU 全程 real 18.8s / 转写段 15.4s）。

- [ ] **Step 6: 判读 GPU 轮询日志（A2）**

```bash
cat /tmp/gpu-poll-smoke.log
```

Expected: 存在某个 pid，在同一个 `===` 区间内既出现在 `nvidia-smi` 的 CSV 行、又出现在 `ps` 的 python 行（即命中 python 进程）；记录其 `used_memory` MiB。

- [ ] **Step 7: 还原并清理（A1）**

```bash
cp -a /root/deploy-backups/cuda-smoke-<时间戳>/videocraft.local.toml /root/projects/videocraft/videocraft.local.toml
cd /root/projects/videocraft
git status --short --branch
grep -c '^\[caption\]' videocraft.local.toml
sha256sum videocraft.local.toml
rm -f /tmp/cuda-smoke-20261116.srt /tmp/gpu-poll-smoke.log
```

Expected: `git status --short --branch` 仅输出 `## main...origin/main`；`grep -c` 输出 0；sha256 与 Step 2 记录一致；`/tmp` 冒烟产物已删。

- [ ] **Step 8: 台账与 ticket 回写**

`progress.md` Evidence 段追加一行：冒烟耗时 / segments=37 / 显存 MiB / 备份路径与 sha256（对照 CPU 15.4s 转写段、real 18.8s 全程）。勾选 `02-dev-cuda-smoke.md` 全部 checkbox 与 `progress.md` 工作项 02 行。

### Task 2: 测试环境部署 CUDA 字幕（ticket 03）

**Files:**
- Create（远端）: `/root/deploy-backups/videocraft-<时间戳>/videocraft.local.toml`（+ 既有 `nvidia` 目录快照 `nvidia-prev/`，如存在）
- Modify（远端）: `/opt/videocraft/.venv/lib/python3.11/site-packages/nvidia/`（整目录复制替换）
- Modify（远端）: `/opt/videocraft/videocraft.local.toml`（文末追加 `[caption]`）
- Modify: `.scratch/videocraft-cuda-deploy/progress.md`、`.scratch/videocraft-cuda-deploy/03-test-env-deploy.md`

**Interfaces:**
- Consumes: Task 1 冒烟通过（cuda/float16 组合可用）。
- Produces: 服务账号 CUDA 就绪（A3）；`[caption]` 覆盖在位；备份路径与 sha256（写入 `progress.md`——Task 3 Step 4 回滚演练的直接输入）。

- [ ] **Step 1: 备份测试环境 local.toml**

```bash
mkdir -p /root/deploy-backups/videocraft-<时间戳>
cp -a /opt/videocraft/videocraft.local.toml /root/deploy-backups/videocraft-<时间戳>/
sha256sum /root/deploy-backups/videocraft-<时间戳>/videocraft.local.toml
```

Expected: sha256 一行；备份路径与 sha256 记入 `progress.md`（Task 3 使用）。

- [ ] **Step 2: 定位 `_preload_cuda_libs` 并取部署前基线（RED：期望 0）**

```bash
grep -rn 'def _preload_cuda_libs' /opt/videocraft --include='*.py' | grep -v '.venv'
cd /opt/videocraft && runuser -u videocraft -- .venv/bin/python -c 'from videocraft.config import Config; from <grep 定位到的模块> import _preload_cuda_libs; print(_preload_cuda_libs(Config()))'
```

Expected: 输出 `0`（部署前基线，A3 前置）。模块与 `Config` 的 import 路径均以 grep 定位为准（两 checkout 代码一致）；报错或非 0 → 原样记录输出，属 spec 外事实则停下回阶段一。

- [ ] **Step 3: 同机复制 CUDA 运行库（不联网安装）**

```bash
ls -d /root/projects/videocraft/.venv/lib/python3.11/site-packages/nvidia
/root/projects/videocraft/.venv/bin/python --version
/opt/videocraft/.venv/bin/python --version
if [ -d /opt/videocraft/.venv/lib/python3.11/site-packages/nvidia ]; then mv /opt/videocraft/.venv/lib/python3.11/site-packages/nvidia /root/deploy-backups/videocraft-<时间戳>/nvidia-prev; fi
cp -a /root/projects/videocraft/.venv/lib/python3.11/site-packages/nvidia /opt/videocraft/.venv/lib/python3.11/site-packages/
chown -R videocraft:videocraft /opt/videocraft/.venv/lib/python3.11/site-packages/nvidia
du -sh /opt/videocraft/.venv/lib/python3.11/site-packages/nvidia
find /opt/videocraft/.venv/lib/python3.11/site-packages/nvidia -type f | wc -l
```

Expected: 开发环境 `nvidia` 目录存在；两个 venv 的 Python 均为 3.11.x（版本不一致 → 停下回阶段一）；复制后输出目录大小与文件数（记入台账）。

- [ ] **Step 4: 验证 `_preload_cuda_libs`（GREEN：期望 17，即 A3）**

同 Step 2 第二条命令。Expected: 输出 `17`。若非 17 或报错 → 原样记录输出并停下回阶段一（CUDA 在服务账号下不可用是 spec 明示的回阶段一情形）。

- [ ] **Step 5: 追加 `[caption]` 覆盖（保留既有段落，仅新增）**

```bash
grep -n '^\[' /opt/videocraft/videocraft.local.toml
grep -c '^\[caption\]' /opt/videocraft/videocraft.local.toml
```

Expected: 列出现有段落（含 `[preview]`），`[caption]` 计数为 0（非 0 → spec 外事实停下）。

```bash
printf '\n[caption]\ndevice = "cuda"\ncompute_type = "float16"\n' >> /opt/videocraft/videocraft.local.toml
grep -A3 '^\[caption\]' /opt/videocraft/videocraft.local.toml
grep -n '^\[preview\]' /opt/videocraft/videocraft.local.toml
```

Expected: `[caption]` 段含 `device = "cuda"` 与 `compute_type = "float16"` 成对；既有 `[preview]` 段落仍在、未被改动。

- [ ] **Step 6: 重启（worker → mcp）并验证健康（A4）**

```bash
systemctl restart videocraft-worker videocraft-mcp
sleep 5
systemctl is-active videocraft-worker videocraft-mcp
cd /opt/videocraft && bash scripts/videocraft selfcheck --full
```

Expected: `is-active` 输出两行 `active`；`selfcheck --full` 输出 `all_ok: true`（含 NVENC 实测 ok——CUDA 与 NVENC 共存证据）。

- [ ] **Step 7: 台账与 ticket 回写**

`progress.md` Evidence 追加：备份路径与 sha256、nvidia 目录大小/文件数、A3 前后值（0→17）、A4 结论。勾选 `03-test-env-deploy.md` 全部 checkbox 与 `progress.md` 工作项 03 行。

### Task 3: live 验收与回滚演练（ticket 04）

**Files:**
- Modify（远端、可逆）: `/opt/videocraft/videocraft.local.toml`（回滚演练中还原一次、重新应用一次）
- Create（远端、任务末删除）: `/tmp/gpu-poll-live.log`
- Create（NAS、验收后清理）: `nas://projects/test/cuda-live-20261116/`（asr 候选产物）
- Modify: `.scratch/videocraft-cuda-deploy/progress.md`（A1–A8 证据摘要 + G5 材料）、`.scratch/videocraft-cuda-deploy/04-live-acceptance.md`

**Interfaces:**
- Consumes: Task 2 的备份路径与 sha256（`progress.md` 台账行）与已部署 CUDA 的测试环境；MCP 工具契约 `docs/agents/editing-mcp-capability-matrix.md` 与连接/预检约定 `.agents/skills/videocraft-edit/SKILL.md` §0–§1。
- Produces: G5 人签核材料（A1–A8 全量证据行，`progress.md` Evidence 段）。

- [ ] **Step 1: MCP selfcheck（A5 前半）**

客户端侧调用 MCP 工具 `videocraft_selfcheck`（连接与预检约定见 `.agents/skills/videocraft-edit/SKILL.md`；参数与返回字段以 `docs/agents/editing-mcp-capability-matrix.md` 为唯一事实源，不在本计划复制）。

Expected: `all_ok`；ASR `configured`；`capabilities.subtitle_namespace` 为 `test`。任一不满足 → 原样记录字段值 / `error_code`，按 skill 故障表处置，不自行归因、不整体停机。

- [ ] **Step 2: 提交 live 转写（A5）**

MCP 工具 `transcribe_candidate`（参数按契约速查模板）：

- 素材 URI: `nas://raw/广汽丰田-汉兰达-测试1/话术/2.MP4`
- 输出 URI（独占输出路径，项目目录由服务端自动创建、不预建）: `nas://projects/test/cuda-live-20261116/asr/2.MP4.txt` + 同目录 `.srt`
- 提交后轮询 `get_job_status(job_id)` 至终态。

Expected: job `succeeded`，result `segments: 37` 且 `seconds < 15.4`（CPU 基线 15.4）。若 `TOOL_TIMEOUT`：不重复提交，先轮询既有 job（冷加载可能先超时后完成）；其他 `error_code` / `error_detail` 原样记录再按故障表处置。

- [ ] **Step 3: GPU 轮询（A6，与 Step 2 并行）**

在第二个 `ssh ZZZ.Video` 会话执行：

```bash
(timeout 120 sh -c 'while true; do nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader; echo ---; ps -eo pid,comm | grep -i python; echo ===; sleep 1; done' > /tmp/gpu-poll-live.log 2>&1 &)
```

job 到终态后 `cat /tmp/gpu-poll-live.log` 判读。Expected: 同 Task 1 Step 6——某个 pid 在同一 `===` 区间内既出现在 `nvidia-smi` CSV 行、又出现在 python `ps` 行；记录 `used_memory` MiB。

- [ ] **Step 4: 回滚演练（A7）**

```bash
sha256sum /root/deploy-backups/videocraft-<时间戳>/videocraft.local.toml
cp -a /root/deploy-backups/videocraft-<时间戳>/videocraft.local.toml /opt/videocraft/videocraft.local.toml
systemctl restart videocraft-worker videocraft-mcp && sleep 5 && systemctl is-active videocraft-worker videocraft-mcp
cd /opt/videocraft && bash scripts/videocraft selfcheck --full
```

Expected: sha256 与 Task 2 Step 1 记录一致；两行 `active`；`all_ok: true`（CPU 基线态健康）。

重新应用 CUDA 覆盖并回到终态：

```bash
printf '\n[caption]\ndevice = "cuda"\ncompute_type = "float16"\n' >> /opt/videocraft/videocraft.local.toml
systemctl restart videocraft-worker videocraft-mcp && sleep 5 && systemctl is-active videocraft-worker videocraft-mcp
grep -A3 '^\[caption\]' /opt/videocraft/videocraft.local.toml
cd /opt/videocraft && bash scripts/videocraft selfcheck --full
```

Expected: `[caption]` 覆盖在位（cuda + float16 成对）；两行 `active`；`all_ok: true`（终态 CUDA 开启）。

- [ ] **Step 5: 清理 NAS 验收产物（A8）**

经 SMB `\\192.168.100.58\videocraft-projects` 删除项目目录 `test\cuda-live-20261116\`（客户端自带文件操作，不装工具）。随后 MCP `list_directory` 读 `nas://projects/test/cuda-live-20261116`（URI 不带尾部 `/`）核对：无条目、无 `.partial` / 临时 job 产物残留。

- [ ] **Step 6: 台账回写（A8）**

`progress.md` Evidence 追加 A1–A8 逐条证据摘要行（含耗时对比 15.4s→实测 `seconds`、显存 MiB、备份路径与 sha256、回滚演练结果）。运行 `grep -c 'G5' .scratch/videocraft-cuda-deploy/progress.md` 确认 ≥ 1（输出记为证据）。删除远端 `/tmp/gpu-poll-live.log`。勾选 `04-live-acceptance.md` 全部 checkbox 与 `progress.md` 工作项 04 行。G5 由人签核，不在本任务内判定。
