import fs from "fs";
import path from "path";

const dir = "tests/renderer";

function walk(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith(".test.ts")) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(dir);

files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let changed = false;
    
    // Fix common mess-ups from previous runs
    if (content.includes(",\n      , applyToCanvas") || content.includes(",\n        , applyToCanvas")) {
        console.log(`Fixing leading comma in ${file}...`);
        content = content.replace(/,\s+, applyToCanvas/g, ", applyToCanvas");
        changed = true;
    }

    if (content.includes("getColor: vi.fn()") && !content.includes("applyToCanvas:")) {
        console.log(`Fixing ${file} (variant 3)...`);
        content = content.replace(
            /getColor: vi\.fn\(\)\.mockReturnValue\("([^"]+)"\),?/g,
            (match, color) => `getColor: vi.fn().mockReturnValue("${color}"),\n      applyToCanvas: vi.fn((ctx, varName, mode = "fill") => { const color = "${color}"; if (mode === "fill") ctx.fillStyle = color; else ctx.strokeStyle = color; }),`
        );
        changed = true;
    }

    if (content.includes("getCurrentThemeId: vi.fn()") && !content.includes("applyToCanvas:")) {
        console.log(`Fixing ${file}...`);
        content = content.replace(
            /getCurrentThemeId: vi\.fn\(\)\.mockReturnValue\("default"\),?/g,
            'getCurrentThemeId: vi.fn().mockReturnValue("default"),\n      applyToCanvas: vi.fn(),'
        );
        changed = true;
    } else if (content.includes("themeManager: {") && !content.includes("applyToCanvas:")) {
        console.log(`Fixing ${file} (variant 2)...`);
        content = content.replace(
            /themeManager: \{([^}]+)\}/g,
            (match, p1) => {
                const trimmed = p1.trim();
                const separator = trimmed.endsWith(",") ? "" : ",";
                return `themeManager: { ${trimmed}${separator} applyToCanvas: vi.fn() }`;
            }
        );
        changed = true;
    }
    
    if (changed) {
        fs.writeFileSync(file, content);
    }
});
