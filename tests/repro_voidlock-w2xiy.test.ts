import { describe, it, expect, vi } from "vitest";
import { MissionManager } from "@src/engine/managers/MissionManager";
import { GameState, MissionType, CellType } from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";

describe("Reproduction: Optional Scrap Crates appearing in Objectives", () => {
    it("should NOT include map-based Recover objectives in Default mission objectives", () => {
        const prng = new PRNG(12345);
        const missionManager = new MissionManager(MissionType.Default, prng);

        const mockMap = {
            width: 10,
            height: 10,
            cells: [
                { x: 5, y: 5, type: CellType.Floor, roomId: "room-1" }
            ],
            objectives: [
                { id: "map-obj-1", kind: "Recover", targetCell: { x: 5, y: 5 } }
            ],
            extraction: { x: 0, y: 0 }
        };

        const state: Partial<GameState> = {
            t: 0,
            seed: 12345,
            missionType: MissionType.Default,
            map: mockMap as any,
            units: [],
            enemies: [],
            visibleCells: [],
            discoveredCells: [],
            objectives: [],
            stats: {
                aliensKilled: 0,
                scrapGained: 0,
                intelGained: 0,
                unitsLost: 0,
                shotsFired: 0,
                shotsHit: 0
            } as any,
            settings: {
                debugOverlayEnabled: false
            } as any
        };

        const mockEnemyManager = { addEnemy: vi.fn() };
        const mockLootManager = { spawnLoot: vi.fn() };

        missionManager.setupMission(
            state as GameState, 
            mockMap as any, 
            mockEnemyManager as any, 
            { soldiers: [], inventory: {} },
            undefined,
            mockLootManager as any
        );
        
        const hasMapObj = state.objectives?.some(o => o.id === "map-obj-1");
        
        // This is EXPECTED to fail (returning true) because MissionType.Default is currently in isRecoverMission
        expect(hasMapObj).toBe(false);
    });
});
