import { GameApp } from "./app/GameApp";
import { Logger } from "@src/shared/Logger";
import { createElement, Fragment } from "@src/renderer/jsx";

// Ensure JSX factory is available globally for TSX components
(window as any).createElement = createElement;
(window as any).Fragment = Fragment;

// Global Error Handling (Spec 8.12)
window.onerror = (message, source, lineno, colno, error) => {
  Logger.error(`Global Error (main.ts): ${message}`, {
    source,
    lineno,
    colno,
    error,
  });
};

window.onunhandledrejection = (event) => {
  Logger.error(
    `Unhandled Promise Rejection (main.ts): ${event.reason}`,
    event.reason,
  );
};

declare global {
  interface Window {
    __VOIDLOCK_PANIC_HANDLER__?: (error: unknown) => void;
    GameAppInstance?: GameApp;
  }
}

/**
 * Main entry point for the Voidlock renderer.
 * Separated from auto-start logic to allow testing without side effects.
 */
export async function bootstrap() {
  const app = new GameApp();
  window.GameAppInstance = app;

  try {
    await app.initialize();
    app.start();
    (window as unknown as Record<string, boolean>).__VOIDLOCK_READY__ = true;
  } catch (err) {
    Logger.error("Failed to initialize GameApp:", err);
  }
    
  return app;
}

// Only auto-start if not in a test environment
if (typeof process === "undefined" || !process.env?.VITEST) {
  bootstrap();
}
