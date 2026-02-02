import {
  CampaignState,
  MissionReport,
  calculateLevel,
  STAT_BOOSTS,
} from "../../shared/campaign_types";
import { XP_REWARDS, RECRUITMENT_COST } from "../config/GameConstants";

/**
 * Handles mission result processing and campaign progression.
 */
export class MissionReconciler {
  /**
   * Reconciles the campaign state with the result of a completed mission.
   */
  public processMissionResult(
    state: CampaignState,
    report: MissionReport,
  ): void {
    // 1. Update node status
    const node = state.nodes.find((n) => n.id === report.nodeId);
    if (node) {
      node.status = "Cleared";
      state.currentNodeId = node.id;
      state.currentSector = node.rank + 2;

      // All nodes that were Accessible but NOT this one become Skipped
      state.nodes.forEach((n) => {
        if (n.status === "Accessible" && n.id !== node.id) {
          n.status = "Skipped";
        }
      });

      // Unlock connected nodes
      node.connections.forEach((connId) => {
        const nextNode = state.nodes.find((n) => n.id === connId);
        if (
          nextNode &&
          (nextNode.status === "Hidden" ||
            nextNode.status === "Revealed" ||
            nextNode.status === "Accessible")
        ) {
          nextNode.status = "Accessible";
        }
      });
    }

    // 2. Update resources
    state.scrap += report.scrapGained;
    state.intel += report.intelGained;

    // 2.5 Handle Ironman Defeat
    if (state.rules.difficulty === "Ironman" && report.result === "Lost") {
      state.status = "Defeat";
    }

    // 2.6 Handle Campaign Victory
    const maxRank = Math.max(...state.nodes.map((n) => n.rank));
    const isLastNode = node?.rank === maxRank;

    if (report.result === "Won" && (node?.type === "Boss" || isLastNode)) {
      state.status = "Victory";
    } else if (
      report.result === "Lost" &&
      (node?.type === "Boss" || isLastNode)
    ) {
      state.status = "Defeat";
    }

    // 3. Update soldiers
    state.roster.forEach((s) => {
      if (s.recoveryTime && s.recoveryTime > 0) {
        s.recoveryTime--;
        if (s.recoveryTime === 0 && s.status === "Wounded") {
          s.status = "Healthy";
          s.hp = s.maxHp;
        }
      }
    });

    report.soldierResults.forEach((res) => {
      const soldier = state.roster.find((s) => s.id === res.soldierId);
      if (soldier) {
        res.xpBefore = soldier.xp;
        const oldLevel = soldier.level;

        // Calculate XP
        if (res.status === "Dead") {
          res.xpGained = 0;
          res.promoted = false;
        } else {
          const missionXp =
            report.result === "Won"
              ? XP_REWARDS.MISSION_WIN
              : XP_REWARDS.MISSION_LOSS;
          const survivalXp =
            res.status === "Healthy" || res.status === "Wounded"
              ? XP_REWARDS.SURVIVAL_BONUS
              : 0;
          const killXp = res.kills * XP_REWARDS.KILL;

          res.xpGained = missionXp + survivalXp + killXp;
        }

        soldier.xp += res.xpGained;
        soldier.kills += res.kills;
        soldier.missions += 1;
        soldier.status = res.status;

        if (soldier.status === "Wounded") {
          soldier.recoveryTime = 1;
          res.recoveryTime = 1;
        }

        if (res.status !== "Dead") {
          const newLevel = calculateLevel(soldier.xp);
          if (newLevel > oldLevel) {
            const levelsGained = newLevel - oldLevel;
            soldier.level = newLevel;
            soldier.maxHp += levelsGained * STAT_BOOSTS.hpPerLevel;
            soldier.hp += levelsGained * STAT_BOOSTS.hpPerLevel;
            soldier.soldierAim += levelsGained * STAT_BOOSTS.aimPerLevel;

            res.promoted = true;
            res.newLevel = newLevel;
          }
        }

        // Handle death rules
        if (soldier.status === "Dead") {
          if (state.rules.deathRule === "Simulation") {
            soldier.status = "Healthy";
            soldier.hp = soldier.maxHp;
          }
        }
      }
    });

    // 4. Record history
    state.history.push(report);

    // 5. Check for bankruptcy/defeat
    if (state.status !== "Defeat" && this.checkBankruptcy(state)) {
      state.status = "Defeat";
    }
  }

  /**
   * Advances the campaign without a combat mission.
   */
  public advanceCampaignWithoutMission(
    state: CampaignState,
    nodeId: string,
    scrapGained: number,
    intelGained: number,
  ): void {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = "Cleared";
      state.currentNodeId = node.id;
      state.currentSector = node.rank + 2;

      state.nodes.forEach((n) => {
        if (n.status === "Accessible" && n.id !== node.id) {
          n.status = "Skipped";
        }
      });

      node.connections.forEach((connId) => {
        const nextNode = state.nodes.find((n) => n.id === connId);
        if (
          nextNode &&
          (nextNode.status === "Hidden" ||
            nextNode.status === "Revealed" ||
            nextNode.status === "Accessible")
        ) {
          nextNode.status = "Accessible";
        }
      });
    }

    state.scrap += scrapGained;
    state.intel += intelGained;

    // Advance time for wounded soldiers
    state.roster.forEach((s) => {
      if (s.recoveryTime && s.recoveryTime > 0) {
        s.recoveryTime--;
        if (s.recoveryTime === 0 && s.status === "Wounded") {
          s.status = "Healthy";
          s.hp = s.maxHp;
        }
      }
    });

    state.history.push({
      nodeId: nodeId,
      seed: 0,
      result: "Won",
      aliensKilled: 0,
      scrapGained: scrapGained,
      intelGained: intelGained,
      timeSpent: 0,
      soldierResults: [],
    });
  }

  /**
   * Checks if the campaign is in a bankruptcy state.
   */
  public checkBankruptcy(state: CampaignState): boolean {
    const healthyCount = state.roster.filter(
      (s) => s.status === "Healthy",
    ).length;
    const canAffordRecruit = state.scrap >= RECRUITMENT_COST;
    return healthyCount === 0 && !canAffordRecruit;
  }
}
