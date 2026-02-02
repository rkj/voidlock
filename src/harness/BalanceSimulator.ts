import { CoreEngine } from "@src/engine/CoreEngine";
import { DenseShipGenerator } from "@src/engine/generators/DenseShipGenerator";
import {
  SquadConfig,
  MissionType,
  UnitState,
  MapDefinition,
} from "@src/shared/types";

const ITERATIONS = 100; // Final verification
const DT = 50; // ms

async function runSimulation() {
  let wins = 0;
  let losses = 0;
  let totalCasualties = 0;
  let winsWithCasualties = 0;

  console.log(`Starting Balance Simulation (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    const seed = Math.floor(Math.random() * 100000);
    // 8x8 Map
    const generator = new DenseShipGenerator(seed, 8, 8);
    const map: MapDefinition = generator.generate();

    // 4 Soldiers
    const squad: SquadConfig = {
      soldiers: [
        { archetypeId: "assault" },
        { archetypeId: "assault" },
        { archetypeId: "medic" },
        { archetypeId: "heavy" },
      ],
      inventory: { medkit: 2, frag_grenade: 4 },
    };

    // Enable agent control
    const engine = new CoreEngine(
      map,
      seed,
      squad,
      true,
      false,
      MissionType.Default,
    );

    let ticks = 0;
    // 5 minutes * 60 seconds * 1000 ms / DT
    const maxTicks = (5 * 60 * 1000) / DT;

    while (engine.getState().status === "Playing" && ticks < maxTicks) {
      engine.update(DT);
      ticks++;
    }

    const state = engine.getState();
    if (state.status === "Won") {
      wins++;
      const deadCount = state.units.filter(
        (u) => u.state === UnitState.Dead,
      ).length;
      totalCasualties += deadCount;
      if (deadCount > 0) winsWithCasualties++;
    } else {
      losses++;
    }

    if (i % 5 === 0) process.stdout.write(".");
  }

  console.log("\n--- Results ---");
  console.log(`Wins: ${wins} (${(wins / ITERATIONS) * 100}%)`);
  console.log(`Losses: ${losses}`);
  console.log(
    `Avg Casualties (Wins): ${(wins > 0 ? totalCasualties / wins : 0).toFixed(2)}`,
  );
  console.log(
    `Wins with Casualties: ${winsWithCasualties} (${(wins > 0 ? (winsWithCasualties / wins) * 100 : 0).toFixed(1)}%)`,
  );
}

runSimulation();
