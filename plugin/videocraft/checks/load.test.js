"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..", "..", "..");
const INDEX = path.join(ROOT, "plugin/videocraft/index.js");
const KEYS = ["VIDEOCRAFT_MCP_URL", "VIDEOCRAFT_MCP_TOKEN", "VIDEOCRAFT_SMB_HOST"];

function fakeCtx() {
  const calls = { mcp: [], skill: [], reference: [] };
  const draft = (name) => ({
    list: () => [],
    get: () => undefined,
    set: (...args) => calls[name].push(["set", ...args]),
    add: (...args) => calls[name].push(["add", ...args]),
    update: () => {},
    remove: () => {},
  });
  const service = (name) => ({
    transform: async (cb) => { await cb(draft(name)); },
    list: async () => ({ location: [], data: [] }),
  });
  return {
    ctx: { mcp: service("mcp"), skill: service("skill"), reference: service("reference") },
    calls,
  };
}

(async () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    process.env.VIDEOCRAFT_MCP_URL = "http://192.0.2.1:8000";
    process.env.VIDEOCRAFT_MCP_TOKEN = "dummy-token-for-test";
    process.env.VIDEOCRAFT_SMB_HOST = "192.0.2.2";

    const plugin = (await import(pathToFileURL(INDEX).href)).default;
    assert.equal(typeof plugin, "object", "插件必须默认导出 { id, setup } 定义对象");
    assert.equal(plugin.id, "videocraft");
    assert.equal(typeof plugin.setup, "function");

    const { ctx, calls } = fakeCtx();
    await plugin.setup(ctx);

    assert.equal(calls.mcp.length, 1, "必须且只注册一次 MCP 注入");
    const [setAction, serverName, config] = calls.mcp[0];
    assert.equal(setAction, "set");
    assert.equal(serverName, "videocraft-remote");
    assert.equal(config.oauth, false);
    assert.equal(config.url, "http://192.0.2.1:8000/mcp");
    assert.equal(config.headers.Host, "192.0.2.1:8000");
    assert.equal(config.headers.Authorization, "Bearer dummy-token-for-test");

    assert.equal(calls.skill.length, 2, "必须注册两个流程 skill");
    assert.deepEqual(calls.skill.map((call) => call[1].id).sort(), ["videocraft-cut-decision", "videocraft-edit"]);
    for (const call of calls.skill) {
      const info = call[1];
      assert.ok(path.isAbsolute(info.path), "skill path 必须是绝对路径");
      assert.ok(info.content.length > 0);
      assert.equal(info.name, info.id, "frontmatter 的 name 必须被解析");
      assert.ok(info.description && info.description.length > 0, "frontmatter 的 description 必须被解析");
      assert.ok(!info.content.includes("{{"), "skill 正文不得残留白名单 token");
      assert.ok(!info.content.startsWith("---"), "skill 正文不得残留 frontmatter");
    }

    assert.equal(calls.reference.length, 1, "必须且只注册一次查阅别名");
    const [addAction, alias, source] = calls.reference[0];
    assert.equal(addAction, "add");
    assert.equal(alias, "videocraft-contract");
    assert.equal(source.type, "local");
    assert.ok(path.isAbsolute(source.path), "reference path 必须是绝对路径");
    assert.ok(source.description && source.description.length > 0, "查阅别名必须带 description");

    async function expectFailFast(pattern) {
      const probe = fakeCtx();
      await assert.rejects(() => plugin.setup(probe.ctx), pattern, "缺配置必须 fail-fast");
      assert.deepEqual(probe.calls, { mcp: [], skill: [], reference: [] }, "失败时不得有任何半注册");
    }

    delete process.env.VIDEOCRAFT_MCP_URL;
    await expectFailFast(/VIDEOCRAFT_MCP_URL/);
    process.env.VIDEOCRAFT_MCP_URL = "http://192.0.2.1:8000";

    delete process.env.VIDEOCRAFT_SMB_HOST;
    await expectFailFast(/VIDEOCRAFT_SMB_HOST/);
    process.env.VIDEOCRAFT_SMB_HOST = "192.0.2.2";

    delete process.env.VIDEOCRAFT_MCP_TOKEN;
    await expectFailFast(/VIDEOCRAFT_MCP_TOKEN/);

    console.log("load: ok");
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
