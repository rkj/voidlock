import { GameApp } from "./app/GameApp";
import { Logger } from "@src/shared/Logger";

declare global {
  interface Window {
    __VOIDLOCK_PANIC_HANDLER__?: (error: unknown) => void;
    GameAppInstance?: GameApp;
  }
}

// Global Error Logging (Spec 8.12)
window.addEventListener("error", (event) => {
  const { message, filename, lineno, colno, error } = event;
  Logger.error("Global Error (main.ts):", {
    message,
    filename,
    lineno,
    colno,
    error,
  });
  if (window.__VOIDLOCK_PANIC_HANDLER__) {
    window.__VOIDLOCK_PANIC_HANDLER__(error || message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  Logger.error("Unhandled Promise Rejection (main.ts):", event.reason);
  if (window.__VOIDLOCK_PANIC_HANDLER__) {
    window.__VOIDLOCK_PANIC_HANDLER__(event.reason);
  }
});

const app = new GameApp();
window.GameAppInstance = app;

app
  .initialize()
  .then(() => {
    app.start();
  })
  .catch((err) => {
    Logger.error("Failed to initialize GameApp:", err);
  });