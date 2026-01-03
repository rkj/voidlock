const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcDir = path.join(root, 'src');
const testsDir = path.join(root, 'tests');

if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir);
}

// Helper to recursively find files
function findFiles(dir, predicate, results = []) {
    if (!fs.existsSync(dir)) return results;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findFiles(fullPath, predicate, results);
        } else if (predicate(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

// 1. Find all test-related files
const testFiles = findFiles(srcDir, (f) => {
    return f.endsWith('.test.ts') || 
           f.endsWith('.snap') || 
           (f.endsWith('GEMINI.md') && f.includes(path.sep + 'tests' + path.sep));
});

console.log(`Found ${testFiles.length} files to move.`);

// 2. Update imports in-place (Phase 1)
testFiles.filter(f => f.endsWith('.ts')).forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;

    // Regex for imports
    const importRegex = /(from\s+['"]|import\s*\(?['"]|require\s*\(['"]|vi\.mock\(['"]|vi\.importActual\(['"])([\.\/]+[^'"]*)(['"])/g;

    content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
        const fileDir = path.dirname(file);
        let absoluteTarget;
        try {
            absoluteTarget = path.resolve(fileDir, importPath);
        } catch (e) {
            return match;
        }

        if (absoluteTarget.startsWith(srcDir)) {
            const relToSrc = path.relative(srcDir, absoluteTarget);
            // Replace with @src alias
            // console.log(`[Update] ${file}: ${importPath} -> @src/${relToSrc}`);
            changed = true;
            return `${prefix}@src/${relToSrc}${suffix}`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(file, content);
    }
});

console.log('Imports updated.');

// 3. Move files (Phase 2)
testFiles.forEach(oldPath => {
    const relFromSrc = path.relative(srcDir, oldPath);
    // Remove 'tests' segments from the path
    // e.g. engine/tests/CoreEngine.test.ts -> engine/CoreEngine.test.ts
    const parts = relFromSrc.split(path.sep);
    const newParts = parts.filter(p => p !== 'tests');
    const relNew = newParts.join(path.sep);
    
    const newPath = path.join(testsDir, relNew);
    const newDir = path.dirname(newPath);

    if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
    }

    fs.renameSync(oldPath, newPath);
    console.log(`Moved: ${relFromSrc} -> ${relNew}`);
});

// 4. Cleanup empty directories
function removeEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    if (files.length > 0) {
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                removeEmptyDirs(fullPath);
            }
        });
        if (fs.readdirSync(dir).length === 0) {
             // Only remove if it is inside src
             if (dir.startsWith(srcDir)) {
                 fs.rmdirSync(dir);
                 console.log(`Cleaned empty dir: ${path.relative(root, dir)}`);
             }
        }
    } else {
        if (dir.startsWith(srcDir)) {
            fs.rmdirSync(dir);
            console.log(`Cleaned empty dir: ${path.relative(root, dir)}`);
        }
    }
}

removeEmptyDirs(srcDir);
console.log('Refactoring complete.');
