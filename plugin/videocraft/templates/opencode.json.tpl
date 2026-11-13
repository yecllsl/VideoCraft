{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "videocraft-remote": {
        "type": "remote",
        "url": "{{SERVER_URL}}/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {{TOKEN_ENV}}"
        }
      }
    }
  }
}
