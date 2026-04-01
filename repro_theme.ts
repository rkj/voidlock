import { ThemeManager } from "./src/renderer/ThemeManager";

async function repro() {
    console.log("Starting ThemeManager repro...");
    const theme = new ThemeManager();
    console.log("ThemeManager instance created.");
    
    try {
        const color = theme.getColor("--color-primary");
        console.log("--color-primary:", color);
    } catch (e) {
        console.error("Error in getColor:", e);
    }
    
    try {
        theme.setTheme("industrial");
        console.log("Theme set to industrial.");
        const color = theme.getColor("--color-primary");
        console.log("--color-primary (industrial):", color);
    } catch (e) {
        console.error("Error in setTheme/getColor:", e);
    }
}

repro();
