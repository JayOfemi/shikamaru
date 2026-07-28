#!/usr/bin/env node
// Stdio entry for the shikamaru MCP server.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const transport = new StdioServerTransport();
await createServer().connect(transport);
