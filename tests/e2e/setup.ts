import { createServer } from "vite";
import type { ViteDevServer } from "vite";

let server: ViteDevServer;

export async function setup() {
  server = await createServer({
    server: {
      port: 5173,
    },
  });
  await server.listen();
  console.log("Vite dev server started at http://localhost:5173");
}

export async function teardown() {
  if (server) {
    await server.close();
    console.log("Vite dev server stopped");
  }
}
