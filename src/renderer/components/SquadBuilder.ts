import { AppContext } from "../app/AppContext";
import { SquadConfig, MissionType, Archetype } from "@src/shared/types";
import { CampaignSoldier } from "@src/shared/campaign_types";
import { ArchetypeLibrary } from "@src/shared/types/units";
import { SoldierWidget } from "@src/renderer/ui/SoldierWidget";
import { NameGenerator } from "@src/shared/utils/NameGenerator";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

type DragData =
  | { type: "campaign"; id: string; archetypeId: string }
  | { type: "custom"; archetypeId: string };

export class SquadBuilder {
  private container: HTMLElement;
  private context: AppContext;
  private squad: SquadConfig;
  private missionType: MissionType;
  private isCampaign: boolean;
  private onSquadUpdated: (squad: SquadConfig) => void;
  private selectedId: string | null = null;

  constructor(
    containerId: string,
    context: AppContext,
    initialSquad: SquadConfig,
    missionType: MissionType,
    isCampaign: boolean,
    onSquadUpdated: (squad: SquadConfig) => void,
  ) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`SquadBuilder container not found: ${containerId}`);
    }
    this.container = el;
    this.context = context;
    this.squad = initialSquad;
    this.missionType = missionType;
    this.isCampaign = isCampaign;
    this.onSquadUpdated = onSquadUpdated;
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

  public render() {
    this.container.innerHTML = "";

    const MAX_SQUAD_SIZE = 4;
    const isEscortMission = this.missionType === MissionType.EscortVIP;

    const totalDiv = document.createElement("div");
    totalDiv.id = "squad-total-count";
    totalDiv.style.marginBottom = "10px";
    totalDiv.style.fontWeight = "bold";
    this.container.appendChild(totalDiv);

    const mainWrapper = document.createElement("div");
    mainWrapper.className = "squad-builder-container";
    this.container.appendChild(mainWrapper);

    const rosterPanel = document.createElement("div");
    rosterPanel.className = "panel roster-panel";
    mainWrapper.appendChild(rosterPanel);

    const rosterTitle = document.createElement("h2");
    rosterTitle.className = "panel-title";
    rosterTitle.textContent = "Roster";
    rosterPanel.appendChild(rosterTitle);

    const rosterList = document.createElement("div");
    rosterList.className = "roster-list";
    rosterPanel.appendChild(rosterList);

    const rosterActions = document.createElement("div");
    rosterActions.className = "roster-actions";
    rosterPanel.appendChild(rosterActions);

    const deploymentPanel = document.createElement("div");
    deploymentPanel.className = "panel deployment-panel";
    mainWrapper.appendChild(deploymentPanel);

    const updateCount = () => {
      const total = this.squad.soldiers.filter(
        (s) => s && s.archetypeId !== "vip",
      ).length;
      totalDiv.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
      totalDiv.style.color =
        total > MAX_SQUAD_SIZE
          ? "var(--color-danger)"
          : total === MAX_SQUAD_SIZE
            ? "var(--color-primary)"
            : "var(--color-text-muted)";
      const launchBtn = document.getElementById(
        "btn-goto-equipment",
      ) as HTMLButtonElement;
      if (launchBtn) launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
      renderRoster();
      renderSlots();
    };

    const renderRoster = () => {
      rosterList.innerHTML = "";
      rosterActions.innerHTML = "";

      if (this.isCampaign) {
        const state = this.context.campaignManager.getState();
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

          // Auto-select if nothing valid selected
          if (this.selectedId === null && healthyAvailable.length > 0) {
            this.selectedId = healthyAvailable[0].id;
          } else if (this.selectedId !== null) {
            // Check if selected is still available
            const isStillAvailable = healthyAvailable.some(
              (s) => s.id === this.selectedId,
            );
            if (!isStillAvailable) {
              if (healthyAvailable.length > 0) {
                this.selectedId = healthyAvailable[0].id;
              } else {
                this.selectedId = null;
              }
            }
          }

          sortedRoster.forEach((soldier) => {
            if (soldier.archetypeId === "vip") return;
            const isSelected = this.squad.soldiers.some(
              (s) => s && s.id === soldier.id,
            );
            if (isSelected) return;
            const card = createCampaignCard(soldier, isSelected);
            if (soldier.id === this.selectedId) {
              card.classList.add("selected-for-deployment");
            }
            rosterList.appendChild(card);
          });

          // Quick Action: Recruit
          if (state.roster.length < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE) {
            const recruitBtn = document.createElement("button");
            recruitBtn.className = "btn-recruit";
            recruitBtn.textContent = "Recruit (100 Scrap)";
            recruitBtn.disabled = state.scrap < 100;
            recruitBtn.onclick = async () => {
              try {
                const newId = this.context.campaignManager.recruitSoldier(
                  state.unlockedArchetypes[
                    Math.floor(Math.random() * state.unlockedArchetypes.length)
                  ],
                );

                // Auto-deploy if slot available
                const totalNonVip = this.squad.soldiers.filter(
                  (s) => s && s.archetypeId !== "vip",
                ).length;
                if (totalNonVip < MAX_SQUAD_SIZE) {
                  const newState = this.context.campaignManager.getState();
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

                if (this.context.campaignShell)
                  this.context.campaignShell.refresh();
                updateCount();
              } catch (err: unknown) {
                const message =
                  err instanceof Error ? err.message : String(err);
                await this.context.modalService.alert(message);
              }
            };
            rosterActions.appendChild(recruitBtn);
          }
        }
      } else {
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
            if (availableArchetypes.length > 0) {
              this.selectedId = availableArchetypes[0].id;
            } else {
              this.selectedId = null;
            }
          }
        }

        Object.values(ArchetypeLibrary).forEach((arch) => {
          if (arch.id === "vip" && isEscortMission) return;
          const isSelected = this.squad.soldiers.some(
            (s) => s && s.archetypeId === arch.id,
          );
          if (isSelected) return;
          const card = createArchetypeCard(arch);
          if (arch.id === this.selectedId) {
            card.classList.add("selected-for-deployment");
          }
          rosterList.appendChild(card);
        });
      }
    };

    const renderSlots = () => {
      deploymentPanel.innerHTML = '<h2 class="panel-title">Deployment</h2>';
      const hasVip =
        isEscortMission ||
        this.squad.soldiers.some((s) => s && s.archetypeId === "vip");
      const numSlots = hasVip ? 5 : 4;
      for (let i = 0; i < numSlots; i++)
        deploymentPanel.appendChild(createSlot(i));
    };

    const addToSquad = async (data: DragData) => {
      const totalNonVip = this.squad.soldiers.filter(
        (s) => s && s.archetypeId !== "vip",
      ).length;
      const hasVipInSquad = this.squad.soldiers.some(
        (s) => s && s.archetypeId === "vip",
      );

      if (data.archetypeId === "vip") {
        if (isEscortMission || hasVipInSquad) {
          await this.context.modalService.alert("VIP already assigned.");
          return;
        }
      } else {
        if (totalNonVip >= MAX_SQUAD_SIZE) {
          await this.context.modalService.alert(
            `Maximum of ${MAX_SQUAD_SIZE} soldiers allowed.`,
          );
          return;
        }
      }

      if (data.type === "campaign") {
        if (this.squad.soldiers.some((s) => s && s.id === data.id)) return;
        const state = this.context.campaignManager.getState();
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
      updateCount();
    };

    const createCampaignCard = (
      soldier: CampaignSoldier,
      isDeployed: boolean,
    ) => {
      const isHealthy = soldier.status === "Healthy";
      const card = SoldierWidget.render(soldier, {
        context: "squad-builder",
        isDeployed: isDeployed,
      });

      if (isHealthy && !isDeployed) {
        card.tabIndex = 0;
        card.draggable = true;
        card.addEventListener("dragstart", (e) => {
          const dragData: DragData = {
            type: "campaign",
            id: soldier.id,
            archetypeId: soldier.archetypeId,
          };
          e.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
        });

        const handleSelect = () => {
          this.selectedId = soldier.id;
          addToSquad({
            type: "campaign",
            id: soldier.id,
            archetypeId: soldier.archetypeId,
          });
        };

        card.addEventListener("click", handleSelect);

        card.addEventListener("keydown", (e: any) => {
          if (e.key === "Enter" || e.key === " ") {
            handleSelect();
            e.preventDefault();
          }
        });

        card.addEventListener("dblclick", () =>
          addToSquad({
            type: "campaign",
            id: soldier.id,
            archetypeId: soldier.archetypeId,
          }),
        );
      }

      if (soldier.status === "Dead" && this.isCampaign) {
        const state = this.context.campaignManager.getState();
        if (state?.rules.deathRule === "Clone") {
          const reviveBtn = document.createElement("button");
          reviveBtn.className = "btn-revive";
          reviveBtn.textContent = "Revive (250 Scrap)";

          const canAfford = state.scrap >= 250;
          reviveBtn.disabled = !canAfford;

          reviveBtn.onclick = async (e) => {
            e.stopPropagation();
            try {
              this.context.campaignManager.reviveSoldier(soldier.id);

              // Auto-deploy if slot available
              const totalNonVip = this.squad.soldiers.filter(
                (s) => s && s.archetypeId !== "vip",
              ).length;
              if (
                totalNonVip < MAX_SQUAD_SIZE &&
                !this.squad.soldiers.some((s) => s && s.id === soldier.id)
              ) {
                const newState = this.context.campaignManager.getState();
                const s = newState?.roster.find((r) => r.id === soldier.id);
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
              if (this.context.campaignShell)
                this.context.campaignShell.refresh();
              updateCount();
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              await this.context.modalService.alert(message);
            }
          };
          card.appendChild(reviveBtn);
        }
      }

      return card;
    };

    const createArchetypeCard = (arch: Archetype) => {
      const card = SoldierWidget.render(arch, {
        context: "squad-builder",
      });
      card.tabIndex = 0;
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        const dragData: DragData = { type: "custom", archetypeId: arch.id };
        e.dataTransfer?.setData("text/plain", JSON.stringify(dragData));
      });

      const handleSelect = () => {
        this.selectedId = arch.id;
        addToSquad({ type: "custom", archetypeId: arch.id });
      };

      card.addEventListener("click", handleSelect);

      card.addEventListener("keydown", (e: any) => {
        if (e.key === "Enter" || e.key === " ") {
          handleSelect();
          e.preventDefault();
        }
      });

      card.addEventListener("dblclick", () =>
        addToSquad({ type: "custom", archetypeId: arch.id }),
      );
      return card;
    };

    const createSlot = (index: number) => {
      const hasVip =
        isEscortMission ||
        this.squad.soldiers.some((s) => s && s.archetypeId === "vip");
      const vipInSquad = this.squad.soldiers.find(
        (s) => s && s.archetypeId === "vip",
      );

      const slot = document.createElement("div");
      slot.className = "deployment-slot";

      if (index === 0 && hasVip) {
        slot.setAttribute("aria-label", "VIP Slot");
        if (isEscortMission) {
          slot.classList.add("locked");
          slot.innerHTML = `<strong style="color:var(--color-accent);">VIP</strong>`;
          return slot;
        } else if (vipInSquad) {
          slot.classList.add("occupied");
          slot.classList.add("vip-slot");

          const card = SoldierWidget.render(vipInSquad, {
            context: "squad-builder",
          });

          const removeBtn = document.createElement("div");
          removeBtn.className = "slot-remove";
          removeBtn.title = "Remove";
          removeBtn.textContent = "X";
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const idx = this.squad.soldiers.findIndex(
              (s) => s && s.archetypeId === "vip",
            );
            if (idx !== -1) this.squad.soldiers.splice(idx, 1);
            this.onSquadUpdated(this.squad);
            updateCount();
          });
          card.appendChild(removeBtn);
          slot.appendChild(card);
          return slot;
        }
      }

      slot.setAttribute(
        "aria-label",
        `Deployment Slot ${hasVip ? index : index + 1}`,
      );

      const nonVipSoldiers = this.squad.soldiers.filter(
        (s) => s && s.archetypeId !== "vip",
      );
      const soldierIdx = hasVip ? index - 1 : index;
      const soldier = nonVipSoldiers[soldierIdx];

      if (soldier) {
        slot.classList.add("occupied");
        const card = SoldierWidget.render(soldier, {
          context: "squad-builder",
        });

        const removeBtn = document.createElement("div");
        removeBtn.className = "slot-remove";
        removeBtn.title = "Remove";
        removeBtn.textContent = "X";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const actualIdx = this.squad.soldiers.indexOf(soldier);
          if (actualIdx !== -1) this.squad.soldiers.splice(actualIdx, 1);
          this.onSquadUpdated(this.squad);
          updateCount();
        });
        card.appendChild(removeBtn);
        slot.appendChild(card);

        slot.addEventListener("dblclick", () => {
          const actualIdx = this.squad.soldiers.indexOf(soldier);
          if (actualIdx !== -1) this.squad.soldiers.splice(actualIdx, 1);
          this.onSquadUpdated(this.squad);
          updateCount();
        });
      } else {
        slot.innerHTML = `<div style="color:var(--color-text-dim); font-size:0.8em;">(Empty)</div>`;

        if (this.selectedId) {
          slot.tabIndex = 0;
          slot.classList.add("ready-for-placement");

          const handlePlace = () => {
            if (this.selectedId) {
              if (this.isCampaign) {
                const state = this.context.campaignManager.getState();
                const soldier = state?.roster.find(
                  (r) => r.id === this.selectedId,
                );
                if (soldier) {
                  addToSquad({
                    type: "campaign",
                    id: soldier.id,
                    archetypeId: soldier.archetypeId,
                  });
                }
              } else {
                addToSquad({
                  type: "custom",
                  archetypeId: this.selectedId,
                });
              }
            }
          };

          slot.addEventListener("click", handlePlace);
          slot.addEventListener("keydown", (e: any) => {
            if (e.key === "Enter" || e.key === " ") {
              handlePlace();
              e.preventDefault();
            }
          });
        }

        slot.addEventListener("dragover", (e) => {
          e.preventDefault();
          slot.classList.add("drag-over");
        });
        slot.addEventListener("dragleave", () =>
          slot.classList.remove("drag-over"),
        );
        slot.addEventListener("drop", (e) => {
          e.preventDefault();
          slot.classList.remove("drag-over");
          const dataStr = e.dataTransfer?.getData("text/plain");
          if (dataStr) addToSquad(JSON.parse(dataStr));
        });
      }
      return slot;
    };

    updateCount();
  }
}
