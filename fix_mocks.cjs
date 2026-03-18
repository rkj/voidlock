const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

walk('tests/renderer', (filePath) => {
    if (!filePath.endsWith('.test.ts') && !filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // We need to inject `mockTutorialManager` or `{ getCurrentStepId: vi.fn().mockReturnValue(null) }`
    // as the second argument to `new HUDManager(`
    
    // Look for `new HUDManager(` and the first argument.
    // The first argument is usually `mockMenuController` or `menuController`.
    // Example: new HUDManager(mockMenuController, onUnitClick, ...
    
    const regex = /(new HUDManager\(\s*)(mockMenuController|menuController)(,)/g;
    if (regex.test(content)) {
        content = content.replace(regex, '$1$2,\n      { getCurrentStepId: () => null }$3');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
    }
});
