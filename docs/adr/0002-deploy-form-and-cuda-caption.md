# ADR-0002：部署形态维持原生 systemd，性能增量收敛为 CUDA 字幕

- **日期：** 2026-11-16
- **状态：** 已接受
- **关联：** 本地 `.scratch/videocraft-cuda-deploy/` 工作项；评估源为 `ZZZ.Video` 上 `/root/videocraft-deploy-plan.md` 及其上一轮 `/root/gpu-video-server-plan.md`

## 背景

`ZZZ.Video`（Debian 12 + RTX 3060）先后提出两轮部署方案：上一轮主张 Docker + NVIDIA Container Toolkit 从零建 API 服务；本轮主张维持原生形态，但其现状盘点已过时——systemd 双单元、`User=videocraft`、目录权限、fstab `x-systemd.automount` 挂载依赖均已落地运行，真正未启用的只有 CUDA 字幕（测试环境 venv 缺 cuBLAS/cuDNN，`_preload_cuda_libs` 返回 0，开发环境为 17）。

## 决策

**不引入容器化，维持已落地的原生 systemd 双单元 + automount 部署形态；服务端性能优化收敛为唯一增量——测试环境启用 CUDA 字幕（`[caption] device="cuda"` 配对 `compute_type="float16"`），运行库从开发环境同机复制，零仓库代码改动。**

## 被否方案

- **容器化（Docker + NVIDIA Container Toolkit）**：应用已深度绑定宿主机（系统 ffmpeg/NVENC、venv 内 CUDA wheel + `RTLD_GLOBAL` 预加载、NAS automount、SQLite 状态、systemd 模板），容器化只换来隔离、换不来性能，且要重做全部粘合层。
- **Worker 分道并行 / NVENC 会话解锁 / tts 并发 / libx264 调参**（源方案 P2）：需改代码且无实测并发瓶颈，维持「暂列不动」。
- **重装 systemd 单元 / 打开被注释的 `RequiresMountsFor` / 单元调优 drop-in**：现状已由 `*.service.d/automount.conf` + `x-systemd.automount` 覆盖；重装或改注释属于倒退；无实测证据表明需要 `Nice`/`IOScheduling*` 调优。

## 后果

- 本次变更零仓库代码改动，验收全部走 live 可执行断言；阶段三的 worktree / TDD / subagent 按 2026-11-16 用户批准裁剪为「不适用」，保留 G1、G2、`verification-before-completion` 与 G5 人签核。
- 远端方案文档中「顺手修正 AGENTS.md」不执行：服务端文档漂移（仓库根视角、工具数、驱动版本）属仓库改动，另行立项。

## 复核触发条件

出现代码保护/防篡改或多机横向扩展需求时重评容器化；出现实测多客户排队瓶颈时重评 Worker 分道并行。
