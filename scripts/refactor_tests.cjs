const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcDir = path.join(root, 'src');
const testsDir = path.join(root, 'tests');

if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir);
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

// 1. Identify all files within any 'tests' directory inside 'src'
const allSrcFiles = getAllFiles(srcDir);
const filesToMove = allSrcFiles.filter(f => {
    const rel = path.relative(srcDir, f);
    return rel.split(path.sep).includes('tests');
});

console.log(`Found ${filesToMove.length} files to move from src/ to tests/`);

filesToMove.forEach(oldPath => {
    // oldPath: /.../src/engine/tests/CoreEngine.test.ts
    // relFromSrc: engine/tests/CoreEngine.test.ts
    const relFromSrc = path.relative(srcDir, oldPath);
    
    // Construct new path: Remove 'tests' segment(s) effectively, or map structure?
    // ADR: src/engine/CoreEngine.test.ts -> tests/engine/CoreEngine.test.ts
    // Current reality: src/engine/tests/CoreEngine.test.ts
    // We want: tests/engine/CoreEngine.test.ts
    
    // Strategy: Remove the 'tests' directory from the path parts.
    const parts = relFromSrc.split(path.sep);
    const newParts = parts.filter(p => p !== 'tests');
    const relNew = newParts.join(path.sep);
    
    const newPath = path.join(testsDir, relNew);
    const newDir = path.dirname(newPath);

    if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
    }

    // Move file
    fs.renameSync(oldPath, newPath);
    // console.log(`Moved: ${relFromSrc} -> ${relNew}`);

    // Update Content (Imports)
    if (newPath.endsWith('.ts') || newPath.endsWith('.tsx')) {
        let content = fs.readFileSync(newPath, 'utf-8');
        let changed = false;

        // Regex to match imports, requires, and vi.mocks
        // Handles: import ... from "..."
        //          require("...")
        //          vi.mock("...")
        //          vi.importActual("...")
        const importRegex = /(from\s+['"]|import\s*\(?['"]|require\s*\(['"]|vi\.mock\(['"]|vi\.importActual\(['"])([\.\/]+[^'"]*)(['"])/g;

        content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
            // Resolve the import path relative to the *OLD* location
            // oldPath is the full source path.
            const oldDir = path.dirname(oldPath);
            let absoluteTarget;
            
            try {
                absoluteTarget = path.resolve(oldDir, importPath);
            } catch (e) {
                return match; // Parsing error, skip
            }

            // Check if it points into src
            if (absoluteTarget.startsWith(srcDir)) {
                const relToSrc = path.relative(srcDir, absoluteTarget);
                // Convert to @src alias
                changed = true;
                // console.log(`  Rewrote import: ${importPath} -> @src/${relToSrc}`);
                return `${prefix}@src/${relToSrc}${suffix}`;
            }
            
            return match;
        });

        if (changed) {
            fs.writeFileSync(newPath, content);
        }
    }
});

// 2. Clean up empty 'tests' directories in src
// We iterate known test directories and try to remove them if empty.
// Since we used getAllFiles, we don't have a list of dirs easily, but we can infer.
// Let's just do a naive cleanup of 'tests' dirs.

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
        // Check again after clearing subdirs
        if (fs.readdirSync(dir).length === 0) {
            // Only remove if it is named 'tests' or is inside a 'tests' tree?
            // Safer to only remove if it's explicitly one of the paths we cleared?
            // Actually, safe to remove any empty dir in src if we are careful.
            // But let's stick to 'tests'.
            if (dir.split(path.sep).includes('tests')) {
                fs.rmdirSync(dir);
                console.log(`Removed empty dir: ${path.relative(root, dir)}`);
            }
        }
    } else {
        if (dir.split(path.sep).includes('tests')) {
            fs.rmdirSync(dir);
            console.log(`Removed empty dir: ${path.relative(root, dir)}`);
        }
    }
}

removeEmptyDirs(srcDir);

console.log("Done.");
