const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, pattern));
    } else if (file.endsWith('.test.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(pattern)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = findFiles('tests', ', squadConfig: { soldiers: [] } }');
console.log(`Found ${files.length} files to fix`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Fix the double comma or incorrect placement
  // Example: 
  // manualDeployment: true,
  // , squadConfig: { soldiers: [] } }
  content = content.replace(/,\s*,\s*squadConfig/g, ', squadConfig');
  
  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
});
