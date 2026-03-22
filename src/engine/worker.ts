import { CoreEngine } from "./CoreEngine";
import type { WorkerMessage, MainMessage} from "../shared/types";
import { EngineMode } from "../shared/types";

let engine: CoreEngine | null = null;
let loopId: ReturnType<typeof setInterval> | null = null;

const TICK_RATE = 16; // Fixed 16ms (~60Hz) for smooth state updates
let timeScale = 1.0; // Default 1.0x speed

function handleInit(msg: WorkerMessage & { type: "INIT" }): void {
  if (loopId) clearInterval(loopId);
  timeScale = msg.payload.initialTimeScale ?? 1.0;
  engine = new CoreEngine({
    map: msg.payload.map,
    seed: msg.payload.seed,
    squadConfig: msg.payload.squadConfig,
    agentControlEnabled: msg.payload.agentControlEnabled,
    debugOverlayEnabled: msg.payload.debugOverlayEnabled,
    missionType: msg.payload.missionType,
    losOverlayEnabled: msg.payload.losOverlayEnabled ?? false,
    startingThreatLevel: msg.payload.startingThreatLevel,
    initialTimeScale: timeScale,
    startPaused: msg.payload.startPaused ?? false,
    mode: msg.payload.mode ?? EngineMode.Simulation,
    initialCommandLog: msg.payload.commandLog ?? [],
    allowTacticalPause: msg.payload.allowTacticalPause ?? true,
    targetTick: msg.payload.targetTick ?? 0,
    baseEnemyCount: msg.payload.baseEnemyCount,
    enemyGrowthPerMission: msg.payload.enemyGrowthPerMission,
    missionDepth: msg.payload.missionDepth,
    nodeType: msg.payload.nodeType,
    campaignNodeId: msg.payload.campaignNodeId,
    startingPoints: msg.payload.startingPoints,
    skipDeployment: msg.payload.skipDeployment ?? false,
    debugSnapshots: msg.payload.debugSnapshots ?? false,
    debugSnapshotInterval: msg.payload.debugSnapshotInterval ?? 0,
    initialSnapshots: msg.payload.initialSnapshots ?? [],
    targetTimeScale: msg.payload.targetTimeScale ?? timeScale,
    sessionId: msg.payload.sessionId,
  });

  // Start loop
  let lastSnapshotCount = 0;
  loopId = setInterval(() => {
    if (!engine) return;

    // Use authoritative timeScale from engine settings (ADR 0048)
    const engineState = engine.getState(false);
    const effectiveTimeScale = engineState.settings.timeScale;
    const scaledDt = TICK_RATE * effectiveTimeScale;

    engine.update(scaledDt);

    const includeSnapshots = engineState.settings.debugSnapshots;
    const state = engine.getState(true, includeSnapshots);

    // Optimization: only send full snapshots array if it changed
    if (includeSnapshots && state.snapshots) {
      if (state.snapshots.length === lastSnapshotCount) {
        delete state.snapshots;
      } else {
        lastSnapshotCount = state.snapshots.length;
      }
    }

    const updateMsg: MainMessage = {
      type: "STATE_UPDATE",
      payload: state,
    };
    self.postMessage(updateMsg);

    // Stop loop if mission ended and NOT in Replay mode
    if (
      state.status !== "Playing" &&
      state.status !== "Deployment" &&
      state.settings.mode !== EngineMode.Replay
    ) {
      if (loopId) {
        clearInterval(loopId);
        loopId = null;
      }
    }
  }, TICK_RATE);
}

function handleStop(): void {
  if (loopId) {
    clearInterval(loopId);
    loopId = null;
  }
  engine = null;
}

function handleQueryState(): void {
  if (!engine) return;
  const includeSnapshots = engine.getState(false).settings.debugSnapshots;
  const updateMsg: MainMessage = {
    type: "STATE_UPDATE",
    payload: engine.getState(true, includeSnapshots),
  };
  self.postMessage(updateMsg);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      handleInit(msg);
      break;
    case "STOP":
      handleStop();
      break;
    case "SET_TIME_SCALE":
      timeScale = msg.payload;
      if (engine) engine.setTimeScale(timeScale);
      break;
    case "SET_TARGET_TIME_SCALE":
      if (engine) engine.setTargetTimeScale(msg.payload);
      break;
    case "SET_PAUSED":
      if (engine) engine.setPaused(msg.payload);
      break;
    case "SET_TICK_RATE":
      // Deprecated or used for debugging frame drops — ignored to enforce smoothness.
      break;
    case "COMMAND":
      if (engine) engine.applyCommand(msg.payload);
      break;
    case "QUERY_STATE":
      handleQueryState();
      break;
  }
};
