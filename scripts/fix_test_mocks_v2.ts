import * as fs from 'fs';
import * as path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const patterns = [
  /\(mockConstructor as any\)\.getInstance = vi\.fn\(\)\.mockReturnValue\(mockInstance\);/g,
  /getInstance: vi\.fn\(\)\.mockReturnValue\(mockInstance\),/g,
  /vi\.spyOn\(InputDispatcher\.getInstance\(\), "[^"]+"\)\.mockImplementation\(\(\) => \{\}\);/g,
];

walk('tests', (filePath) => {
  if (filePath.endsWith('.test.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;
    
    for (const p of patterns) {
      updated = updated.replace(p, '');
    }
    
    if (updated !== content) {
      console.log('Cleaning up mocks in ' + filePath);
      fs.writeFileSync(filePath, updated);
    }
  }
});
