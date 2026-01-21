import { createServer } from "vite";
import type { ViteDevServer } from "vite";

let server: ViteDevServer;

export async function setup() {
  server = await createServer({
    server: {
      port: 5188,
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
