import fs from 'fs';
import path from 'path';

// Use a simple recursive file finder instead of glob to avoid extra dependencies if not available
function getFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, allFiles);
    } else if (name.endsWith('.test.ts') || name.endsWith('.tsx')) {
      allFiles.push(name);
    }
  }
  return allFiles;
}

const files = getFiles('tests');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add freezeForDialog and unfreezeAfterDialog to gameClient mocks
  // Handle both 'const mockGameClient = {' and 'gameClient = {'
  if (content.includes('gameClient = {') || content.includes('mockGameClient = {')) {
    if (!content.includes('freezeForDialog')) {
      content = content.replace(/((?:mock)?gameClient\s*=\s*\{)/i, '$1\n      freezeForDialog: vi.fn(),\n      unfreezeAfterDialog: vi.fn(),');
      changed = true;
    }
  }

  // Fix onMessage calls in Tutorial tests
  if (file.includes('TutorialManager.test.ts') || file.includes('TutorialRedesign.test.ts')) {
    // Update beforeEach onMessage mock if it hasn't been updated already
    if (content.includes('onMessage = vi.fn();')) {
      content = content.replace('onMessage = vi.fn();', 'onMessage = vi.fn().mockImplementation((msg, cb) => { if (cb) cb(); });');
      changed = true;
    }
    
    // Update toHaveBeenCalledWith assertions to expect the callback argument
    const pattern = /expect\(onMessage\)\.toHaveBeenCalledWith\(expect\.objectContaining\(\{\s*id:\s*("[^"]+")\s*\}\)\)/g;
    if (pattern.test(content)) {
        content = content.replace(pattern, 'expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: $1 }), expect.any(Function))');
        changed = true;
    }

    // Remove or comment out gameClient.pause expectations that are no longer TutorialManager's direct responsibility
    if (file.includes('TutorialManager.test.ts')) {
        if (content.includes('expect(gameClient.pause).toHaveBeenCalled();')) {
            content = content.replace('expect(gameClient.pause).toHaveBeenCalled();', '// expect(gameClient.pause).toHaveBeenCalled(); // Responsibility moved to AdvisorOverlay');
            changed = true;
        }
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
