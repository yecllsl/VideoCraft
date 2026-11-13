// ponytail: 本文件是 ESM、render-config.js 是 CJS，边界依赖 OpenCode v2 / Node ≥22 的模块语法自动探测；
// 升级路径是改成 index.mjs + render-config.cjs（或作用域 package.json 显式 type），避免旧 Node 上 import 失败。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { renderTemplate, renderConfig } = require("./render-config.js");
const here = path.dirname(fileURLToPath(import.meta.url));

// 钩子映射经 OpenCode v2.2.7 运行时实证：ctx.mcp.transform / ctx.skill.transform / ctx.reference.transform。
// draft 形状：mcp.set(name, config)、skill.add(info)、reference.add(alias, source)。
// 设计中的 `config` / `options` 命名是上一轮误记，见台账 2026-11-13 段。
const SKILLS = [
  { id: "videocraft-edit", file: "videocraft-edit.SKILL.md.tpl" },
  { id: "videocraft-cut-decision", file: "videocraft-cut-decision.SKILL.md.tpl" },
];

function values() {
  const serverUrl = process.env.VIDEOCRAFT_MCP_URL;
  const smbHost = process.env.VIDEOCRAFT_SMB_HOST;
  if (!serverUrl) throw new Error("videocraft: 缺少 VIDEOCRAFT_MCP_URL");
  if (!smbHost) throw new Error("videocraft: 缺少 VIDEOCRAFT_SMB_HOST");
  if (!process.env.VIDEOCRAFT_MCP_TOKEN) throw new Error("videocraft: 缺少 VIDEOCRAFT_MCP_TOKEN");
  return {
    "{{SERVER_URL}}": serverUrl,
    "{{TOKEN_ENV}}": "VIDEOCRAFT_MCP_TOKEN",
    "{{SMB_HOST}}": smbHost,
  };
}

// ponytail: 只解析单行 `key: value` frontmatter，多行 YAML 块标量会截断 description；
// 升级路径是复用已加载 superpowers 插件的 frontmatter 解析，或引入真正的 YAML 解析器。
function stripFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { info: {}, content: text };
  const info = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) info[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { info, content: match[2] };
}

function build(v) {
  const remote = renderConfig(v).mcp["videocraft-remote"];
  const skills = SKILLS.map((skill) => {
    const file = path.join(here, "templates", skill.file);
    const { info, content } = stripFrontmatter(renderTemplate(fs.readFileSync(file, "utf8"), v));
    return {
      id: skill.id,
      name: info.name || skill.id,
      ...(info.description ? { description: info.description } : {}),
      path: file,
      content,
    };
  });
  const reference = {
    alias: "videocraft-contract",
    source: {
      type: "local",
      path: path.join(here, "docs", "editing-mcp-capability-matrix.md"),
      description: "VideoCraft 远程 MCP 工具契约（按需 attach）",
    },
  };
  return { remote, skills, reference };
}

// ponytail: draft.set / draft.add 由宿主做 schema 解码，抛错时有意上抛、让宿主整体禁用插件（fail-fast，
// 不逐个吞错）；三个 transform 顺序执行，后者失败时前者已提交，不保证回滚。升级路径是参照
// superpowers 插件对每个 add 做 per-item 隔离。
async function setup(ctx) {
  const { remote, skills, reference } = build(values());

  await ctx.mcp.transform((draft) => {
    draft.set("videocraft-remote", remote);
    return draft;
  });

  await ctx.skill.transform((draft) => {
    for (const info of skills) draft.add(info);
    return draft;
  });

  await ctx.reference.transform((draft) => {
    draft.add(reference.alias, reference.source);
    return draft;
  });
}

export default { id: "videocraft", setup };
