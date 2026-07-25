import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(__dirname, "../dist/stdio.js");

describe("stdio smoke test", () => {
  it.skipIf(!existsSync(distEntry))(
    "responds to a raw JSON-RPC tools/list request over stdio with all 10 tools",
    async () => {
      const child = spawn(process.execPath, [distEntry], { stdio: ["pipe", "pipe", "pipe"] });

      const responseText = await new Promise<string>((resolvePromise, reject) => {
        let buffer = "";
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for tools/list response")), 10000);

        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const newlineIndex = buffer.indexOf("\n");
          if (newlineIndex !== -1) {
            clearTimeout(timeout);
            resolvePromise(buffer.slice(0, newlineIndex));
          }
        });
        child.on("error", reject);

        const request = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "smoke-test", version: "0.0.0" },
          },
        };
        child.stdin.write(JSON.stringify(request) + "\n");
      });

      // The first response is the initialize result — send initialized notification, then tools/list.
      expect(JSON.parse(responseText).result).toBeDefined();

      const toolsListText = await new Promise<string>((resolvePromise, reject) => {
        let buffer = "";
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for tools/list response")), 10000);
        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const newlineIndex = buffer.indexOf("\n");
          if (newlineIndex !== -1) {
            clearTimeout(timeout);
            resolvePromise(buffer.slice(0, newlineIndex));
          }
        });
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
      });

      const toolsList = JSON.parse(toolsListText);
      const names = (toolsList.result.tools as { name: string }[]).map((t) => t.name).sort();
      expect(names).toHaveLength(10);
      expect(names).toContain("schema_to_go");

      child.kill();
    },
  );
});
