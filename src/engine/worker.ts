import { CoreEngine } from './CoreEngine';
import { WorkerMessage, MainMessage } from '../shared/types';

let engine: CoreEngine | null = null;
let loopId: any = null;

let TICK_RATE = 300; // ms

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  const startLoop = (rate: number) => {
      if (loopId) clearInterval(loopId);
      loopId = setInterval(() => {
        if (!engine) return;
        engine.update(rate);
        const updateMsg: MainMessage = {
          type: 'STATE_UPDATE',
          payload: engine.getState()
        };
        self.postMessage(updateMsg);
      }, rate);
  };

  switch (msg.type) {
    case 'INIT': {
      engine = new CoreEngine(
          msg.payload.map, 
          msg.payload.seed, 
          msg.payload.squadConfig, 
          msg.payload.agentControlEnabled, 
          msg.payload.debugOverlayEnabled, 
          msg.payload.missionType
      );
      
      // Start loop
      startLoop(TICK_RATE);
      break;
    }
    case 'SET_TICK_RATE': {
        TICK_RATE = msg.payload;
        startLoop(TICK_RATE);
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