import { createElement, Fragment } from "@src/renderer/jsx";
import { SquadConfig, MissionType } from "@src/shared/types";
import { ArchetypeLibrary } from "@src/shared/types/units";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { CampaignShell } from "@src/renderer/ui/CampaignShell";
import { ModalService } from "@src/renderer/ui/ModalService";

type DragData =
  | { type: "campaign"; id: string; archetypeId: string }
  | { type: "custom"; archetypeId: string };

export interface SquadBuilderConfig {
  containerId: string;
  campaignManager: CampaignManager;
  campaignShell: CampaignShell;
  modalService: ModalService;
  initialSquad: SquadConfig;
  missionType: MissionType;
  isCampaign: boolean;
  onSquadUpdated: (squad: SquadConfig) => void;
}

export class SquadBuilder {
  private container: HTMLElement;
  private manager: CampaignManager;
  private shell: CampaignShell;
  private modal: ModalService;
  private squad: SquadConfig;
  private missionType: MissionType;
  private isCampaign: boolean;
  private onSquadUpdated: (squad: SquadConfig) => void;
  private selectedId: string | null = null;

  constructor(config: SquadBuilderConfig) {
    const el = document.getElementById(config.containerId);
    if (!el) {
      throw new Error(`SquadBuilder container not found: ${config.containerId} (config: ${JSON.stringify(config)})`);
    }
    this.container = el;
    this.manager = config.campaignManager;
    this.shell = config.campaignShell;
    this.modal = config.modalService;
    this.squad = config.initialSquad;
    this.missionType = config.missionType;
    this.isCampaign = config.isCampaign;
    this.onSquadUpdated = config.onSquadUpdated;
  }

  public update(
    squad: SquadConfig,
    missionType: MissionType,
    isCampaign: boolean,
  ) {
    this.squad = squad;
    this.missionType = missionType;
    this.isCampaign = isCampaign;
    this.render();
  }

  private addToSquad = async (data: DragData) => {
    const MAX_SQUAD_SIZE = 4;
    const isEscortMission = this.missionType === MissionType.EscortVIP;

    const totalNonVip = this.squad.soldiers.filter(
      (s) => s && s.archetypeId !== "vip",
    ).length;
    const hasVipInSquad = this.squad.soldiers.some(
      (s) => s && s.archetypeId === "vip",
    );

    if (data.archetypeId === "vip") {
      if (isEscortMission || hasVipInSquad) {
        await this.modal.alert("VIP already assigned.");
        return;
      }
    } else {
      if (totalNonVip >= MAX_SQUAD_SIZE) {
        await this.modal.alert(
          `Maximum of ${MAX_SQUAD_SIZE} soldiers allowed.`,
        );
        return;
      }
    }

    if (data.type === "campaign") {
      if (this.squad.soldiers.some((s) => s && s.id === data.id)) return;
      const state = this.manager.getState();
      const s = state?.roster.find((r) => r.id === data.id);
      if (s) {
        this.squad.soldiers.push({
          id: s.id,
          name: s.name,
          archetypeId: s.archetypeId,
          hp: s.hp,
          maxHp: s.maxHp,
          soldierAim: s.soldierAim,
          rightHand: s.equipment.rightHand,
          leftHand: s.equipment.leftHand,
          body: s.equipment.body,
          feet: s.equipment.feet,
        });
      }
    } else {
      const arch = ArchetypeLibrary[data.archetypeId];
      this.squad.soldiers.push({
        archetypeId: data.archetypeId,
        name: NameGenerator.generate(),
        hp: arch.baseHp,
        maxHp: arch.baseHp,
        soldierAim: arch.soldierAim,
        rightHand: arch.rightHand,
        leftHand: arch.leftHand,
        body: arch.body,
        feet: arch.feet,
      });
    }
    this.onSquadUpdated(this.squad);
    this.render();
  };

  private handleRecruit = async () => {
    const state = this.manager.getState();
    if (!state) return;
    const MAX_SQUAD_SIZE = 4;

    try {
      const newId = this.manager.recruitSoldier(
        state.unlockedArchetypes[
          Math.floor(Math.random() * state.unlockedArchetypes.length)
        ],
      );

      // Auto-deploy if slot available
      const totalNonVip = this.squad.soldiers.filter(
        (s) => s && s.archetypeId !== "vip",
      ).length;
      if (totalNonVip < MAX_SQUAD_SIZE) {
        const newState = this.manager.getState();
        const s = newState?.roster.find((r) => r.id === newId);
        if (s) {
          this.squad.soldiers.push({
            id: s.id,
            name: s.name,
            archetypeId: s.archetypeId,
            hp: s.hp,
            maxHp: s.maxHp,
            soldierAim: s.soldierAim,
            rightHand: s.equipment.rightHand,
            leftHand: s.equipment.leftHand,
            body: s.equipment.body,
            feet: s.equipment.feet,
          });
        }
      }

      if (this.shell) this.shell.refresh();
      this.onSquadUpdated(this.squad);
      this.render();

      // Move focus to the first deployment slot (Spec 9)
      const firstSlot = this.container.querySelector(
        ".deployment-slot:not(.locked)",
      ) as HTMLElement;
      if (firstSlot) firstSlot.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.modal.alert(message);
    }
  };

  private handleRevive = async (soldierId: string) => {
    const MAX_SQUAD_SIZE = 4;
    try {
      this.manager.reviveSoldier(soldierId);

      // Auto-deploy if slot available
      const totalNonVip = this.squad.soldiers.filter(
        (s) => s && s.archetypeId !== "vip",
      ).length;
      if (
        totalNonVip < MAX_SQUAD_SIZE &&
        !this.squad.soldiers.some((s) => s && s.id === soldierId)
      ) {
        const newState = this.manager.getState();
        const s = newState?.roster.find((r) => r.id === soldierId);
        if (s) {
          this.squad.soldiers.push({
            id: s.id,
            name: s.name,
            archetypeId: s.archetypeId,
            hp: s.hp,
            maxHp: s.maxHp,
            soldierAim: s.soldierAim,
            rightHand: s.equipment.rightHand,
            leftHand: s.equipment.leftHand,
            body: s.equipment.body,
            feet: s.equipment.feet,
          });
        }
      }

      this.onSquadUpdated(this.squad);
      if (this.shell) this.shell.refresh();
      this.render();

      // Move focus to the first deployment slot (Spec 9)
      const firstSlot = this.container.querySelector(
        ".deployment-slot:not(.locked)",
      ) as HTMLElement;
      if (firstSlot) firstSlot.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.modal.alert(message);
    }
  };

  public render() {
    const MAX_SQUAD_SIZE = 4;
    const isEscortMission = this.missionType === MissionType.EscortVIP;
    const total = this.squad.soldiers.filter(
      (s) => s && s.archetypeId !== "vip",
    ).length;

    // Update launch button state
    const launchBtn = document.getElementById(
      "btn-launch-mission",
    ) as HTMLButtonElement;
    if (launchBtn) {
      const isEmpty = total === 0;
      const isOverfilled = total > MAX_SQUAD_SIZE;
      launchBtn.disabled = isEmpty || isOverfilled;
      if (isEmpty) {
        launchBtn.title = "Select at least one asset to authorize operation";
      } else if (isOverfilled) {
        launchBtn.title = `Maximum of ${MAX_SQUAD_SIZE} assets allowed`;
      } else {
        launchBtn.title = "";
      }
    }

    const squadTotalColor =
      total > MAX_SQUAD_SIZE
        ? "var(--color-danger)"
        : total === MAX_SQUAD_SIZE
          ? "var(--color-primary)"
          : "var(--color-text-muted)";

    // Roster logic
    let rosterItems: any[] = [];
    let recruitButton: any = null;

    if (this.isCampaign) {
      const state = this.manager.getState();
      if (state) {
        const statusWeights: Record<string, number> = {
          Healthy: 0,
          Wounded: 1,
          Dead: 2,
        };
        const sortedRoster = [...state.roster].sort((a, b) => {
          const weightA = statusWeights[a.status] ?? 3;
          const weightB = statusWeights[b.status] ?? 3;
          return weightA - weightB;
        });

        const healthyAvailable = sortedRoster.filter(
          (s) =>
            s.status === "Healthy" &&
            !this.squad.soldiers.some((deployed) => deployed && deployed.id === s.id) &&
            s.archetypeId !== "vip",
        );

        // Auto-select logic
        if (this.selectedId === null && healthyAvailable.length > 0) {
          this.selectedId = healthyAvailable[0].id;
        } else if (this.selectedId !== null) {
          const isStillAvailable = healthyAvailable.some(
            (s) => s.id === this.selectedId,
          );
          if (!isStillAvailable) {
            this.selectedId = healthyAvailable.length > 0 ? healthyAvailable[0].id : null;
          }
        }

        rosterItems = sortedRoster
          .filter((s) => s.archetypeId !== "vip")
          .filter((s) => !this.squad.soldiers.some((deployed) => deployed && deployed.id === s.id))
          .map((soldier) => {
            const isHealthy = soldier.status === "Healthy";
            const card = SoldierWidget.render(soldier, {
              context: "squad-builder",
              isDeployed: false,
              onClick: isHealthy ? () => {
                this.selectedId = soldier.id;
                this.addToSquad({
                  type: "campaign",
                  id: soldier.id,
                  archetypeId: soldier.archetypeId,
                });
              } : undefined,
              onDoubleClick: isHealthy ? () => this.addToSquad({
                type: "campaign",
                id: soldier.id,
                archetypeId: soldier.archetypeId,
              }) : undefined
            });

            if (soldier.id === this.selectedId) {
              card.classList.add("selected-for-deployment");
            }

            // Draggable
            if (isHealthy) {
              card.draggable = true;
              card.addEventListener("dragstart", (e) => {
                const dragData: DragData = {
                  type: "campaign",
                  id: soldier.id,
                  archetypeId: soldier.archetypeId,
                };
                e.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
              });
            }

            // Revive button for dead clones
            if (soldier.status === "Dead" && state.rules.deathRule === "Clone") {
              const canAfford = state.scrap >= 250;
              card.appendChild(
                <button
                  class="btn-revive"
                  data-focus-id={`revive-squad-builder-${soldier.id}`}
                  disabled={!canAfford}
                  onClick={(e: Event) => {
                    e.stopPropagation();
                    this.handleRevive(soldier.id);
                  }}
                >
                  Restore Lost Asset (250 Credits)
                </button>
              );
            }

            return card;
          });

        if (state.roster.length < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
          recruitButton = (
            <button
              class="btn-recruit"
              data-focus-id="btn-recruit-squad-builder"
              disabled={state.scrap < 100}
              onClick={this.handleRecruit}
            >
              Acquire New Asset (100 Credits)
            </button>
          );
        }
      }
    } else {
      // Custom mode
      const availableArchetypes = Object.values(ArchetypeLibrary).filter(
        (arch) =>
          arch.id !== "vip" &&
          !this.squad.soldiers.some((s) => s && s.archetypeId === arch.id),
      );

      if (this.selectedId === null && availableArchetypes.length > 0) {
        this.selectedId = availableArchetypes[0].id;
      } else if (this.selectedId !== null) {
        const isStillAvailable = availableArchetypes.some(
          (arch) => arch.id === this.selectedId,
        );
        if (!isStillAvailable) {
          this.selectedId = availableArchetypes.length > 0 ? availableArchetypes[0].id : null;
        }
      }

      rosterItems = Object.values(ArchetypeLibrary)
        .filter((arch) => !(arch.id === "vip" && isEscortMission))
        .filter((arch) => !this.squad.soldiers.some((s) => s && s.archetypeId === arch.id))
        .map((arch) => {
          const card = SoldierWidget.render(arch, {
            context: "squad-builder",
            onClick: () => {
              this.selectedId = arch.id;
              this.addToSquad({ type: "custom", archetypeId: arch.id });
            },
            onDoubleClick: () => this.addToSquad({ type: "custom", archetypeId: arch.id })
          });

          if (arch.id === this.selectedId) {
            card.classList.add("selected-for-deployment");
          }

          card.draggable = true;
          card.addEventListener("dragstart", (e) => {
            const dragData: DragData = { type: "custom", archetypeId: arch.id };
            e.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
          });

          return card;
        });
    }

    // Slots logic
    const hasVip =
      isEscortMission ||
      this.squad.soldiers.some((s) => s && s.archetypeId === "vip");
    const vipInSquad = this.squad.soldiers.find(
      (s) => s && s.archetypeId === "vip",
    );
    const numSlots = hasVip ? 5 : 4;
    const slots: any[] = [];

    const nonVipSoldiers = this.squad.soldiers.filter(
      (s) => s && s.archetypeId !== "vip",
    );

    for (let i = 0; i < numSlots; i++) {
      let slotContent: any = null;
      let slotClass = "deployment-slot";
      let slotLabel = `Deployment Slot ${hasVip ? (i === 0 ? "VIP" : i) : i + 1}`;
      let tabIndex = -1;
      let onClick: any = null;
      let onKeyDown: any = null;

      if (i === 0 && hasVip) {
        if (isEscortMission) {
          slotClass += " locked";
          slotContent = <strong style={{ color: "var(--color-accent)" }}>VIP</strong>;
        } else if (vipInSquad) {
          slotClass += " occupied vip-slot";
          tabIndex = 0;
          const card = SoldierWidget.render(vipInSquad, { context: "squad-builder" });
          card.appendChild(
            <div
              class="slot-remove"
              title="Remove"
              tabindex="-1"
              onClick={(e: Event) => {
                e.stopPropagation();
                const idx = this.squad.soldiers.findIndex((s) => s && s.archetypeId === "vip");
                if (idx !== -1) this.squad.soldiers.splice(idx, 1);
                this.onSquadUpdated(this.squad);
                this.render();
              }}
            >
              X
            </div>
          );
          slotContent = card;
        }
      } else {
        const soldierIdx = hasVip ? i - 1 : i;
        const soldier = nonVipSoldiers[soldierIdx];

        if (soldier) {
          slotClass += " occupied";
          tabIndex = 0;
          const card = SoldierWidget.render(soldier, { context: "squad-builder" });
          card.appendChild(
            <div
              class="slot-remove"
              title="Remove"
              tabindex="-1"
              onClick={(e: Event) => {
                e.stopPropagation();
                const actualIdx = this.squad.soldiers.indexOf(soldier);
                if (actualIdx !== -1) this.squad.soldiers.splice(actualIdx, 1);
                this.onSquadUpdated(this.squad);
                this.render();
              }}
            >
              X
            </div>
          );
          slotContent = card;
          // Support dblclick to remove as well
          // (Handled by manual listener later)
        } else {
          slotContent = <div style={{ color: "var(--color-text-dim)", fontSize: "0.8em" }}>(Empty)</div>;
          if (this.selectedId) {
            tabIndex = 0;
            slotClass += " ready-for-placement";
            onClick = () => {
              if (this.selectedId) {
                if (this.isCampaign) {
                  const state = this.manager.getState();
                  const s = state?.roster.find((r) => r.id === this.selectedId);
                  if (s) this.addToSquad({ type: "campaign", id: s.id, archetypeId: s.archetypeId });
                } else {
                  this.addToSquad({ type: "custom", archetypeId: this.selectedId! });
                }
              }
            };
            onKeyDown = (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick();
                e.preventDefault();
              }
            };
          }
        }
      }

      const slotEl = (
        <div
          class={slotClass}
          aria-label={slotLabel}
          tabindex={tabIndex}
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          {slotContent}
        </div>
      ) as HTMLElement;

      // Add Drag & Drop listeners
      if (!slotClass.includes("occupied") && !slotClass.includes("locked")) {
        slotEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          slotEl.classList.add("drag-over");
        });
        slotEl.addEventListener("dragleave", () => slotEl.classList.remove("drag-over"));
        slotEl.addEventListener("drop", (e) => {
          e.preventDefault();
          slotEl.classList.remove("drag-over");
          const dataStr = e.dataTransfer?.getData("text/plain");
          if (dataStr) this.addToSquad(JSON.parse(dataStr));
        });
      }
      
      // Double click to remove for occupied slots
      if (slotClass.includes("occupied")) {
          slotEl.addEventListener("dblclick", () => {
              const soldierIdx = hasVip ? i - 1 : i;
              const soldier = i === 0 && hasVip ? vipInSquad : nonVipSoldiers[soldierIdx];
              if (soldier) {
                  const actualIdx = this.squad.soldiers.indexOf(soldier);
                  if (actualIdx !== -1) this.squad.soldiers.splice(actualIdx, 1);
                  this.onSquadUpdated(this.squad);
                  this.render();
              }
          });
      }

      slots.push(slotEl);
    }

    // Final Assembly
    const ui = (
      <Fragment>
        <div id="squad-total-count" style={{ marginBottom: "10px", fontWeight: "bold", color: squadTotalColor }}>
          Assigned Assets: {total}/{MAX_SQUAD_SIZE}
        </div>
        <div class="squad-builder-container">
          <div class="panel roster-panel">
            <h2 class="panel-title">Asset Reserve</h2>
            <div class="roster-list">{rosterItems}</div>
            <div class="roster-actions">{recruitButton}</div>
          </div>
          <div class="panel deployment-panel">
            <h2 class="panel-title">Operational Deployment</h2>
            {slots}
          </div>
        </div>
      </Fragment>
    ) as HTMLElement;

    this.container.innerHTML = "";
    this.container.appendChild(ui);
  }
}
