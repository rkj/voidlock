
const fs = require('fs');
const path = require('path');

const files = [
  'tests/data/goldens/2026-01-08_6x6-dense-bad.json',
  'tests/data/goldens/2026-01-13-7x7_item_in_corridor.json',
  'tests/data/goldens/2026-01-17_line_of_sight.json',
  'tests/data/weird_fight.json',
  'debug_files/broken_map.json'
];

const replacements = [
  { old: '"type": "Xeno-Mite"', new: '"type": "xeno-mite"' },
  { old: '"type": "Warrior-Drone"', new: '"type": "warrior-drone"' },
  { old: '"type": "Praetorian-Guard"', new: '"type": "praetorian-guard"' },
  { old: '"type": "Spitter-Acid"', new: '"type": "spitter-acid"' },
  { old: '"type": "SwarmMelee"', new: '"type": "swarm-melee"' },
  { old: '"type": "Hive"', new: '"type": "hive"' },
  { old: '"type": "AlienScout"', new: '"type": "alien-scout"' },
  { old: '"type": "Grunt"', new: '"type": "grunt"' },
  // Boss is skipped as discussed (ambiguous with CampaignNode)
];

files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  replacements.forEach(rep => {
    // Global replace
    const regex = new RegExp(rep.old, 'g');
    content = content.replace(regex, rep.new);
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes for ${file}`);
  }
});
