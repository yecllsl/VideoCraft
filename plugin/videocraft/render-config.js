"use strict";

const ALLOWED = ["{{SERVER_URL}}", "{{TOKEN_ENV}}", "{{SMB_HOST}}"];
const TOKEN_RE = /\{\{[^}]+\}\}/g;

function renderTemplate(text, values) {
  for (const match of text.matchAll(TOKEN_RE)) {
    if (!ALLOWED.includes(match[0])) {
      throw new Error(`illegal template token: ${match[0]}; allowed: ${ALLOWED.join(", ")}`);
    }
  }
  return text.replace(TOKEN_RE, (token) => {
    if (!(token in values)) throw new Error(`missing template value: ${token}`);
    return values[token];
  });
}

function mcpUrl(origin) {
  let base;
  try {
    base = new URL(origin);
  } catch {
    throw new Error(`invalid {{SERVER_URL}}: ${origin}`);
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error(`invalid {{SERVER_URL}} protocol: ${base.protocol}`);
  }
  if (base.pathname !== "/" || base.search || base.hash) {
    throw new Error(`invalid {{SERVER_URL}}: 只接受 origin（如 http://host:port），不要带路径或查询`);
  }
  return new URL("mcp", base);
}

function renderConfig(values) {
  const origin = values["{{SERVER_URL}}"];
  const envName = values["{{TOKEN_ENV}}"];
  if (!origin || typeof origin !== "string") throw new Error("missing template value: {{SERVER_URL}}");
  if (!envName) throw new Error("missing template value: {{TOKEN_ENV}}");
  const token = process.env[envName];
  if (!token) throw new Error(`missing token env: ${envName}`);
  const url = mcpUrl(origin);
  return {
    mcp: {
      "videocraft-remote": {
        type: "remote",
        url: url.href,
        oauth: false,
        headers: {
          Authorization: `Bearer ${token}`,
          Host: url.host,
        },
      },
    },
  };
}

module.exports = { ALLOWED, renderTemplate, renderConfig };
