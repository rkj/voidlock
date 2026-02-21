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

const squadBuilderFiles = findFiles('tests', 'screen-mission-setup');
console.log(`Found ${squadBuilderFiles.length} files for squad-builder injection`);

squadBuilderFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('id="squad-builder"')) {
    // Inject squad-builder inside screen-mission-setup
    content = content.replace(
      /(<div id="screen-mission-setup"[^>]*>)/,
      '$1
                <div id="squad-builder"></div>'
    );
    fs.writeFileSync(file, content);
    console.log(`Updated squad-builder in ${file}`);
  }
});

const equipmentScreenFiles = findFiles('tests', 'new EquipmentScreen(');
console.log(`Found ${equipmentScreenFiles.length} files for EquipmentScreen constructor update`);

equipmentScreenFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Skip if already updated
  if (content.includes('modalService as any') || content.includes('mockModalService as any')) {
    console.log(`Skipping already updated ${file}`);
    return;
  }

  // 1. Declare mockModalService at describe level if not present
  if (content.includes('let mockManager') && !content.includes('let mockModalService')) {
    content = content.replace(/let mockManager: any;/g, 'let mockManager: any;
  let mockModalService: any;');
  }

  // 2. Initialize mockModalService in beforeEach if not present
  if (content.includes('beforeEach(') && !content.includes('mockModalService =')) {
    const mockModalServiceCode = `
    mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };`;
    
    // Insert after onBack = vi.fn() or similar
    if (content.includes('onBack = vi.fn();')) {
      content = content.replace('onBack = vi.fn();', 'onBack = vi.fn();' + mockModalServiceCode);
    } else if (content.includes('mockManager = {')) {
        content = content.replace('mockManager = {', 'mockModalService = {
      alert: vi.fn().mockResolvedValue(undefined),
      confirm: vi.fn().mockResolvedValue(true),
      show: vi.fn().mockResolvedValue(undefined),
    };
    mockManager = {');
    }
  }

  // 3. Update constructor calls
  // Pattern: new EquipmentScreen( containerId, manager, initialConfig, ... )
  // Replace with: new EquipmentScreen( containerId, manager, mockModalService as any, initialConfig, ... )
  
  // Note: some tests use different names for mockManager or initialConfig.
  // We'll use a regex that captures the first two arguments and inserts the third.
  content = content.replace(
    /new EquipmentScreen\(\s*([^,]+),\s*([^,]+),\s*(?!mockModalService|modalService)/g,
    'new EquipmentScreen($1, $2, mockModalService as any, '
  );

  fs.writeFileSync(file, content);
  console.log(`Updated EquipmentScreen in ${file}`);
});
