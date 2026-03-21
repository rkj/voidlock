import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allTestFiles = getFiles(path.join(projectRoot, 'tests'));

allTestFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix GameClient.init with incorrect property names from pass 19
  // Pass 19 incorrectly mapped some arguments. 
  // Specifically, it used a 25-arg list instead of 32, and missed some props.
  if (content.includes('client.init({')) {
      // Robust fix: find the whole object and rebuild it if possible, or just surgical regex
      // Surgical: if it has allowTacticalPause: 10, it's definitely wrong
      if (content.includes('allowTacticalPause: 10') || content.includes('startPaused: 10')) {
          // It's easier to just undo the refactor for this call and let the correct mapper handle it
          // But jj undo is better. 
          // Actually, I'll just use a regex to fix the specific known mismappings in GameClient.test.ts
          
          // Revert to positional (ugly but works for the mapper)
          // 12345, MapGeneratorType.DenseShip, undefined, true, false, true, UnitStyle.TacticalIcons, "default", { ... }, MissionType.Default, 10, 10
          content = content.replace(/client\.init\(\{\s*seed:\s*([^,]+),\s*mapGeneratorType:\s*([^,]+),\s*map:\s*([^,]+),\s*agentControlEnabled:\s*([^,]+),\s*debugOverlayEnabled:\s*([^,]+),\s*fogOfWarEnabled:\s*([^,]+),\s*unitStyle:\s*([^,]+),\s*themeId:\s*([^,]+),\s*squadConfig:\s*([^,]+),\s*missionType:\s*([^,]+),\s*allowTacticalPause:\s*([^,]+),\s*startPaused:\s*([^}\n]+)\s*\}\)/g, 
            'client.init($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)');
          changed = true;
      }
  }

  // DEFINITIVE GameClient.init signature mapping
  const gameClientInitArgs = [
    'seed', 'mapGeneratorType', 'map', 'fogOfWarEnabled', 'debugOverlayEnabled',
    'agentControlEnabled', 'unitStyle', 'themeId', 'squadConfig', 'missionType',
    'width', 'height', 'spawnPointCount', 'losOverlayEnabled', 'startingThreatLevel',
    'initialTimeScale', 'startPaused', 'allowTacticalPause', 'mode', 'commandLog',
    'campaignNodeId', 'targetTick', 'baseEnemyCount', 'enemyGrowthPerMission',
    'missionDepth', 'nodeType', 'startingPoints', 'bonusLootCount', 'skipDeployment',
    'debugSnapshots', 'debugSnapshotInterval', 'initialSnapshots'
  ];

  // Helper to refactor any method call with named config
  function refactorMethod(methodPattern: string, argNames: string[]) {
    let startIndex = 0;
    while ((startIndex = content.indexOf(methodPattern, startIndex)) !== -1) {
      const openParenIndex = content.indexOf('(', startIndex);
      const nextCharIndex = openParenIndex + 1;
      
      let j = nextCharIndex;
      while (j < content.length && /\s/.test(content[j])) j++;
      if (content[j] === '{') {
        startIndex = j;
        continue; 
      }

      let depth = 1;
      let endParenIndex = -1;
      for (let i = nextCharIndex; i < content.length; i++) {
        if (content[i] === '(') depth++;
        else if (content[i] === ')') depth--;
        if (depth === 0) { endParenIndex = i; break; }
      }
      if (endParenIndex === -1) break;

      const argsContent = content.substring(nextCharIndex, endParenIndex);
      const args: string[] = [];
      let currentArg = '';
      let pD = 0, bD = 0, sD = 0;
      for (let i = 0; i < argsContent.length; i++) {
        const char = argsContent[i];
        if (char === '(') pD++;
        else if (char === ')') pD--;
        else if (char === '{') bD++;
        else if (char === '}') bD--;
        else if (char === '[') sD++;
        else if (char === ']') sD--;
        if (char === ',' && pD === 0 && bD === 0 && sD === 0) {
          args.push(currentArg.trim());
          currentArg = '';
        } else { currentArg += char; }
      }
      args.push(currentArg.trim());

      const configLines = [];
      for (let i = 0; i < args.length; i++) {
        if (i < argNames.length && args[i] !== '') {
          configLines.push(`      ${argNames[i]}: ${args[i]}`);
        }
      }

      const newCall = `${methodPattern}{\n${configLines.join(',\n')}\n    })`;
      content = content.substring(0, startIndex) + newCall + content.substring(endParenIndex + 1);
      changed = true;
      startIndex += newCall.length;
    }
  }

  refactorMethod('client.init(', gameClientInitArgs);
  refactorMethod('this.gameClient.init(', gameClientInitArgs);

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
});

console.log("Cleanup pass 21 complete.");
