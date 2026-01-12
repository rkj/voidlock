import { GameApp } from "./app/GameApp";

const app = new GameApp();
app.initialize().then(() => {
    app.start();
}).catch(err => {
    console.error("Failed to initialize GameApp:", err);
});