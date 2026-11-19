# VideoCraft OpenCode V2 插件

通过 GitHub git-source 分发，不依赖 npm registry。第一批只支持 OpenCode V2（不支持 DSH / Pi）。

## 安装

令牌由作者人工发放；未拿到请先索取。安装分两步，两步都在 **PowerShell** 中执行（不要用 bash / sh）。

**第 1 步（用户本机执行，含令牌）**：粘贴到 PowerShell 由本人执行。令牌只在本机掩码输入，不要发给 agent、也不要写进对话或文件。

```powershell
$u='http://192.168.88.4:8000'; $s='192.168.100.58'
$t=[Net.NetworkCredential]::new('',(Read-Host 'VideoCraft 令牌' -AsSecureString)).Password
foreach($p in @(@('VIDEOCRAFT_MCP_URL',$u),@('VIDEOCRAFT_SMB_HOST',$s),@('VIDEOCRAFT_MCP_TOKEN',$t))){
  [Environment]::SetEnvironmentVariable($p[0],$p[1],'User')
}
```

**第 2 步（可整块交给 agent，不要只复制 `opencode` 那两行）**：先做前置检查，再把用户级三个变量读入当前进程——重启后的服务继承这个 shell 的环境变量，否则插件会在缺变量时 fail-fast。注意：本块会把用户级令牌读进执行它的 shell；若由 agent 代跑，跑完即关闭该会话，不要在其后打印环境变量。全程以大写标记报告结果，最后一行 `INSTALL_OK=1` 才代表成功；在交互式窗口里失败会以 `exit 1` 结束，可能直接关闭窗口，粘贴前请先看最后一行标记。

```powershell
if(-not (Get-Command opencode -ErrorAction SilentlyContinue)){ 'OPENCODE_NOT_FOUND'; exit 1 }
if(-not (Get-Command git -ErrorAction SilentlyContinue)){ 'GIT_NOT_FOUND'; exit 1 }
foreach($n in 'VIDEOCRAFT_MCP_URL','VIDEOCRAFT_SMB_HOST','VIDEOCRAFT_MCP_TOKEN'){
  $v=[Environment]::GetEnvironmentVariable($n,'User')
  if(-not $v){ "MISSING_USER_ENV=$n（请先执行第 1 步）"; exit 1 }
  [Environment]::SetEnvironmentVariable($n,$v,'Process')
}
if(-not $env:VIDEOCRAFT_MCP_TOKEN){ 'PROCESS_ENV_LOST'; exit 1 }
opencode plugin add 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'
if($LASTEXITCODE -gt 0){ 'PLUGIN_ADD_FAILED'; exit 1 }
opencode service restart
if($LASTEXITCODE -gt 0){ 'SERVICE_RESTART_FAILED'; exit 1 }
'INSTALL_OK=1'
```

验证：`opencode plugin list` 应显示 `videocraft` 与 git-source 目标；若首次为空，重启 OpenCode 服务后重试。重启要在已带上述三个变量的终端里做，否则先重开终端或重新登录再重启。

需 OpenCode V2 2.0.15 或更新版本（早期版本不支持 `::path:` 子目录选择器）。

## 更新

```bash
opencode plugin check
opencode plugin update
```

只想更新这一个包时，用安装时的**完整目标串**：`opencode plugin update 'github:yecllsl/VideoCraft#main::path:plugin/videocraft'`。用 npm 包名 `videocraft-opencode-plugin` 会报 `Plugin is not configured`。首次安装后 `plugin list` 可能滞后一次调用才显示插件，必要时重启 OpenCode 服务。

作者 push 到 `main` 后，用户机器上的插件**不会自动变化**：OpenCode 启动只检查更新，不替换已安装副本；只有执行 `opencode plugin update` 才会拉取新提交。`opencode plugin check` 只提示，不执行更新。本地路径安装与完整 commit hash 会被 `update` 跳过，因此不要改用这两种写法。

## 运行前置

插件从进程环境变量读取配置，令牌不写入文件、命令行或日志：

- `VIDEOCRAFT_MCP_URL`：MCP 服务 origin（如 `http://host:port`，不带路径）
- `VIDEOCRAFT_SMB_HOST`：SMB 主机
- `VIDEOCRAFT_MCP_TOKEN`：静态 Bearer 令牌

加载后应提供 11 个 MCP 工具，并注册 `videocraft-edit`、`videocraft-cut-decision` 两个 skill 与 `videocraft-contract` 查阅别名。
