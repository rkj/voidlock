
import { AppContext } from "../app/AppContext";
import { 
    SquadConfig, 
    MissionType, 
} from "@src/shared/types";
import { ArchetypeLibrary } from "@src/shared/types/units";
import { StatDisplay } from "@src/renderer/ui/StatDisplay";
import { Icons } from "@src/renderer/Icons";

export class SquadBuilder {
    private container: HTMLElement;
    private context: AppContext;
    private squad: SquadConfig;
    private missionType: MissionType;
    private isCampaign: boolean;
    private onSquadUpdated: (squad: SquadConfig) => void;

    constructor(
        containerId: string, 
        context: AppContext, 
        initialSquad: SquadConfig,
        missionType: MissionType,
        isCampaign: boolean,
        onSquadUpdated: (squad: SquadConfig) => void
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

    public update(squad: SquadConfig, missionType: MissionType, isCampaign: boolean) {
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
        rosterPanel.className = "roster-panel";
        mainWrapper.appendChild(rosterPanel);

        const deploymentPanel = document.createElement("div");
        deploymentPanel.className = "deployment-panel";
        mainWrapper.appendChild(deploymentPanel);

        const updateCount = () => {
            let total = this.squad.soldiers.filter((s) => s.archetypeId !== "vip").length;
            totalDiv.textContent = `Total Soldiers: ${total}/${MAX_SQUAD_SIZE}`;
            totalDiv.style.color = total > MAX_SQUAD_SIZE ? "var(--color-danger)" : total === MAX_SQUAD_SIZE ? "var(--color-primary)" : "var(--color-text-muted)";
            const launchBtn = document.getElementById("btn-goto-equipment") as HTMLButtonElement;
            if (launchBtn) launchBtn.disabled = total === 0 || total > MAX_SQUAD_SIZE;
            renderRoster();
            renderSlots();
        };

        const renderRoster = () => {
            rosterPanel.innerHTML = "<h3>Roster</h3>";
            if (this.isCampaign) {
                const state = this.context.campaignManager.getState();
                if (state) {
                    const statusWeights: Record<string, number> = {
                        "Healthy": 0,
                        "Wounded": 1,
                        "Dead": 2
                    };
                    const sortedRoster = [...state.roster].sort((a, b) => {
                        const weightA = statusWeights[a.status] ?? 3;
                        const weightB = statusWeights[b.status] ?? 3;
                        return weightA - weightB;
                    });

                    sortedRoster.forEach((soldier) => {
                        if (soldier.archetypeId === "vip") return;
                        const isSelected = this.squad.soldiers.some((s) => s.id === soldier.id);
                        rosterPanel.appendChild(createCampaignCard(soldier, isSelected));
                    });

                    // Quick Action: Recruit
                    const availableCount = state.roster.filter((s) => s.status === "Healthy" || s.status === "Wounded").length;
                    if (availableCount < 4) {
                        const recruitBtn = document.createElement("button");
                        recruitBtn.className = "btn-recruit";
                        recruitBtn.textContent = "Recruit (100 Scrap)";
                        recruitBtn.disabled = state.scrap < 100;
                        recruitBtn.onclick = async () => {
                            const name = await this.context.modalService.prompt("Enter soldier name:", `Recruit ${state.roster.length + 1}`);
                            if (name) {
                                try {
                                    const newId = this.context.campaignManager.recruitSoldier(
                                        state.unlockedArchetypes[Math.floor(Math.random() * state.unlockedArchetypes.length)],
                                        name
                                    );
                                    
                                    // Auto-deploy if slot available
                                    const totalOccupied = this.squad.soldiers.length + (isEscortMission ? 1 : 0);
                                    if (totalOccupied < 4) {
                                        const newState = this.context.campaignManager.getState();
                                        const s = newState?.roster.find(r => r.id === newId);
                                        if (s) {
                                            this.squad.soldiers.push({
                                                id: s.id,
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
                                    if (this.context.campaignShell) this.context.campaignShell.refresh();
                                    updateCount();
                                } catch (err: any) {
                                    await this.context.modalService.alert(err.message);
                                }
                            }
                        };
                        rosterPanel.appendChild(recruitBtn);
                    }
                }
            } else {
                Object.values(ArchetypeLibrary).forEach((arch) => {
                    if (arch.id === "vip" && isEscortMission) return;
                    rosterPanel.appendChild(createArchetypeCard(arch));
                });
            }
        };

        const renderSlots = () => {
            deploymentPanel.innerHTML = "<h3>Deployment</h3>";
            for (let i = 0; i < 4; i++) deploymentPanel.appendChild(createSlot(i));
        };

        const addToSquad = async (data: any) => {
            const totalNonVip = this.squad.soldiers.filter(s => s.archetypeId !== "vip").length;
            const totalOccupied = this.squad.soldiers.length + (isEscortMission ? 1 : 0);
            if (totalOccupied >= 4) { await this.context.modalService.alert("All deployment slots are full."); return; }
            if (data.archetypeId !== "vip" && totalNonVip >= MAX_SQUAD_SIZE) { await this.context.modalService.alert(`Maximum of ${MAX_SQUAD_SIZE} soldiers allowed.`); return; }

            if (data.type === "campaign") {
                if (this.squad.soldiers.some(s => s.id === data.id)) return;
                const state = this.context.campaignManager.getState();
                const s = state?.roster.find((r) => r.id === data.id);
                if (s) {
                    this.squad.soldiers.push({
                        id: s.id,
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
                this.squad.soldiers.push({ archetypeId: data.archetypeId });
            }
            this.onSquadUpdated(this.squad);
            updateCount();
        };

        const createCampaignCard = (soldier: any, isDeployed: boolean) => {
            const arch = ArchetypeLibrary[soldier.archetypeId];
            const card = document.createElement("div");
            
            const isDead = soldier.status === "Dead";
            const isWounded = soldier.status === "Wounded";
            const isHealthy = soldier.status === "Healthy";
            
            card.className = "soldier-card";
            if (isDead) card.classList.add("dead");
            if (isWounded) card.classList.add("wounded");
            if (isDeployed) card.classList.add("deployed");
            if (!isHealthy) card.classList.add("disabled");

            if (isHealthy && !isDeployed) {
                card.draggable = true;
                card.addEventListener("dragstart", (e) => {
                    e.dataTransfer?.setData("text/plain", JSON.stringify({ type: "campaign", id: soldier.id, archetypeId: soldier.archetypeId }));
                });
                card.addEventListener("dblclick", () => addToSquad({ type: "campaign", id: soldier.id, archetypeId: soldier.archetypeId }));
            }
            card.innerHTML = `<strong>${soldier.name}</strong><div style="font-size:0.75em; color:var(--color-text-muted);">${arch?.name || soldier.archetypeId} Lvl ${soldier.level} | Status: ${soldier.status}</div>`;

            if (isDead && this.isCampaign) {
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
                            const totalOccupied = this.squad.soldiers.length + (isEscortMission ? 1 : 0);
                            if (totalOccupied < 4 && !this.squad.soldiers.some(s => s.id === soldier.id)) {
                                const newState = this.context.campaignManager.getState();
                                const s = newState?.roster.find(r => r.id === soldier.id);
                                if (s) {
                                    this.squad.soldiers.push({
                                        id: s.id,
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
                            if (this.context.campaignShell) this.context.campaignShell.refresh();
                            updateCount();
                        } catch (err: any) {
                            await this.context.modalService.alert(err.message);
                        }
                    };
                    card.appendChild(reviveBtn);
                }
            }

            return card;
        };

        const createArchetypeCard = (arch: any) => {
            const card = document.createElement("div");
            card.className = "soldier-card";
            card.draggable = true;
            card.addEventListener("dragstart", (e) => {
                e.dataTransfer?.setData("text/plain", JSON.stringify({ type: "custom", archetypeId: arch.id }));
            });
            card.addEventListener("dblclick", () => addToSquad({ type: "custom", archetypeId: arch.id }));
            const scaledFireRate = arch.fireRate * (arch.speed > 0 ? 10 / arch.speed : 1);
            const fireRateVal = scaledFireRate > 0 ? (1000 / scaledFireRate).toFixed(1) : "0";
            card.innerHTML = `<strong style="color:var(--color-primary);">${arch.name}</strong><div style="font-size:0.75em; color:var(--color-text-muted); display:flex; gap:8px; flex-wrap:wrap;">${StatDisplay.render(Icons.Speed, arch.speed, "Speed")}${StatDisplay.render(Icons.Accuracy, arch.accuracy, "Accuracy")}${StatDisplay.render(Icons.Damage, arch.damage, "Damage")}${StatDisplay.render(Icons.Rate, fireRateVal, "Fire Rate")}${StatDisplay.render(Icons.Range, arch.attackRange, "Range")}</div>`;
            return card;
        };

        const createSlot = (index: number) => {
            const slot = document.createElement("div");
            slot.className = "deployment-slot";
            slot.setAttribute("aria-label", `Deployment Slot ${index + 1}`);
            if (index === 0 && isEscortMission) {
                slot.classList.add("locked");
                slot.innerHTML = `<strong style="color:var(--color-accent);">VIP</strong>`;
                return slot;
            }
            const soldierIdx = isEscortMission ? index - 1 : index;
            const soldier = this.squad.soldiers[soldierIdx];
            if (soldier) {
                slot.classList.add("occupied");
                const arch = ArchetypeLibrary[soldier.archetypeId];
                let name = arch?.name || soldier.archetypeId;
                if (this.isCampaign && soldier.id) {
                    const state = this.context.campaignManager.getState();
                    const rs = state?.roster.find((r) => r.id === soldier.id);
                    if (rs) name = rs.name;
                }
                slot.innerHTML = `<strong style="color:var(--color-primary);">${name}</strong><div class="slot-remove" title="Remove">X</div>`;
                slot.querySelector(".slot-remove")?.addEventListener("click", (e) => { 
                    e.stopPropagation(); 
                    this.squad.soldiers.splice(soldierIdx, 1); 
                    this.onSquadUpdated(this.squad);
                    updateCount(); 
                });
                slot.addEventListener("dblclick", () => { 
                    this.squad.soldiers.splice(soldierIdx, 1); 
                    this.onSquadUpdated(this.squad);
                    updateCount(); 
                });
            } else {
                slot.innerHTML = `<div style="color:var(--color-text-dim); font-size:0.8em;">(Empty)</div>`;
                slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("drag-over"); });
                slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
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
