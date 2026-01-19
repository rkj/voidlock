import { GameApp } from "./app/GameApp";

// Global Error Logging (Spec 8.12)
window.onerror = (message, source, lineno, colno, error) => {
    console.error("Global Error (main.ts):", {
        message,
        source,
        lineno,
        colno,
        error
    });
};

window.onunhandledrejection = (event) => {
    console.error("Unhandled Promise Rejection (main.ts):", event.reason);
};

const app = new GameApp();
(window as any).GameAppInstance = app;

app.initialize().then(() => {
    app.start();
}).catch(err => {
    console.error("Failed to initialize GameApp:", err);
});