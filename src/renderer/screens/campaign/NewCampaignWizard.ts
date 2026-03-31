import { ConfigManager } from "@src/renderer/ConfigManager";
import type { CampaignOverrides } from "@src/shared/campaign_types";
import { UnitStyle, MapGeneratorType } from "@src/shared/types";
import type { MetaStats } from "@src/shared/campaign_types";
import { t } from "../../i18n";
import { I18nKeys } from "../../i18n/keys";

export interface NewCampaignWizardOptions {
  onStartCampaign: (
    seed: number,
    difficulty: string,
    overrides: CampaignOverrides,
  ) => void;
  onBack: () => void;
  metaStats: MetaStats;
}

interface WizardFormElements {
  pauseCheck: HTMLInputElement;
  skipPrologueCheck: HTMLInputElement;
  seedInput: HTMLInputElement;
  genSelect: HTMLSelectElement;
  scalingSlider: HTMLInputElement;
  scarcitySlider: HTMLInputElement;
  deathSelect: HTMLSelectElement;
  startBtn: HTMLButtonElement;
}

export class NewCampaignWizard {
  private container: HTMLElement;
  private options: NewCampaignWizardOptions;
  private selectedDifficulty = "Standard";
  private isAdvancedShown = false;
  private selectedUnitStyle: UnitStyle = ConfigManager.loadGlobal().unitStyle;

  constructor(container: HTMLElement, options: NewCampaignWizardOptions) {
    this.container = container;
    this.options = options;
  }

  public render() {
    this.container.innerHTML = "";
    this.container.className = "screen campaign-screen flex-col campaign-setup-wizard h-full relative atmospheric-bg bg-voidlock";

    const grain = document.createElement("div");
    grain.className = "grain";
    this.container.appendChild(grain);

    const scanline = document.createElement("div");
    scanline.className = "scanline";
    this.container.appendChild(scanline);

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-col align-center w-full h-full relative";
    contentWrapper.style.zIndex = "10";
    this.container.appendChild(contentWrapper);

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "flex-grow w-full overflow-y-auto";

    const content = document.createElement("div");
    content.className = "flex-col align-center gap-20 wizard-content";
    content.style.maxWidth = "800px";
    content.style.margin = "0 auto";
    content.style.padding = "40px 20px";

    const h1 = document.createElement("h1");
    h1.textContent = t(I18nKeys.screen.campaign.wizard.title);
    h1.style.letterSpacing = "4px";
    h1.style.color = "var(--color-primary)";
    content.appendChild(h1);

    const { form, ...formElements } = this.buildForm();

    content.appendChild(form);
    scrollContainer.appendChild(content);
    contentWrapper.appendChild(scrollContainer);
    contentWrapper.appendChild(this.buildFooter(formElements));
  }

  private buildForm() {
    const form = document.createElement("div");
    form.className = "flex-col gap-20 w-full p-20";
    form.style.background = "var(--color-surface-elevated)";
    form.style.border = "1px solid var(--color-border-strong)";
    form.style.maxWidth = "800px";
    form.style.boxSizing = "border-box";

    form.appendChild(this.buildGlobalStatusGroup());

    const diffLabel = document.createElement("label");
    diffLabel.textContent = t(I18nKeys.screen.campaign.wizard.difficulty_label);
    diffLabel.style.fontSize = "0.8em";
    diffLabel.style.color = "var(--color-text-dim)";
    diffLabel.style.marginBottom = "-10px";
    form.appendChild(diffLabel);

    const pauseGroup = document.createElement("div");
    pauseGroup.className = "flex-row align-center gap-10";
    const pauseCheck = document.createElement("input");
    pauseCheck.type = "checkbox";
    pauseCheck.id = "campaign-tactical-pause";
    pauseCheck.checked = true;
    const pauseLabel = document.createElement("label");
    pauseLabel.htmlFor = "campaign-tactical-pause";
    pauseLabel.textContent = t(I18nKeys.screen.campaign.wizard.pause_allow);
    pauseLabel.style.fontSize = "0.9em";
    pauseGroup.appendChild(pauseCheck);
    pauseGroup.appendChild(pauseLabel);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "difficulty-cards-container flex-row gap-10 w-full";
    this.buildDifficultyCards(cardsContainer, pauseCheck, pauseLabel);
    form.appendChild(cardsContainer);
    form.appendChild(pauseGroup);

    const durationGroup = document.createElement("div");
    durationGroup.className = "flex-col gap-5";
    const durationLabel = document.createElement("label");
    durationLabel.textContent = t(I18nKeys.screen.campaign.wizard.duration_label);
    durationLabel.style.fontSize = "0.8em";
    durationLabel.style.color = "var(--color-text-dim)";
    const durationSelect = document.createElement("select");
    durationSelect.id = "campaign-duration";
    durationSelect.innerHTML = `
      <option value="0.5" selected>${t(I18nKeys.screen.campaign.wizard.duration_long)}</option>
      <option value="1.0">${t(I18nKeys.screen.campaign.wizard.duration_short)}</option>
    `;
    durationGroup.appendChild(durationLabel);
    durationGroup.appendChild(durationSelect);
    form.appendChild(durationGroup);

    const skipPrologueGroup = document.createElement("div");
    skipPrologueGroup.className = "flex-row align-center gap-10";
    const skipPrologueCheck = document.createElement("input");
    skipPrologueCheck.type = "checkbox";
    skipPrologueCheck.id = "campaign-skip-prologue";
    const metaStats = this.options.metaStats;
    skipPrologueCheck.checked = metaStats.prologueCompleted;
    const skipPrologueLabel = document.createElement("label");
    skipPrologueLabel.htmlFor = "campaign-skip-prologue";
    skipPrologueLabel.textContent = t(I18nKeys.screen.campaign.wizard.skip_prologue);
    skipPrologueLabel.style.fontSize = "0.9em";
    skipPrologueGroup.appendChild(skipPrologueCheck);
    skipPrologueGroup.appendChild(skipPrologueLabel);
    form.appendChild(skipPrologueGroup);

    if (this.selectedDifficulty === "extreme") {
      pauseCheck.checked = false;
      pauseCheck.disabled = true;
      pauseLabel.style.opacity = "0.5";
    }

    const { advancedWrapper, seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect } = this.buildAdvancedOptions();
    form.appendChild(advancedWrapper);

    const startBtn = document.createElement("button");
    startBtn.textContent = t(I18nKeys.screen.campaign.wizard.initialize_btn);

    return { form, pauseCheck, skipPrologueCheck, seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect, startBtn } as { form: HTMLElement } & WizardFormElements;
  }

  private buildGlobalStatusGroup(): HTMLElement {
    const globalStatusGroup = document.createElement("div");
    globalStatusGroup.className = "flex-col gap-5";
    const globalStatusLabel = document.createElement("label");
    globalStatusLabel.textContent = t(I18nKeys.screen.campaign.wizard.visual_style_label);
    globalStatusLabel.style.fontSize = "0.8em";
    globalStatusLabel.style.color = "var(--color-text-dim)";

    const globalStatusContainer = document.createElement("div");
    globalStatusContainer.style.display = "flex";
    globalStatusContainer.style.alignItems = "center";
    globalStatusContainer.style.justifyContent = "space-between";
    globalStatusContainer.style.background = "rgba(0,0,0,0.2)";
    globalStatusContainer.style.padding = "8px 12px";
    globalStatusContainer.style.border = "1px solid var(--color-border)";

    const themeId = ConfigManager.loadGlobal().themeId || "default";
    const themeKey = themeId === "industrial" ? I18nKeys.screen.settings.theme_industrial 
                   : themeId === "hive" ? I18nKeys.screen.settings.theme_hive 
                   : I18nKeys.screen.settings.theme_default;
    const themeName = t(themeKey as any);

    const styleKey = this.selectedUnitStyle === UnitStyle.Sprites ? I18nKeys.screen.settings.unit_style_sprites 
                    : I18nKeys.screen.settings.unit_style_tactical;
    const styleName = t(styleKey as any);

    const statusText = document.createElement("div");
    statusText.className = "global-status-text";
    statusText.style.fontSize = "0.9em";
    statusText.style.color = "var(--color-text-dim)";
    statusText.textContent = `${styleName} | ${themeName}`;

    globalStatusContainer.appendChild(statusText);
    globalStatusGroup.appendChild(globalStatusLabel);
    globalStatusGroup.appendChild(globalStatusContainer);
    return globalStatusGroup;
  }

  private buildDifficultyCards(container: HTMLElement, pauseCheck: HTMLInputElement, pauseLabel: HTMLLabelElement) {
    const DIFFICULTIES = [
      {
        id: "Simulation",
        name: t(I18nKeys.screen.campaign.wizard.diff_simulation),
        rules: [
          t(I18nKeys.screen.campaign.wizard.rule_permadeath_off),
          t(I18nKeys.screen.campaign.wizard.rule_save_manual),
          t(I18nKeys.screen.campaign.wizard.rule_pause_allowed),
        ],
      },
      {
        id: "Clone",
        name: t(I18nKeys.screen.campaign.wizard.diff_clone),
        rules: [
          t(I18nKeys.screen.campaign.wizard.rule_permadeath_clone),
          t(I18nKeys.screen.campaign.wizard.rule_save_manual),
          t(I18nKeys.screen.campaign.wizard.rule_pause_allowed),
        ],
      },
      {
        id: "Standard",
        name: t(I18nKeys.screen.campaign.wizard.diff_standard),
        rules: [
          t(I18nKeys.screen.campaign.wizard.rule_permadeath_on),
          t(I18nKeys.screen.campaign.wizard.rule_save_manual),
          t(I18nKeys.screen.campaign.wizard.rule_pause_allowed),
        ],
      },
      {
        id: "Ironman",
        name: t(I18nKeys.screen.campaign.wizard.diff_ironman),
        rules: [
          t(I18nKeys.screen.campaign.wizard.rule_permadeath_on),
          t(I18nKeys.screen.campaign.wizard.rule_save_auto),
          t(I18nKeys.screen.campaign.wizard.rule_pause_disabled),
        ],
      },
    ];

    const cards: HTMLElement[] = [];
    DIFFICULTIES.forEach((diff) => {
      const card = document.createElement("div");
      card.className = `difficulty-card flex-col gap-10 p-15 flex-1 ${diff.id === this.selectedDifficulty ? "selected" : ""}`;
      card.tabIndex = 0;

      const title = document.createElement("h3");
      title.textContent = diff.name;
      title.style.margin = "0";
      card.appendChild(title);

      const rulesList = document.createElement("ul");
      rulesList.className = "difficulty-rules";
      diff.rules.forEach((rule) => {
        const li = document.createElement("li");
        li.textContent = rule;
        rulesList.appendChild(li);
      });
      card.appendChild(rulesList);

      const selectCard = () => {
        this.selectedDifficulty = diff.id;
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");

        // Ironman logic
        if (this.selectedDifficulty === "Ironman") {
          pauseCheck.checked = false;
          pauseCheck.disabled = true;
          const tooltip = t(I18nKeys.screen.campaign.wizard.ironman_pause_tooltip);
          pauseCheck.title = tooltip;
          pauseLabel.title = tooltip;
          pauseLabel.style.opacity = "0.5";
        } else {
          pauseCheck.disabled = false;
          pauseCheck.title = "";
          pauseLabel.title = "";
          pauseLabel.style.opacity = "1";
          pauseCheck.checked = true;
        }
      };

      card.addEventListener("click", selectCard);
      card.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { selectCard(); e.preventDefault(); e.stopPropagation(); }
      };
      cards.push(card);
      container.appendChild(card);
    });
  }

  private buildAdvancedOptions() {
    const advancedWrapper = document.createElement("div");
    advancedWrapper.className = "flex-col gap-10";
    advancedWrapper.style.marginTop = "10px";
    advancedWrapper.style.paddingTop = "10px";
    advancedWrapper.style.borderTop = "1px solid var(--color-border)";

    const advancedToggle = document.createElement("button");
    advancedToggle.textContent = this.isAdvancedShown ? t(I18nKeys.screen.campaign.wizard.advanced_hide) : t(I18nKeys.screen.campaign.wizard.advanced_show);
    advancedToggle.className = "text-button";
    advancedToggle.style.background = "none";
    advancedToggle.style.border = "none";
    advancedToggle.style.color = "var(--color-text-dim)";
    advancedToggle.style.fontSize = "0.8em";
    advancedToggle.style.cursor = "pointer";
    advancedToggle.style.textAlign = "left";
    advancedToggle.style.padding = "0";
    advancedToggle.tabIndex = 0;

    const advancedContent = document.createElement("div");
    advancedContent.className = "flex-col gap-15";
    advancedContent.style.display = this.isAdvancedShown ? "flex" : "none";
    advancedContent.style.marginTop = "10px";

    const toggleAdvanced = () => {
      this.isAdvancedShown = !this.isAdvancedShown;
      advancedContent.style.display = this.isAdvancedShown ? "flex" : "none";
      advancedToggle.textContent = this.isAdvancedShown ? t(I18nKeys.screen.campaign.wizard.advanced_hide) : t(I18nKeys.screen.campaign.wizard.advanced_show);
    };
    advancedToggle.onclick = toggleAdvanced;
    advancedToggle.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { toggleAdvanced(); e.preventDefault(); e.stopPropagation(); }
    };

    const { seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect } = this.buildAdvancedInputs(advancedContent);

    advancedWrapper.appendChild(advancedToggle);
    advancedWrapper.appendChild(advancedContent);
    return { advancedWrapper, seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect };
  }

  private buildAdvancedInputs(container: HTMLElement) {
    const seedGroup = document.createElement("div");
    seedGroup.className = "flex-col gap-5";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = t(I18nKeys.screen.campaign.wizard.seed_label);
    seedLabel.style.fontSize = "0.7em";
    seedLabel.style.color = "var(--color-text-dim)";
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.placeholder = t(I18nKeys.screen.campaign.wizard.seed_placeholder);
    seedGroup.appendChild(seedLabel);
    seedGroup.appendChild(seedInput);
    container.appendChild(seedGroup);

    const genGroup = document.createElement("div");
    genGroup.className = "flex-col gap-5";
    const genLabel = document.createElement("label");
    genLabel.textContent = t(I18nKeys.screen.campaign.wizard.generator_label);
    genLabel.style.fontSize = "0.7em";
    genLabel.style.color = "var(--color-text-dim)";
    const genSelect = document.createElement("select");
    genSelect.innerHTML = `
      <option value="">${t(I18nKeys.screen.campaign.wizard.gen_default)}</option>
      <option value="DenseShip">${t(I18nKeys.screen.campaign.wizard.gen_dense)}</option>
      <option value="TreeShip">${t(I18nKeys.screen.campaign.wizard.gen_tree)}</option>
      <option value="Procedural">${t(I18nKeys.screen.campaign.wizard.gen_procedural)}</option>
    `;
    genGroup.appendChild(genLabel);
    genGroup.appendChild(genSelect);
    container.appendChild(genGroup);

    const scalingGroup = document.createElement("div");
    scalingGroup.className = "flex-col gap-5";
    const scalingLabel = document.createElement("label");
    scalingLabel.innerHTML = `${t(I18nKeys.screen.campaign.wizard.scaling_label, { value: '<span id="scaling-val">100</span>' })}`;
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
    container.appendChild(scalingGroup);

    const scarcityGroup = document.createElement("div");
    scarcityGroup.className = "flex-col gap-5";
    const scarcityLabel = document.createElement("label");
    scarcityLabel.innerHTML = `${t(I18nKeys.screen.campaign.wizard.scarcity_label, { value: '<span id="scarcity-val">100</span>' })}`;
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
    container.appendChild(scarcityGroup);

    const deathGroup = document.createElement("div");
    deathGroup.className = "flex-col gap-5";
    const deathLabel = document.createElement("label");
    deathLabel.textContent = t(I18nKeys.screen.campaign.wizard.death_rule_label);
    deathLabel.style.fontSize = "0.7em";
    deathLabel.style.color = "var(--color-text-dim)";
    const deathSelect = document.createElement("select");
    deathSelect.innerHTML = `
      <option value="">${t(I18nKeys.screen.campaign.wizard.death_rule_default)}</option>
      <option value="Simulation">${t(I18nKeys.screen.campaign.wizard.death_rule_simulation)}</option>
      <option value="Clone">${t(I18nKeys.screen.campaign.wizard.death_rule_clone)}</option>
      <option value="Iron">${t(I18nKeys.screen.campaign.wizard.death_rule_iron)}</option>
    `;
    deathGroup.appendChild(deathLabel);
    deathGroup.appendChild(deathSelect);
    container.appendChild(deathGroup);

    const economyGroup = document.createElement("div");
    economyGroup.className = "flex-col gap-5";
    const economyLabel = document.createElement("label");
    economyLabel.textContent = t(I18nKeys.screen.campaign.wizard.economy_mode_label);
    economyLabel.style.fontSize = "0.7em";
    economyLabel.style.color = "var(--color-text-dim)";
    const economySelect = document.createElement("select");
    economySelect.id = "campaign-economy-mode";
    economySelect.innerHTML = `
      <option value="Open" selected>${t(I18nKeys.screen.campaign.wizard.economy_mode_open)}</option>
      <option value="Limited">${t(I18nKeys.screen.campaign.wizard.economy_mode_limited)}</option>
    `;
    economyGroup.appendChild(economyLabel);
    economyGroup.appendChild(economySelect);
    container.appendChild(economyGroup);

    return { seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect };
  }

  private buildFooter(elements: WizardFormElements): HTMLElement {
    const { startBtn, pauseCheck, skipPrologueCheck, seedInput, genSelect, scalingSlider, scarcitySlider, deathSelect } = elements;
    startBtn.onclick = () => {
      ConfigManager.clearCampaign();
      ConfigManager.saveGlobal({ ...ConfigManager.loadGlobal() });

      const overrides: CampaignOverrides = {
        allowTacticalPause: pauseCheck.checked,
        skipPrologue: skipPrologueCheck.checked,
        mapGrowthRate: parseFloat(
          (document.getElementById("campaign-duration") as HTMLSelectElement).value,
        ),
        economyMode: (
          document.getElementById("campaign-economy-mode") as HTMLSelectElement
        ).value as "Open" | "Limited",
      };

      if (seedInput.value) overrides.customSeed = parseInt(seedInput.value);
      if (genSelect.value) overrides.mapGeneratorType = genSelect.value as MapGeneratorType;
      if (scalingSlider.value !== "100") overrides.scaling = parseInt(scalingSlider.value) / 100;
      if (scarcitySlider.value !== "100") overrides.scarcity = 100 / parseInt(scarcitySlider.value);
      if (deathSelect.value) overrides.deathRule = deathSelect.value as "Simulation" | "Clone" | "Iron";

      this.options.onStartCampaign(Date.now(), this.selectedDifficulty, overrides);
    };

    const footer = document.createElement("div");
    footer.className = "flex-row justify-between align-center p-20 w-full";
    footer.style.background = "var(--color-bg)";
    footer.style.borderTop = "1px solid var(--color-border-strong)";
    footer.style.flexShrink = "0";
    footer.style.zIndex = "10";
    footer.style.maxWidth = "800px";
    footer.style.margin = "0 auto";
    footer.style.boxSizing = "border-box";

    const backBtn = document.createElement("button");
    backBtn.textContent = t(I18nKeys.screen.campaign.wizard.back_to_menu);
    backBtn.className = "back-button";
    backBtn.setAttribute("data-focus-id", "btn-back-to-menu");
    backBtn.style.marginTop = "0";
    backBtn.onclick = () => this.options.onBack();
    footer.appendChild(backBtn);

    startBtn.className = "primary-button";
    startBtn.setAttribute("data-focus-id", "btn-start-campaign");
    startBtn.style.width = "auto";
    startBtn.style.height = "32px";
    startBtn.style.padding = "0 24px";
    startBtn.style.display = "flex";
    startBtn.style.alignItems = "center";
    startBtn.style.justifyContent = "center";
    footer.appendChild(startBtn);

    return footer;
  }
}
