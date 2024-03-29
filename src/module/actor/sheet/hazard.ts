/* global CONST */
import ActorSheetPF2e from './base';

class ActorSheetPF2eHazard extends ActorSheetPF2e {
  static get defaultOptions() {
    const options = super.defaultOptions;
    mergeObject(options, {
      classes: options.classes.concat(['pf2e', 'actor', 'hazard']),
      width: 650,
      height: 680,
    });
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   * @type {String}
   */
  get template() {
    const path = 'systems/pf2e/templates/actors/';
    if (this.actor.getFlag('pf2e', 'editHazard.value')) return `${path}hazard-sheet.html`;
    return `${path}hazard-sheet-no-edit.html`;
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const sheetData = super.getData();

    // Update save labels
    for (const [s, save] of Object.entries(sheetData.data.saves as Record<any, any>)) {
      save.label = CONFIG.PF2E.saves[s];
    }

    sheetData.flags = sheetData.actor.flags;
    if (sheetData.flags.editHazard === undefined) sheetData.flags.editHazard = { value: false };

    sheetData.hazardTraits = CONFIG.PF2E.hazardTraits;
    sheetData.actorTraits = (sheetData.data.traits.traits || {}).value;
    
    sheetData.stealthDC = (sheetData.data.attributes.stealth?.value ?? 0) + 10;
    sheetData.hasStealthDescription = sheetData.data.attributes.stealth?.details || false;

    sheetData.hasImmunities = sheetData.data.traits.di.value !== [];
    sheetData.hasDescription = sheetData.data.details.description || false;
    sheetData.hasDisable = sheetData.data.details.disable || false;
    sheetData.hasRoutineDetails = sheetData.data.details.routine || false;
    sheetData.hasResetDetails = sheetData.data.details.reset || false;
    sheetData.hasHPDetails = sheetData.data.attributes.hp.details || false;
    sheetData.hasWillSave = sheetData.data.saves.will.value !== 0 || false;

    sheetData.brokenThreshold = Math.floor(sheetData.data.attributes.hp.max / 2);

    return sheetData;
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Items for Hazard sheets
   * @private
   */
  _prepareItems(actorData) {
    // Actions
    const attacks = {
      melee: { label: 'NPC Melee Attack', items: [], type: 'melee' },
      ranged: { label: 'NPC Ranged Attack', items: [], type: 'melee' },
    };

    // Actions
    const actions = {
      action: { label: 'Actions', actions: [] },
      reaction: { label: 'Reactions', actions: [] },
      free: { label: 'Free Actions', actions: [] },
      passive: { label: 'Passive Actions', actions: [] },
    };

    // Iterate through items, allocating to containers
    for (const i of actorData.items) {
      i.img = i.img || CONST.DEFAULT_TOKEN;

      // NPC Generic Attacks
      if (i.type === 'melee') {
        const weaponType = (i.data.weaponType || {}).value || 'melee';
        const isAgile = (i.data.traits.value || []).includes('agile');
        i.data.bonus.total = (parseInt(i.data.bonus.value, 10) || 0);
        i.data.isAgile = isAgile;

        // get formated traits for read-only npc sheet
        const traits = [];
        if ((i.data.traits.value || []).length !== 0) {
          for (let j = 0; j < i.data.traits.value.length; j++) {
            const traitsObject = {
              label: CONFIG.PF2E.weaponTraits[i.data.traits.value[j]] || (i.data.traits.value[j].charAt(0).toUpperCase() + i.data.traits.value[j].slice(1)),
              description: CONFIG.PF2E.traitsDescriptions[i.data.traits.value[j]] || '',
            };
            traits.push(traitsObject);
          }
        }
        i.traits = traits.filter((p) => !!p);

        attacks[weaponType].items.push(i);
      }

      // Actions
      else if (i.type === 'action') {
        const actionType = i.data.actionType.value || 'action';
        let actionImg: string|number = 0;
        // if (actionType === "action") actionImg = parseInt(i.data.actions.value) || 1;
        if (actionType === 'action') actionImg = parseInt((i.data.actions || {}).value, 10) || 1;
        else if (actionType === 'reaction') actionImg = 'reaction';
        else if (actionType === 'free') actionImg = 'free';
        else if (actionType === 'passive') actionImg = 'passive';
        i.img = this._getActionImg(actionImg);

        // get formated traits for read-only npc sheet
        const traits = [];
        if ((i.data.traits.value || []).length !== 0) {
          for (let j = 0; j < i.data.traits.value.length; j++) {
            const traitsObject = {
              label: CONFIG.PF2E.weaponTraits[i.data.traits.value[j]] || (i.data.traits.value[j].charAt(0).toUpperCase() + i.data.traits.value[j].slice(1)),
              description: CONFIG.PF2E.traitsDescriptions[i.data.traits.value[j]] || '',
            };
            traits.push(traitsObject);
          }
        }
        if (i.data.actionType.value) {
          traits.push({
            label: CONFIG.PF2E.weaponTraits[i.data.actionType.value] || (i.data.actionType.value.charAt(0).toUpperCase() + i.data.actionType.value.slice(1)),
            description: CONFIG.PF2E.traitsDescriptions[i.data.actionType.value] || '',
          });
        }
        i.traits = traits.filter((p) => !!p);

        actions[actionType].actions.push(i);
      }
    }

    // Assign and return
    actorData.actions = actions;
    actorData.attacks = attacks;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.options.editable) return;

    html.find('.isHazardEditable').change((ev) => {
      this.actor.setFlag('pf2e', 'editHazard', { value: ev.target.checked });
    });
  }
}

export default ActorSheetPF2eHazard;
