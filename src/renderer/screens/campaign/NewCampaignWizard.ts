import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { ConfigManager } from "@src/renderer/ConfigManager";
import { CampaignOverrides } from "@src/shared/campaign_types";
import { UnitStyle, MapGeneratorType } from "@src/shared/types";
import { AppContext } from "../../app/AppContext";
import { UnitStyleSelector } from "../../components/UnitStyleSelector";

export interface NewCampaignWizardOptions {
  onStartCampaign: (
    seed: number,
    difficulty: string,
    overrides: CampaignOverrides,
  ) => void;
  onBack: () => void;
}

export class NewCampaignWizard {
  private container: HTMLElement;
  private options: NewCampaignWizardOptions;
  private selectedDifficulty = "normal";
  private isAdvancedShown = false;
  private unitStyleSelector?: UnitStyleSelector;
  private selectedUnitStyle: UnitStyle = ConfigManager.loadGlobal().unitStyle;

  constructor(
    container: HTMLElement,
    private context: AppContext,
    options: NewCampaignWizardOptions,
  ) {
    this.container = container;
    this.options = options;
  }

  public render() {
    this.container.innerHTML = "";
    this.container.className = "flex-col campaign-setup-wizard";

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "flex-grow w-full h-full overflow-y-auto";
    scrollContainer.style.paddingBottom = "60px";

    const content = document.createElement("div");
    content.className =
      "flex-col align-center justify-center gap-20 campaign-setup-wizard";
    content.style.minHeight = "100%";
    content.style.maxWidth = "800px";
    content.style.margin = "0 auto";
    content.style.padding = "40px 20px";

    const h1 = document.createElement("h1");
    h1.textContent = "NEW EXPEDITION";
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    content.appendChild(h1);

    const form = document.createElement("div");
    form.className = "flex-col gap-20 w-full p-20";
    form.style.background = "var(--color-surface-elevated)";
    form.style.border = "1px solid var(--color-border-strong)";
    form.style.minWidth = "800px";

    // Difficulty Cards
    const diffLabel = document.createElement("label");
    diffLabel.textContent = "Select Difficulty";
    diffLabel.style.fontSize = "0.8em";
    diffLabel.style.color = "var(--color-text-dim)";
    diffLabel.style.marginBottom = "-10px";
    form.appendChild(diffLabel);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "flex-row gap-10 w-full";
    cardsContainer.style.justifyContent = "space-between";

    const DIFFICULTIES = [
      {
        id: "easy",
        name: "Simulation",
        rules: ["Permadeath: Off", "Save: Manual", "Pause: Allowed"],
      },
      {
        id: "normal",
        name: "Clone",
        rules: [
          "Permadeath: Partial (Cloneable)",
          "Save: Manual",
          "Pause: Allowed",
        ],
      },
      {
        id: "hard",
        name: "Standard",
        rules: ["Permadeath: On", "Save: Manual", "Pause: Allowed"],
      },
      {
        id: "extreme",
        name: "Ironman",
        rules: ["Permadeath: On", "Save: Auto-Delete", "Pause: Disabled"],
      },
    ];

    const cards: HTMLElement[] = [];

    // Tactical Pause (needed early for card click logic)
    const pauseGroup = document.createElement("div");
    pauseGroup.className = "flex-row align-center gap-10";
    const pauseCheck = document.createElement("input");
    pauseCheck.type = "checkbox";
    pauseCheck.id = "campaign-tactical-pause";
    pauseCheck.checked = true;
    const pauseLabel = document.createElement("label");
    pauseLabel.htmlFor = "campaign-tactical-pause";
    pauseLabel.textContent = "Allow Tactical Pause (0.05x)";
    pauseLabel.style.fontSize = "0.9em";
    pauseGroup.appendChild(pauseCheck);
    pauseGroup.appendChild(pauseLabel);

    DIFFICULTIES.forEach((diff) => {
      const card = document.createElement("div");
      card.className = "difficulty-card flex-col gap-10 p-15 flex-1";
      card.style.border = "1px solid var(--color-border-strong)";
      card.style.background = "rgba(255, 255, 255, 0.05)";
      card.style.cursor = "pointer";
      card.style.transition = "all 0.2s ease";

      const title = document.createElement("h3");
      title.textContent = diff.name;
      title.style.margin = "0";
      title.style.color = "var(--color-text)";
      card.appendChild(title);

      const rulesList = document.createElement("ul");
      rulesList.style.margin = "0";
      rulesList.style.paddingLeft = "15px";
      rulesList.style.fontSize = "0.8em";
      rulesList.style.color = "var(--color-text-dim)";
      diff.rules.forEach((rule) => {
        const li = document.createElement("li");
        li.textContent = rule;
        rulesList.appendChild(li);
      });
      card.appendChild(rulesList);

      if (diff.id === this.selectedDifficulty) {
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";
      }

      card.onclick = () => {
        this.selectedDifficulty = diff.id;
        cards.forEach((c) => {
          c.classList.remove("selected");
          c.style.borderColor = "var(--color-border-strong)";
          c.style.background = "rgba(255, 255, 255, 0.05)";
          (c.querySelector("h3") as HTMLElement).style.color =
            "var(--color-text)";
        });
        card.classList.add("selected");
        card.style.borderColor = "var(--color-primary)";
        card.style.background = "rgba(var(--color-primary-rgb), 0.1)";
        title.style.color = "var(--color-primary)";

        // Ironman logic
        if (this.selectedDifficulty === "extreme") {
          pauseCheck.checked = false;
          pauseCheck.disabled = true;
          const tooltip = "Tactical Pause is disabled in Ironman mode.";
          pauseCheck.title = tooltip;
          pauseLabel.title = tooltip;
          pauseLabel.style.opacity = "0.5";
        } else {
          pauseCheck.disabled = false;
          pauseCheck.title = "";
          pauseLabel.title = "";
          pauseLabel.style.opacity = "1";
          if (
            this.selectedDifficulty === "easy" ||
            this.selectedDifficulty === "normal" ||
            this.selectedDifficulty === "hard"
          ) {
            pauseCheck.checked = true;
          }
        }
      };

      cards.push(card);
      cardsContainer.appendChild(card);
    });

    form.appendChild(cardsContainer);
    form.appendChild(pauseGroup);

    // Initial Ironman check (if selectedDifficulty was Ironman from previous render)
    if (this.selectedDifficulty === "extreme") {
      pauseCheck.checked = false;
      pauseCheck.disabled = true;
      pauseLabel.style.opacity = "0.5";
    }

    // Theme Selection
    const themeGroup = document.createElement("div");
    themeGroup.className = "flex-col gap-5";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "Visual Theme";
    themeLabel.style.fontSize = "0.8em";
    themeLabel.style.color = "var(--color-text-dim)";
    const global = ConfigManager.loadGlobal();
    const themeSelect = document.createElement("select");
    themeSelect.id = "campaign-theme";
    themeSelect.innerHTML = `
      <option value="default">Default (Voidlock Green)</option>
      <option value="industrial">Industrial (Amber/Steel)</option>
      <option value="hive">Alien Hive (Purple/Biolume)</option>
    `;
    themeSelect.value = global.themeId;
    themeGroup.appendChild(themeLabel);
    themeGroup.appendChild(themeSelect);
    form.appendChild(themeGroup);

    // Campaign Length Selection
    const lengthGroup = document.createElement("div");
    lengthGroup.className = "flex-col gap-5";
    const lengthLabel = document.createElement("label");
    lengthLabel.textContent = "Campaign Length";
    lengthLabel.style.fontSize = "0.8em";
    lengthLabel.style.color = "var(--color-text-dim)";
    const lengthSelect = document.createElement("select");
    lengthSelect.id = "campaign-length";
    lengthSelect.innerHTML = `
      <option value="1.0" selected>Standard (Short, ~6-8 Missions)</option>
      <option value="0.5">Extended (Long, ~12-16 Missions)</option>
    `;
    lengthGroup.appendChild(lengthLabel);
    lengthGroup.appendChild(lengthSelect);
    form.appendChild(lengthGroup);

    // Unit Style Selection
    const styleGroup = document.createElement("div");
    styleGroup.className = "flex-col gap-5";
    const styleLabel = document.createElement("label");
    styleLabel.textContent = "Visual Style";
    styleLabel.style.fontSize = "0.8em";
    styleLabel.style.color = "var(--color-text-dim)";
    styleGroup.appendChild(styleLabel);

    const stylePreviewContainer = document.createElement("div");
    stylePreviewContainer.id = "campaign-unit-style-preview";
    styleGroup.appendChild(stylePreviewContainer);

    form.appendChild(styleGroup);

    // We need to render the selector after appending to form so it finds the element
    // Actually we pass the element directly now
    this.unitStyleSelector = new UnitStyleSelector(
      stylePreviewContainer,
      this.context,
      this.selectedUnitStyle,
      (style) => {
        this.selectedUnitStyle = style;
      },
    );
    this.unitStyleSelector.render();

    // Advanced Options (Collapsible)
    const advancedWrapper = document.createElement("div");
    advancedWrapper.className = "flex-col gap-10";
    advancedWrapper.style.marginTop = "10px";
    advancedWrapper.style.paddingTop = "10px";
    advancedWrapper.style.borderTop = "1px solid var(--color-border)";

    const advancedToggle = document.createElement("button");
    advancedToggle.textContent = this.isAdvancedShown
      ? "Hide Advanced Settings ▲"
      : "Show Advanced Settings ▼";
    advancedToggle.style.background = "none";
    advancedToggle.style.border = "none";
    advancedToggle.style.color = "var(--color-text-dim)";
    advancedToggle.style.fontSize = "0.8em";
    advancedToggle.style.cursor = "pointer";
    advancedToggle.style.textAlign = "left";
    advancedToggle.style.padding = "0";

    const advancedContent = document.createElement("div");
    advancedContent.className = "flex-col gap-15";
    advancedContent.style.display = this.isAdvancedShown ? "flex" : "none";
    advancedContent.style.marginTop = "10px";

    advancedToggle.onclick = () => {
      this.isAdvancedShown = !this.isAdvancedShown;
      const isHidden = !this.isAdvancedShown;
      advancedContent.style.display = isHidden ? "none" : "flex";
      advancedToggle.textContent = isHidden
        ? "Show Advanced Settings ▼"
        : "Hide Advanced Settings ▲";
    };

    // Custom Seed
    const seedGroup = document.createElement("div");
    seedGroup.className = "flex-col gap-5";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = "Custom Seed (Optional)";
    seedLabel.style.fontSize = "0.7em";
    seedLabel.style.color = "var(--color-text-dim)";
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.placeholder = "Enter seed...";
    seedGroup.appendChild(seedLabel);
    seedGroup.appendChild(seedInput);
    advancedContent.appendChild(seedGroup);

    // Forced Map Generator
    const genGroup = document.createElement("div");
    genGroup.className = "flex-col gap-5";
    const genLabel = document.createElement("label");
    genLabel.textContent = "Force Map Generator";
    genLabel.style.fontSize = "0.7em";
    genLabel.style.color = "var(--color-text-dim)";
    const genSelect = document.createElement("select");
    genSelect.innerHTML = `
      <option value="">(Default for mission)</option>
      <option value="DenseShip">Dense Ship (>90% fill)</option>
      <option value="TreeShip">Tree Ship (No Loops)</option>
      <option value="Procedural">Spaceship (Balanced)</option>
    `;
    genGroup.appendChild(genLabel);
    genGroup.appendChild(genSelect);
    advancedContent.appendChild(genGroup);

    // Scaling Slider
    const scalingGroup = document.createElement("div");
    scalingGroup.className = "flex-col gap-5";
    const scalingLabel = document.createElement("label");
    scalingLabel.innerHTML = `Difficulty Scaling: <span id="scaling-val">100</span>%`;
    scalingLabel.style.fontSize = "0.7em";
    scalingLabel.style.color = "var(--color-text-dim)";
    const scalingSlider = document.createElement("input");
    scalingSlider.type = "range";
    scalingSlider.min = "50";
    scalingSlider.max = "200";
    scalingSlider.value = "100";
    scalingSlider.oninput = () => {
      const valEl = document.getElementById("scaling-val");
      if (valEl) valEl.textContent = scalingSlider.value;
    };
    scalingGroup.appendChild(scalingLabel);
    scalingGroup.appendChild(scalingSlider);
    advancedContent.appendChild(scalingGroup);

    // Scarcity Slider
    const scarcityGroup = document.createElement("div");
    scarcityGroup.className = "flex-col gap-5";
    const scarcityLabel = document.createElement("label");
    scarcityLabel.innerHTML = `Resource Scarcity: <span id="scarcity-val">100</span>%`;
    scarcityLabel.style.fontSize = "0.7em";
    scarcityLabel.style.color = "var(--color-text-dim)";
    const scarcitySlider = document.createElement("input");
    scarcitySlider.type = "range";
    scarcitySlider.min = "50";
    scarcitySlider.max = "200";
    scarcitySlider.value = "100";
    scarcitySlider.oninput = () => {
      const valEl = document.getElementById("scarcity-val");
      if (valEl) valEl.textContent = scarcitySlider.value;
    };
    scarcityGroup.appendChild(scarcityLabel);
    scarcityGroup.appendChild(scarcitySlider);
    advancedContent.appendChild(scarcityGroup);

    // Death Rule
    const deathGroup = document.createElement("div");
    deathGroup.className = "flex-col gap-5";
    const deathLabel = document.createElement("label");
    deathLabel.textContent = "Death Rule";
    deathLabel.style.fontSize = "0.7em";
    deathLabel.style.color = "var(--color-text-dim)";
    const deathSelect = document.createElement("select");
    deathSelect.innerHTML = `
      <option value="">(Preset Default)</option>
      <option value="Simulation">Simulation (No Death)</option>
      <option value="Clone">Clone (Pay to revive)</option>
      <option value="Iron">Iron (Permanent)</option>
    `;
    deathGroup.appendChild(deathLabel);
    deathGroup.appendChild(deathSelect);
    advancedContent.appendChild(deathGroup);

    // Economy Mode
    const economyGroup = document.createElement("div");
    economyGroup.className = "flex-col gap-5";
    const economyLabel = document.createElement("label");
    economyLabel.textContent = "Economy Mode";
    economyLabel.style.fontSize = "0.7em";
    economyLabel.style.color = "var(--color-text-dim)";
    const economySelect = document.createElement("select");
    economySelect.id = "campaign-economy-mode";
    economySelect.innerHTML = `
      <option value="Open" selected>Open (Buy anywhere, shop discount)</option>
      <option value="Limited">Limited (Buy only at Supply Depots)</option>
    `;
    economyGroup.appendChild(economyLabel);
    economyGroup.appendChild(economySelect);
    advancedContent.appendChild(economyGroup);

    advancedWrapper.appendChild(advancedToggle);
    advancedWrapper.appendChild(advancedContent);
    form.appendChild(advancedWrapper);

    content.appendChild(form);

    const startBtn = document.createElement("button");
    startBtn.textContent = "Initialize Expedition";
    startBtn.className = "primary-button w-full";
    startBtn.style.height = "32px";
    startBtn.style.display = "flex";
    startBtn.style.alignItems = "center";
    startBtn.style.justifyContent = "center";
    startBtn.style.fontSize = "0.9em";
    startBtn.onclick = () => {
      ConfigManager.clearCampaign();
      ConfigManager.saveGlobal({
        unitStyle: this.selectedUnitStyle,
        themeId: themeSelect.value,
      });

      const overrides: CampaignOverrides = {
        allowTacticalPause: pauseCheck.checked,
        mapGrowthRate: parseFloat(lengthSelect.value),
        economyMode: (
          document.getElementById("campaign-economy-mode") as HTMLSelectElement
        ).value as "Open" | "Limited",
      };

      if (seedInput.value) overrides.customSeed = parseInt(seedInput.value);
      if (genSelect.value)
        overrides.mapGeneratorType = genSelect.value as MapGeneratorType;
      if (scalingSlider.value !== "100")
        overrides.scaling = parseInt(scalingSlider.value) / 100;
      if (scarcitySlider.value !== "100")
        overrides.scarcity = 100 / parseInt(scarcitySlider.value);
      if (deathSelect.value)
        overrides.deathRule = deathSelect.value as
          | "Simulation"
          | "Clone"
          | "Iron";

      this.options.onStartCampaign(
        Date.now(),
        this.selectedDifficulty,
        overrides,
      );
    };
    content.appendChild(startBtn);

    scrollContainer.appendChild(content);
    this.container.appendChild(scrollContainer);
  }
}
