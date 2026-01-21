import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { E2E_PORT } from "./config";

let server: ViteDevServer;

export async function setup() {
  server = await createServer({
    server: {
      port: E2E_PORT,
      strictPort: true,
    },
  });
  await server.listen();
  const port = server.config.server.port;
  console.log(`Vite dev server started at http://localhost:${port}`);
}

export async function teardown() {
  if (server) {
    await server.close();
    console.log("Vite dev server stopped");
  }
}
