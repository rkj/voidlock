import { CoreEngine } from "./CoreEngine";
import { WorkerMessage, MainMessage, EngineMode } from "../shared/types";

let engine: CoreEngine | null = null;
let loopId: ReturnType<typeof setInterval> | null = null;

const TICK_RATE = 16; // Fixed 16ms (~60Hz) for smooth state updates
let timeScale = 1.0; // Default 1.0x speed

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT": {
      if (loopId) clearInterval(loopId);
      timeScale = msg.payload.initialTimeScale ?? 1.0;
      engine = new CoreEngine(
        msg.payload.map,
        msg.payload.seed,
        msg.payload.squadConfig,
        msg.payload.agentControlEnabled,
        msg.payload.debugOverlayEnabled,
        msg.payload.missionType,
        msg.payload.losOverlayEnabled ?? false,
        msg.payload.startingThreatLevel,
        timeScale,
        msg.payload.startPaused ?? false,
        msg.payload.mode ?? EngineMode.Simulation,
        msg.payload.commandLog ?? [],
        msg.payload.allowTacticalPause ?? true,
        msg.payload.targetTick ?? 0,
        msg.payload.baseEnemyCount,
        msg.payload.enemyGrowthPerMission,
        msg.payload.missionDepth,
        msg.payload.nodeType,
        msg.payload.campaignNodeId,
        undefined,
        msg.payload.skipDeployment ?? false,
        msg.payload.debugSnapshots ?? false,
        msg.payload.debugSnapshotInterval ?? 0,
        msg.payload.initialSnapshots ?? [],
      );

      // Start loop
      loopId = setInterval(() => {
        if (!engine) return;

        // TICK_RATE is 16ms, so 1.0 timeScale should result in 16ms scaledDt.
        const scaledDt = TICK_RATE * timeScale;

        engine.update(scaledDt);

        const state = engine.getState(true);
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
          // We keep engine for QUERY_STATE if needed, or null it?
          // For now, keep it so final state can be inspected if needed.
        }
      }, TICK_RATE);
      break;
    }
    case "STOP": {
      if (loopId) {
        clearInterval(loopId);
        loopId = null;
      }
      engine = null;
      break;
    }
    case "SET_TIME_SCALE": {
      timeScale = msg.payload;
      if (engine) {
        engine.setTimeScale(timeScale);
      }
      break;
    }
    case "SET_TICK_RATE": {
      // Deprecated or used for debugging frame drops?
      // For now, ignore or reset interval.
      // Let's ignore it to enforce smoothness.
      break;
    }
    case "COMMAND": {
      if (engine) {
        engine.applyCommand(msg.payload);
      }
      break;
    }
    case "QUERY_STATE": {
      if (engine) {
        const updateMsg: MainMessage = {
          type: "STATE_UPDATE",
          payload: engine.getState(true),
        };
        self.postMessage(updateMsg);
      }
      break;
    }
  }
};
