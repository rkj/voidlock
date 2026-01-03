const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcDir = path.join(root, 'src');

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

// Find all test files
const testFiles = findFiles(srcDir, (f) => f.endsWith('.test.ts'));

console.log(`Found ${testFiles.length} test files to update imports.`);

testFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;

    // Regex to match imports, requires, and vi.mocks
    // Group 1: Prefix (e.g. 'import { Foo } from "')
    // Group 2: Path (e.g. '../engine/CoreEngine')
    // Group 3: Suffix (e.g. '"')
    const importRegex = /(from\s+['"]|import\s*\(?['"]|require\s*\(['"]|vi\.mock\(['"]|vi\.importActual\(['"])([\.\/]+[^'"]*)(['"])/g;

    content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
        const fileDir = path.dirname(file);
        let absoluteTarget;
        
        try {
            absoluteTarget = path.resolve(fileDir, importPath);
        } catch (e) {
            return match; // Parsing error, skip
        }

        // Check if the import targets a file inside src/
        if (absoluteTarget.startsWith(srcDir)) {
            // Calculate path relative to src root
            const relToSrc = path.relative(srcDir, absoluteTarget);
            
            // If the import is already an alias (unlikely given the regex looks for ./ or ../), skip
            // The regex ensures it starts with . or / so we are good.
            
            // Construct new import using alias
            // Using forward slashes for paths
            const newPath = `@src/${relToSrc.split(path.sep).join('/')}`;
            
            if (importPath !== newPath) {
                changed = true;
                return `${prefix}${newPath}${suffix}`;
            }
        }
        
        return match;
    });

    if (changed) {
        fs.writeFileSync(file, content);
        console.log(`Updated: ${path.relative(root, file)}`);
    }
});

console.log('Phase 1: Import update complete.');
