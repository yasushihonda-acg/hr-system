#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SmartHRClient } from "./smarthr-client.js";
import { defineTools } from "./tools.js";

const SMARTHR_API_KEY = process.env.SMARTHR_API_KEY;
const SMARTHR_TENANT_ID = process.env.SMARTHR_TENANT_ID;

if (!SMARTHR_API_KEY || !SMARTHR_TENANT_ID) {
  console.error("Error: SMARTHR_API_KEY and SMARTHR_TENANT_ID environment variables are required.");
  process.exit(1);
}

const client = new SmartHRClient({
  accessToken: SMARTHR_API_KEY,
  tenantId: SMARTHR_TENANT_ID,
});

const tools = defineTools(client);

const server = new McpServer({
  name: "smarthr",
  version: "0.1.0",
});

// ツール登録
for (const [name, tool] of Object.entries(tools)) {
  server.tool(name, tool.description, tool.shape, async (params: Record<string, unknown>) => {
    try {
      const result = await tool.handler(params as never);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}

// サーバー起動
const transport = new StdioServerTransport();
await server.connect(transport);
