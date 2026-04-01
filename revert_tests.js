const fs = require('fs');
const path = require('path');

const exclude = [
    'tests/renderer/regression_voidlock-txq8_visual_style_assets.test.ts',
    'tests/renderer/ThemeManager.test.ts'
];

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.test.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('tests');

files.forEach(file => {
    const normFile = file.replace(/\\/g, '/');
    if (exclude.some(ex => normFile.includes(ex))) return;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern 1: Long Mock
    content = content.replace(/,\s*applyToCanvas: vi\.fn\(\(ctx, varName, mode = "fill"\) => \{ const color = "#ffffff"; if \(mode === "fill"\) ctx\.fillStyle = color; else ctx\.strokeStyle = color; \}\)/g, '');
    
    // Pattern 2: Short Mock
    content = content.replace(/,\s*applyToCanvas: vi\.fn\(\)/g, '');
    
    // Pattern 3: Mock with space before comma
    content = content.replace(/\s*, applyToCanvas: vi\.fn\(\)/g, '');

    // Pattern 4: Property without comma if it was last
    content = content.replace(/applyToCanvas: vi\.fn\(\),?\s*/g, '');

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Reverted mocks in ${normFile}`);
    }
});
