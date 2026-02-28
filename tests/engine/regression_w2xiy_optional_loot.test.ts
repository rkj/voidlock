import { describe, it, expect, vi } from "vitest";
import { MissionManager } from "@src/engine/managers/MissionManager";
import { GameState, MissionType, CellType } from "@src/shared/types";
import { PRNG } from "@src/shared/PRNG";

describe("Regression: Optional Scrap Crates appearing in Objectives", () => {
    it("should NOT include map-based Recover objectives in Default mission objectives when nodeType is Combat", () => {
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
            campaignNodeId: "test-node", // Added to simulate campaign
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
            "Combat", // Passing nodeType="Combat"
            mockLootManager as any
        );
        
        const hasMapObj = state.objectives?.some(o => o.id === "map-obj-1");
        
        // This should now PASS (returning false)
        expect(hasMapObj).toBe(false);
        
        // And it should have spawned loot instead
        expect(mockLootManager.spawnLoot).toHaveBeenCalledWith(state, "scrap_crate", { x: 5, y: 5 });
    });

    it("should STILL include map-based Recover objectives in Default mission objectives when nodeType is missing (Legacy/Test support)", () => {
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
            undefined, // Missing nodeType
            mockLootManager as any
        );
        
        const hasMapObj = state.objectives?.some(o => o.id === "map-obj-1");
        
        // This should remain TRUE for legacy support
        expect(hasMapObj).toBe(true);
    });
});
