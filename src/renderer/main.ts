import { GameApp } from "./app/GameApp";

const app = new GameApp();
(window as any).GameAppInstance = app;

app.initialize().then(() => {
    app.start();
}).catch(err => {
    console.error("Failed to initialize GameApp:", err);
});