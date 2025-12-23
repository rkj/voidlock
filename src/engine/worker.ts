import { CoreEngine } from './CoreEngine';
import { WorkerMessage, MainMessage } from '../shared/types';

let engine: CoreEngine | null = null;
let loopId: any = null;

const TICK_RATE = 16; // Fixed 16ms (~60Hz) for smooth state updates
let timeScale = 1.0; // Default 1x speed

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'INIT': {
      if (loopId) clearInterval(loopId);
      engine = new CoreEngine(
          msg.payload.map, 
          msg.payload.seed, 
          msg.payload.squadConfig, 
          msg.payload.agentControlEnabled, 
          msg.payload.debugOverlayEnabled, 
          msg.payload.missionType
      );
      
      // Start loop
      loopId = setInterval(() => {
        if (!engine) return;
        // Update game state by scaled delta time
        engine.update(TICK_RATE * timeScale);
        
        const updateMsg: MainMessage = {
          type: 'STATE_UPDATE',
          payload: engine.getState()
        };
        self.postMessage(updateMsg);
      }, TICK_RATE);
      break;
    }
    case 'SET_TIME_SCALE': {
        timeScale = msg.payload;
        break;
    }
    case 'SET_TICK_RATE': {
        // Deprecated or used for debugging frame drops? 
        // For now, ignore or reset interval.
        // Let's ignore it to enforce smoothness.
        break;
    }
    case 'COMMAND': {
      if (engine) {
        engine.applyCommand(msg.payload);
      }
      break;
    }
    case 'QUERY_STATE': {
      if (engine) {
         const updateMsg: MainMessage = {
          type: 'STATE_UPDATE',
          payload: engine.getState()
        };
        self.postMessage(updateMsg);
      }
      break;
    }
  }
};
