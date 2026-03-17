import { describe, it, expect, vi } from "vitest";
import { TutorialManager } from "../../../src/renderer/controllers/TutorialManager";

describe("TutorialManager inputGate fix", () => {
    it("should allow SELECT_UNIT in all command steps", () => {
        const mockGameClient = { addStateUpdateListener: vi.fn(), removeStateUpdateListener: vi.fn() } as any;
        const mockCampaignManager = {} as any;
        const mockMenuController = {} as any;
        const manager = new TutorialManager(mockGameClient, mockCampaignManager, mockMenuController, vi.fn(), () => "s1");
        
        const steps = (manager as any).prologueSteps;
        
        const stepsToVerify = ["engagement_ignore", "engagement_engage", "move", "pickup", "extract"];
        
        stepsToVerify.forEach(stepId => {
            const step = steps.find((s: any) => s.id === stepId);
            expect(step).toBeDefined();
            expect(step.inputGate.allowedActions).toContain("SELECT_UNIT");
        });
    });
});