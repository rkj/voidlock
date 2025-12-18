import { CoreEngine } from './CoreEngine';
import { WorkerMessage, MainMessage } from '../shared/types';

let engine: CoreEngine | null = null;
let loopId: any = null;

const TICK_RATE = 100; // ms

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'INIT': {
      if (loopId) clearInterval(loopId);
      engine = new CoreEngine(msg.payload.map, msg.payload.seed, msg.payload.squadConfig, msg.payload.agentControlEnabled, msg.payload.missionType);
      
      // Start loop
      loopId = setInterval(() => {
        if (!engine) return;
        engine.update(TICK_RATE);
        const updateMsg: MainMessage = {
          type: 'STATE_UPDATE',
          payload: engine.getState()
        };
        self.postMessage(updateMsg);
      }, TICK_RATE);
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