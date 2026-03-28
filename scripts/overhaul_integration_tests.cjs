const fs = require('fs');
const path = require('path');

const boilerplate = `
// Mock dependencies
vi.mock("@src/engine/GameClient", () => ({
  GameClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    onObservation: vi.fn(),
    sendCommand: vi.fn(),
    onMessage: vi.fn(),
    freezeForDialog: vi.fn(),
    unfreezeAfterDialog: vi.fn(),
    addStateUpdateListener: vi.fn(),
    removeStateUpdateListener: vi.fn(),
    getIsPaused: vi.fn().mockReturnValue(false),
    getTargetScale: vi.fn().mockReturnValue(1.0),
    getReplayData: vi.fn().mockReturnValue({ timeline: [] }),
  })),
}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    mockCampaignState: {
      scrap: 500,
      intel: 10,
      currentSector: 1,
      history: [],
      nodes: [
        { id: "n1", type: "Combat", status: "Accessible", missionType: "Default", pos: { x: 0, y: 0 }, connections: [] }
      ],
      currentNodeId: "n1",
      roster: [
        { id: "u1", name: "Alpha", archetypeId: "assault", hp: 100, maxHp: 100, kills: 0, xp: 0, status: "Healthy", equipment: {} }
      ],
      rules: { economyMode: "Open", deathRule: "Reinforced" },
      unlockedArchetypes: ["assault"],
      unlockedItems: [],
    }
  }
}));

vi.mock("@src/renderer/ConfigManager", () => ({
  ConfigManager: {
    loadGlobal: vi.fn().mockReturnValue({
      unitStyle: "TacticalIcons",
      themeId: "default",
      phosphorMode: "green",
      logLevel: "INFO",
      debugSnapshots: false,
      debugSnapshotInterval: 500,
      debugOverlay: false,
      locale: "en-corporate",
    }),
    saveGlobal: vi.fn(),
    loadCampaign: vi.fn().mockReturnValue(mocks.mockCampaignState),
    loadCustom: vi.fn().mockReturnValue(null),
    saveCampaign: vi.fn(),
    clearCampaign: vi.fn(),
    getDefault: vi.fn().mockReturnValue({
        fogOfWarEnabled: true,
        debugOverlayEnabled: false,
        agentControlEnabled: false,
        manualDeployment: false,
        debugSnapshotInterval: 500,
        mapWidth: 32,
        mapHeight: 24,
        lastSeed: 12345,
        mapGeneratorType: "DenseShip",
        missionType: "Default",
        squadConfig: { soldiers: [] },
        spawnPointCount: 4,
    }),
  },
}));
`;

const domSetup = \`
    document.body.innerHTML = \\\`
      <div id=\"app\">
        <div id=\"screen-main-menu\" class=\"screen\">
          <button id=\"btn-menu-campaign\">Campaign</button>
          <button id=\"btn-menu-custom\">Custom</button>
          <button id=\"btn-menu-statistics\">Stats</button>
          <button id=\"btn-menu-settings\">Settings</button>
          <button id=\"btn-menu-engineering\">Eng</button>
        </div>
        <div id=\"screen-campaign\" class=\"screen\">
            <div id=\"campaign-shell-top-bar\"></div>
            <div id=\"campaign-shell-footer\"></div>
        </div>
        <div id=\"screen-mission-setup\" class=\"screen\">
            <h1 id=\"mission-setup-title\"></h1>
            <label for=\"map-generator-type\"></label>
            <select id=\"map-generator-type\">
                <option value=\"DenseShip\"></option>
                <option value=\"TreeShip\"></option>
                <option value=\"Procedural\"></option>
                <option value=\"Static\"></option>
            </select>
            <label for=\"mission-type\"></label>
            <select id=\"mission-type\">
                <option value=\"Default\"></option>
                <option value=\"RecoverIntel\"></option>
                <option value=\"ExtractArtifacts\"></option>
                <option value=\"DestroyHive\"></option>
                <option value=\"EscortVIP\"></option>
            </select>
            <div class=\"control-group\">
                <label></label>
                <label><input type=\"checkbox\" id=\"toggle-fog-of-war\"></label>
                <label><input type=\"checkbox\" id=\"toggle-debug-overlay\"></label>
                <label><input type=\"checkbox\" id=\"toggle-los-overlay\"></label>
                <label><input type=\"checkbox\" id=\"toggle-agent-control\"></label>
                <label><input type=\"checkbox\" id=\"toggle-manual-deployment\"></label>
                <label><input type=\"checkbox\" id=\"toggle-allow-tactical-pause\"></label>
            </div>
            <input type=\"number\" id=\"map-width\">
            <input type=\"number\" id=\"map-height\">
            <input type=\"number\" id=\"map-spawn-points\">
            <span id=\"map-spawn-points-value\"></span>
            <input type=\"range\" id=\"map-starting-threat\">
            <span id=\"map-starting-threat-value\"></span>
            <input type=\"range\" id=\"map-base-enemies\">
            <span id=\"map-base-enemies-value\"></span>
            <input type=\"range\" id=\"map-enemy-growth\">
            <span id=\"map-enemy-growth-value\"></span>
            
            <div id=\"static-map-controls\">
                <textarea id=\"static-map-json\"></textarea>
                <button id=\"load-static-map\"></button>
                <input type=\"file\" id=\"upload-static-map\">
            </div>
            <textarea id=\"ascii-map-input\"></textarea>
            <button id=\"convert-ascii-to-map\"></button>
            <input type=\"file\" id=\"import-replay\">

            <button id=\"btn-goto-equipment\"></button>
            <button id=\"btn-start-mission\"></button>
            <button id=\"btn-setup-back\"></button>
        </div>
        <div id=\"screen-equipment\" class=\"screen\"></div>
        <div id=\"screen-debrief\" class=\"screen\">
            <canvas id=\"debrief-replay-canvas\"></canvas>
        </div>
        <div id=\"screen-campaign-summary\" class=\"screen\"></div>
        <div id=\"screen-statistics\" class=\"screen\"></div>
        <div id=\"screen-engineering\" class=\"screen\"></div>
        <div id=\"screen-settings\" class=\"screen\"></div>
        <div id=\"screen-campaign-shell\"></div>
        <div id=\"screen-mission\" class=\"screen\">
            <div id=\"mission-body\"></div>
            <canvas id=\"game-canvas\"></canvas>
            <button id=\"btn-pause-toggle\"></button>
            <button id=\"btn-give-up\"></button>
        </div>
      </div>
      <div id=\"modal-container\"></div>
    \\\`;
\`;

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath));
    } else if (file.endsWith('.test.ts') && (fullPath.includes('/integration/') || fullPath.includes('ResetData') || fullPath.includes('CustomFlowTabs'))) {
        results.push(fullPath);
    }
  });
  return results;
}

const files = findFiles('tests');
console.log(\`Found \${files.length} integration files to overhaul\`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace all mocks with boilerplate
  content = content.replace(/vi\.mock\("@src\/engine\/GameClient"(.|\n)*?\}\)\);/g, '');
  content = content.replace(/vi\.mock\("@src\/renderer\/ConfigManager"(.|\n)*?\}\)\);/g, '');
  content = content.replace(/const mockCampaignState(.|\n)*?\}\);/g, '');
  
  // Insert boilerplate after imports
  const firstDescribe = content.indexOf('describe(');
  if (firstDescribe !== -1) {
      content = content.slice(0, firstDescribe) + boilerplate + content.slice(firstDescribe);
  }

  // Replace innerHTML setup
  content = content.replace(/document\.body\.innerHTML = \`(.|\n)*?\`;/g, domSetup);

  // Ensure Canvas mock exists
  if (!content.includes('HTMLCanvasElement.prototype.getContext')) {
      const firstBeforeEach = content.indexOf('beforeEach(');
      const insertPos = content.indexOf('{', firstBeforeEach) + 1;
      content = content.slice(0, insertPos) + \`
    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
      fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(), drawImage: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), setLineDash: vi.fn(),
    });
\` + content.slice(insertPos);
  }

  fs.writeFileSync(file, content);
  console.log(\`Overhauled \${file}\`);
});
