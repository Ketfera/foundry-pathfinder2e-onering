/* global Dialog, Item, MeasuredTemplate, getProperty, renderTemplate, ui */
import {sellAllTreasureSimple, sellTreasure} from '../../item/treasure';
import { AddCoinsPopup } from './AddCoinsPopup';
import { addKit } from '../../item/kits';
import { compendiumBrowser } from '../../packs/compendium-browser';
import { MoveLootPopup } from './loot/MoveLootPopup';
import PF2EActor, { SKILL_DICTIONARY } from '../actor';
import { TraitSelector5e } from '../../system/trait-selector';
import PF2EItem from '../../item/item';
import { ConditionData } from '../../item/dataDefinitions';
import { PF2eConditionManager } from '../../conditions';

/**
 * Extend the basic ActorSheet class to do all the PF2e things!
 * This sheet is an Abstract layer which is not used.
 */
abstract class ActorSheetPF2e extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      scrollY: [
        '.sheet-sidebar',
        '.spellcastingEntry-list',
        '.actions-list',
        '.skills-pane',
        '.feats-pane',
        '.inventory-pane',
        '.actions-pane',
        '.spellbook-pane',
        '.skillstab-pane'
      ],
    });
  }

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType() {
	  return this.actor.data.type;
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const sheetData : any = super.getData();

    this._prepareTraits(sheetData.data.traits);
    this._prepareItems(sheetData.actor);

    // Return data to the sheet
    return sheetData;
  }

  abstract _prepareItems(actor: PF2EActor): void;

  _findActiveList() {
    return (this.element as JQuery).find('.tab.active .directory-list');
  }

  /* -------------------------------------------- */

  _prepareTraits(traits) {
    if (traits === undefined) return;

    const map = {
      languages: CONFIG.PF2E.languages,
      dr: CONFIG.PF2E.resistanceTypes,
      di: CONFIG.PF2E.immunityTypes,
      dv: CONFIG.PF2E.weaknessTypes,
      ci: CONFIG.PF2E.immunityTypes,
      traits: CONFIG.PF2E.monsterTraits,
    };

    for (const [t, choices] of Object.entries(map)) {
      const trait = traits[t] || {value: [], selected: []};

      if (Array.isArray(trait)) {
        // todo this is so wrong...
        (trait as any).selected = {};
        for (const entry of trait) {
          if (typeof entry === 'object') {
            if ('exceptions' in entry && entry.exceptions !== "") {
              (trait as any).selected[entry.type] = `${choices[entry.type]} (${entry.value}) [${entry.exceptions}]`;
            } else {
              let text = `${choices[entry.type]}`;
              if (entry.value !== "")
                text = `${text} (${entry.value})`;
                (trait as any).selected[entry.type] = text;
            }
          } else {
            (trait as any).selected[entry] = choices[entry] || `${entry}`;
          }
        }
      } else if (trait.value) {
        trait.selected = Object.fromEntries(trait.value.map((name) => [name, name]));
      }

      // Add custom entry
      if (trait.custom) trait.selected.custom = trait.custom;
    }
  }

  /* -------------------------------------------- */

  /**
   * Insert a spell into the spellbook object when rendering the character sheet
   * @param {Object} actorData    The Actor data being prepared
   * @param {Object} spellbook    The spellbook data being prepared
   * @param {Object} spell        The spell data being prepared
   * @private
   */
  _prepareSpell(actorData, spellbook, spell) {
    const spellLvl = (Number(spell.data.level.value) < 11) ? Number(spell.data.level.value) : 10;
    let spellcastingEntry : any = null;

    if ((spell.data.location || {}).value) {
      spellcastingEntry = (this.actor.getOwnedItem(spell.data.location.value) || {}).data;
    }

    // if the spellcaster entry cannot be found (maybe it was deleted?)
    if (!spellcastingEntry) {
      console.log(`PF2e System | Prepare Spell | Spellcasting entry not found for spell ${spell.name}`);
      return;
    }

    // This is needed only if we want to prepare the data model only for the levels that a spell is already prepared in setup spellbook levels for all of those to catch case where sheet only has spells of lower level prepared in higher level slot
    const isNotLevelBasedSpellcasting = spellcastingEntry.data?.tradition?.value === "wand" ||
      spellcastingEntry.data?.tradition?.value === "scroll" ||
      spellcastingEntry.data?.tradition?.value === "ritual" ||
      spellcastingEntry.data?.tradition?.value === "focus"

    const spellsSlotsWhereThisIsPrepared = Object.entries((spellcastingEntry.data?.slots || {}) as Record<any, any>)?.filter( slotArr => !!Object.values(slotArr[1].prepared as any[]).find(slotSpell => slotSpell?.id === spell._id))
    const highestSlotPrepared = spellsSlotsWhereThisIsPrepared?.map(slot => parseInt(slot[0].match(/slot(\d+)/)[1],10)).reduce( (acc,cur) => cur>acc ? cur : acc, 0) ?? spellLvl
    const normalHighestSpellLevel = Math.ceil(actorData.data.details.level.value / 2)
    const maxSpellLevelToShow = Math.min(10,Math.max(spellLvl, highestSlotPrepared, normalHighestSpellLevel))
    // Extend the Spellbook level
    for(let i=maxSpellLevelToShow;i>=0;i--){
      if(!isNotLevelBasedSpellcasting || i === spellLvl){
        spellbook[i] = spellbook[i] || {
          isCantrip: i === 0,
          isFocus: i === 11,
          label: CONFIG.PF2E.spellLevels[i],
          spells: [],
          prepared: [],
          uses: spellcastingEntry ? parseInt(spellcastingEntry.data?.slots[`slot${i}`].value, 10) || 0 : 0,
          slots: spellcastingEntry ? parseInt(spellcastingEntry.data?.slots[`slot${i}`].max, 10) || 0 : 0,
          displayPrepared: spellcastingEntry && spellcastingEntry.data.displayLevels && spellcastingEntry.data.displayLevels[i] !== undefined ? (spellcastingEntry.data.displayLevels[i]) : true,
          unpreparedSpellsLabel: spellcastingEntry && spellcastingEntry.data.tradition.value==='arcane' && spellcastingEntry.data.prepared.value==='prepared' ? game.i18n.localize("PF2E.UnpreparedSpellsLabelArcanePrepared") : game.i18n.localize("PF2E.UnpreparedSpellsLabel")
        };
      }
    }


    // Add the spell to the spellbook at the appropriate level
    spell.data.school.str = CONFIG.PF2E.spellSchools[spell.data.school.value];
    // Add chat data
    try {
      const item = this.actor.getOwnedItem(spell._id);
      if (item){
        spell.chatData = item.getChatData({ secrets: this.actor.owner });
      }
    } catch (err) {
      console.log(`PF2e System | Character Sheet | Could not load chat data for spell ${spell.id}`, spell)
    }
    spellbook[spellLvl].spells.push(spell);
  }


  /* -------------------------------------------- */

  /**
   * Insert prepared spells into the spellbook object when rendering the character sheet
   * @param {Object} spellcastingEntry    The spellcasting entry data being prepared
   * @param {Object} spellbook            The spellbook data being prepared
   * @private
   */
  _preparedSpellSlots(spellcastingEntry, spellbook) {
    // let isNPC = this.actorType === "npc";

    for (const [key, spl] of Object.entries(spellbook as Record<any, any>)) {
      if (spl.slots > 0) {
        for (let i = 0; i < spl.slots; i++) {
          const entrySlot = ((spellcastingEntry.data.slots[`slot${key}`] || {}).prepared || {})[i] || null;

          if (entrySlot && entrySlot.id) {
            // console.log(`PF2e System | Getting item: ${entrySlot.id}: `);
            const item : any = this.actor.getOwnedItem(entrySlot.id);
            if (item) {
              // console.log(`PF2e System | Duplicating item: ${item.name}: `, item);
              const itemCopy : any = duplicate(item);
              if (entrySlot.expended) {
                itemCopy.expended = true;
              }
              else {
                itemCopy.expended = false;
              }

              spl.prepared[i] = itemCopy;
              if (spl.prepared[i]) {
                // enrich data with spell school formatted string
                if (spl.prepared[i].data && spl.prepared[i].data.school && spl.prepared[i].data.school.str) {
                  spl.prepared[i].data.school.str = CONFIG.PF2E.spellSchools[spl.prepared[i].data.school.value];
                }

                // Add chat data
                try {
                  spl.prepared[i].chatData = item.getChatData({ secrets: this.actor.owner });
                } catch (err) {
                  console.log(`PF2e System | Character Sheet | Could not load prepared spell ${entrySlot.id}`, item)
                }


                spl.prepared[i].prepared = true;
              }
              // prepared spell not found
              else {
                spl.prepared[i] = {
                  name: 'Empty Slot (drag spell here)',
                  id: null,
                  prepared: false,
                };
              }
            } else {
              // Could not find an item for ID: ${entrySlot.id}. Marking the slot as empty so it can be overwritten.
              spl.prepared[i] = {
                name: 'Empty Slot (drag spell here)',
                id: null,
                prepared: false,
              };
            }
          } else {
            // if there is no prepared spell for this slot then make it empty.
            spl.prepared[i] = {
              name: 'Empty Slot (drag spell here)',
              id: null,
              prepared: false,
            };
          }
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Spell SLot
   * Saves the prepared spell slot data to the actor
   * @param spellLevel {String}   The level of the spell slot
   * @param spellSlot {String}    The number of the spell slot
   * @param spell {String}        The item details for the spell
   */
  async _allocatePreparedSpellSlot(spellLevel, spellSlot, spell, entryId) {
    // let spellcastingEntry = this.actor.items.find(i => { return i.id === Number(entryId) });;
    // let spellcastingEntry = this.actor.getOwnedItem(Number(entryId)).data;

    // If NPC, then update icons to action icons.
/*     const isNPC = this.actorType === 'npc';
    if (isNPC) {
      const spellType = spell.data.time.value;
      if (spellType === 'reaction') spell.img = this._getActionImg('reaction');
      else if (spellType === 'free') spell.img = this._getActionImg('free');
      else if (parseInt(spellType)) spell.img = this._getActionImg(parseInt(spellType));
    } */

    // spellcastingEntry.data.slots["slot" + spellLevel].prepared[spellSlot] = spell;
    /* spellcastingEntry.data.slots["slot" + spellLevel].prepared[spellSlot] = {
      id: spell.id
    };
    await this.actor.updateOwnedItem(spellcastingEntry, true);  */
    if (CONFIG.debug.hooks === true) console.log(`PF2e DEBUG | Updating location for spell ${spell.name} to match spellcasting entry ${entryId}`);
    const key = `data.slots.slot${spellLevel}.prepared.${spellSlot}`;
    const options = {
      _id: entryId,
    };
    options[key] = { id: spell._id };
    this.actor.updateEmbeddedEntity('OwnedItem', options);
  }

  /* -------------------------------------------- */

  /**
   * Remove Spell Slot
   * Removes the spell from the saved spell slot data for the actor
   * @param spellLevel {String}   The level of the spell slot
   * @param spellSlot {String}    The number of the spell slot    *
   */
  async _removePreparedSpellSlot(spellLevel, spellSlot, entryId) {
    // let spellcastingEntry = this.actor.items.find(i => { return i.id === Number(entryId) });;
    /*     let spellcastingEntry = this.actor.getOwnedItem(Number(entryId)).data;

    spellcastingEntry.data.slots["slot" + spellLevel].prepared[spellSlot] = {
      name: "Empty Slot (drag spell here)",
      id: null,
      prepared: false
    };
    await this.actor.updateOwnedItem(spellcastingEntry, true);  */
    if (CONFIG.debug.hooks === true) console.log(`PF2e DEBUG | Updating spellcasting entry ${entryId} to remove spellslot ${spellSlot} for spell level ${spellLevel}`);
    const key = `data.slots.slot${spellLevel}.prepared.${spellSlot}`;
    const options = {
      _id: entryId,
    };
    options[key] = {
      name: 'Empty Slot (drag spell here)',
      id: null,
      prepared: false,
    };
    this.actor.updateEmbeddedEntity('OwnedItem', options);
  }

  /**
   * Sets the expended state of a  Spell Slot
   * Marks the slot as expended which is reflected in the UI
   * @param spellLevel {String}   The level of the spell slot
   * @param spellSlot {String}    The number of the spell slot    *
   */
  async _setExpendedPreparedSpellSlot(spellLevel, spellSlot, entryId, expendedState) {
    let state = true;
    if (expendedState === "true") state = false;

    const key = `data.slots.slot${spellLevel}.prepared.${spellSlot}`;
    const options = {
      _id: entryId,
    };
    options[key] = {
      expended: state,
    };
    this.actor.updateEmbeddedEntity('OwnedItem', options);
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display a certain level of skill proficiency
   * @private
   */
  _getProficiencyIcon(level) {
    const icons = {
      0: '',
      1: '<i class="fas fa-check-circle"></i>',
      2: '<i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i>',
      3: '<i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i>',
      4: '<i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i><i class="fas fa-check-circle"></i>',
    };
    return icons[level];
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display a certain level of dying
   * @private
   */
  _getDyingIcon(level) {
    const maxDying = this.object.data.data.attributes.dying.max || 4;
    const doomed = this.object.data.data.attributes.doomed.value || 0;
    const circle = '<i class="far fa-circle"></i>';
    const cross = '<i class="fas fa-times-circle"></i>';
    const skull = '<i class="fas fa-skull"></i>';
    const redOpen = '<span>';
    const redClose = '</span>';
    const icons = {};

    for  (let dyingLevel = 0; dyingLevel <= maxDying; dyingLevel++) {
      icons[dyingLevel] = (dyingLevel===maxDying) ? redOpen : ('');
      for  (let column = 1; column <= maxDying; column++) {
        if (column >= maxDying - doomed || dyingLevel === maxDying) {
          icons[dyingLevel] += skull;
        } else if (dyingLevel < column) {
          icons[dyingLevel] += circle;
        } else {
          icons[dyingLevel] += cross;
        }
      }
      icons[dyingLevel] += (dyingLevel===maxDying) ? redClose : ('');
    }

    return icons[level];
  }

  /**
   * Get the font-awesome icon used to display a certain level of wounded
   * @private
   */
  _getWoundedIcon(level) {
    const maxDying = this.object.data.data.attributes.dying.max || 4;
    const icons = {};
    const usedPoint = '<i class="fas fa-dot-circle"></i>';
    const unUsedPoint = '<i class="far fa-circle"></i>';

    for (let i=0; i<maxDying; i++) {
      let iconHtml = '';
      for (let iconColumn=1; iconColumn<maxDying; iconColumn++) {
        iconHtml += (iconColumn<=i) ? usedPoint : unUsedPoint;
      }
      icons[i] = iconHtml;
    }

    return icons[level];
  }

  /**
   * Get the font-awesome icon used to display a certain level of doomed
   * @private
   */
  _getDoomedIcon(level) {
    const icons = {
      0: '<i class="far fa-circle"></i><i class="far fa-circle"></i><i class="far fa-circle"></i>',
      1: '<i class="fas fa-skull"></i><i class="far fa-circle"></i><i class="far fa-circle"></i>',
      2: '<i class="fas fa-skull"></i><i class="fas fa-skull"></i><i class="far fa-circle"></i>',
      3: '<i class="fas fa-skull"></i><i class="fas fa-skull"></i><i class="fas fa-skull"></i>',
    };
    return icons[level];
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display hero points
   * @private
   */
  _getHeroPointsIcon(level) {
    const icons = {
      0: '<i class="far fa-circle"></i><i class="far fa-circle"></i><i class="far fa-circle"></i>',
      1: '<i class="fas fa-hospital-symbol"></i><i class="far fa-circle"></i><i class="far fa-circle"></i>',
      2: '<i class="fas fa-hospital-symbol"></i><i class="fas fa-hospital-symbol"></i><i class="far fa-circle"></i>',
      3: '<i class="fas fa-hospital-symbol"></i><i class="fas fa-hospital-symbol"></i><i class="fas fa-hospital-symbol"></i>',
    };
    return icons[level];
  }

  /* -------------------------------------------- */

  /**
   * Get the action image to use for a particular action type.
   * @private
   */
  _getActionImg(action) {
    const img = {
      0: 'icons/svg/mystery-man.svg',
      1: 'systems/pf2e/icons/actions/OneAction.png',
      2: 'systems/pf2e/icons/actions/TwoActions.png',
      3: 'systems/pf2e/icons/actions/ThreeActions.png',
      free: 'systems/pf2e/icons/actions/FreeAction.png',
      reaction: 'systems/pf2e/icons/actions/Reaction.png',
      passive: 'systems/pf2e/icons/actions/Passive.png',
    };
    return img[action];
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

    // Pad field width
    html.find('[data-wpad]').each((i, e) => {
      const text = e.tagName === 'INPUT' ? e.value : e.innerText;
      const w = text.length * parseInt(e.getAttribute('data-wpad'), 10) / 2;
      e.setAttribute('style', `flex: 0 0 ${w}px`);
    });

    // Item summaries
    html.find('.item .item-name h4').click((event) => {
      this._onItemSummary(event);
    });

    // NPC Attack summaries
    html.find('.item .melee-name h4').click((event) => {
      this._onItemSummary(event);
    });

    // for spellcasting checks
    html.find('.spellcasting.rollable').click((event) => {
      event.preventDefault();
      const itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
      const item = this.actor.getOwnedItem(itemId) as PF2EItem;
      item.rollSpellcastingEntryCheck(event);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    /* -------------------------------------------- */
    /*  Attributes, Skills, Saves and Traits
     /* -------------------------------------------- */

    // Roll Save Checks
    html.find('.save-name').click((ev) => {
      ev.preventDefault();
      const save = $(ev.currentTarget).parents('[data-save]')[0].getAttribute('data-save');
      if (this.actor.data.data.saves[save]?.roll) {
        const opts = this.actor.getRollOptions(['all', 'saving-throw', save]);
        this.actor.data.data.saves[save].roll(ev, opts);
      } else {
        this.actor.rollSave(ev, save);
      }
    });

    // Roll Attribute Checks
    html.find('.roll-init').click((ev) => {
      ev.preventDefault();
      const checkType = this.actor.data.data.attributes.initiative.ability;
      const opts = this.actor.getRollOptions(['all', 'initiative'].concat(SKILL_DICTIONARY[checkType] ?? checkType));
      this.actor.data.data.attributes.initiative.roll(ev, opts);
    });

    html.find('.attribute-name').click((ev) => {
      ev.preventDefault();
      const attribute = ev.currentTarget.parentElement.getAttribute('data-attribute');
      if (this.actor.data.data.attributes[attribute]?.roll) {
        const opts = this.actor.getRollOptions(['all', attribute]);
        this.actor.data.data.attributes[attribute].roll(ev, opts);
      } else {
        this.actor.rollAttribute(ev, attribute);
      }
    });

    // Roll Ability Checks
    html.find('.ability-name').click((ev) => {
      ev.preventDefault();
      const ability = ev.currentTarget.parentElement.getAttribute('data-ability');
      this.actor.rollAbility(ev, ability);
    });

    // Roll Skill Checks
    html.find('.skill-name.rollable').click((ev) => {
      const skl = ev.currentTarget.parentElement.getAttribute('data-skill');
      if (this.actor.data.data.skills[skl]?.roll) {
        const opts = this.actor.getRollOptions(['all', 'skill-check', SKILL_DICTIONARY[skl] ?? skl]);
        this.actor.data.data.skills[skl].roll(ev, opts);
      } else {
        this.actor.rollSkill(ev, skl);
      }
    });

    // Roll Recovery Flat Check when Dying
    html.find('.recoveryCheck.rollable').click((ev) => {
      this.actor.rollRecovery(ev);
    });

    // Toggle Levels of stats (like proficiencies conditions or hero points)
    html.find('.click-stat-level').on('click contextmenu', this._onClickStatLevel.bind(this));

    // Toggle Dying Wounded
    html.find('.dying-click').on('click contextmenu', this._onClickDying.bind(this));

    // Remove Spell Slot
    html.find('.item-unprepare').click((ev) => {
      const slotId = Number($(ev.currentTarget).parents('.item').attr('data-slot-id'));
      const spellLvl = Number($(ev.currentTarget).parents('.item').attr('data-spell-lvl'));
      const entryId = $(ev.currentTarget).parents('.item').attr('data-entry-id');
      this._removePreparedSpellSlot(spellLvl, slotId, entryId);
    });

    // Set Expended Status of Spell Slot
    html.find('.item-toggle-prepare').click((ev) => {
      const slotId = Number($(ev.currentTarget).parents('.item').attr('data-slot-id'));
      const spellLvl = Number($(ev.currentTarget).parents('.item').attr('data-spell-lvl'));
      const entryId = $(ev.currentTarget).parents('.item').attr('data-entry-id');
      const expendedState = $(ev.currentTarget).parents('.item').attr('data-expended-state');
      this._setExpendedPreparedSpellSlot(spellLvl, slotId, entryId, expendedState);
    });

    // Toggle equip
    html.find('.item-toggle-equip').click((ev) => {
      const f = $(ev.currentTarget);
      const itemId = f.parents('.item').attr('data-item-id');
      const active = f.hasClass('active');
      this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.equipped.value': !active });

    });

    // Trait Selector
    html.find('.trait-selector').click((ev) => this._onTraitSelector(ev));

    html.find('.add-coins-popup button').click(ev => this._onAddCoinsPopup(ev));

    html.find('.sell-all-treasure button').click(ev => this._onSellAllTreasure(ev));

    // Feat Browser
    html.find('.feat-browse').click((ev) => compendiumBrowser.openTab('feat'));

    // Action Browser
    html.find('.action-browse').click((ev) => compendiumBrowser.openTab('action'));

    // Spell Browser
    html.find('.spell-browse').click((ev) => compendiumBrowser.openTab('spell'));

    // Inventory Browser
    html.find('.inventory-browse').click((ev) => compendiumBrowser.openTab('equipment'));

    // Spell Create
    html.find('.spell-create').click((ev) => this._onItemCreate(ev));

    // Add Spellcasting Entry
    html.find('.spellcasting-create').click((ev) => this._createSpellcastingEntry(ev));

    // Remove Spellcasting Entry
    html.find('.spellcasting-remove').click((ev) => this._removeSpellcastingEntry(ev));

    // toggle visibility of filter containers
    html.find('.hide-container-toggle').click((ev) => {
      $(ev.target).parent().siblings().toggle(100, () => { });
    });

    /* -------------------------------------------- */
    /*  Inventory
    /* -------------------------------------------- */

    // Create New Item
    html.find('.item-create').click((ev) => this._onItemCreate(ev));

    html.find('.item-toggle-container').click((ev) => this._toggleContainer(ev));

    // Sell treasure item
    html.find('.item-sell-treasure').click((ev) => {
      const itemId = $(ev.currentTarget).parents('.item').attr('data-item-id');
      sellTreasure(this.actor, itemId);
    });

    // Update Inventory Item
    html.find('.item-edit').click((ev) => {
      const itemId = $(ev.currentTarget).parents('.item').attr('data-item-id');
      const Item = CONFIG.Item.entityClass;
      // const item = new Item(this.actor.items.find(i => i.id === itemId), {actor: this.actor});
      const item = new Item(this.actor.getOwnedItem(itemId).data, { actor: this.actor });
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(async (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const itemId = li.attr('data-item-id');
      const item = new Item(this.actor.getOwnedItem(itemId).data, { actor: this.actor });

      const content = await renderTemplate('systems/pf2e/templates/actors/delete-item-dialog.html', {name: item.name});
      new Dialog({
        title: 'Delete Confirmation',
        content,
        buttons: {
          Yes: {
            icon: '<i class="fa fa-check"></i>',
            label: 'Yes',
            callback: async () => {
              await this.actor.deleteOwnedItem(itemId);
              // clean up any individually targeted modifiers to attack and damage
              await this.actor.update({
                [`data.customModifiers.-=${itemId}-attack`]: null,
                [`data.customModifiers.-=${itemId}-damage`]: null,
              });
              li.slideUp(200, () => this.render(false));
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
          },
        },
        default: 'Yes',
      }).render(true);
    });

    // Increase Item Quantity
    html.find('.item-increase-quantity').click((event) => {
      const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      const item = this.actor.getOwnedItem(itemId).data;
      if (!('quantity' in item.data)) { throw new Error('Tried to update quantity on item that does not have quantity'); }
      this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.quantity.value': Number(item.data.quantity.value) + 1 });
    });

    // Decrease Item Quantity
    html.find('.item-decrease-quantity').click((event) => {
      const li = $(event.currentTarget).parents('.item');
      const itemId = li.attr('data-item-id');
      const item = this.actor.getOwnedItem(itemId).data;
      if (!('quantity' in item.data)) { throw new Error('Tried to update quantity on item that does not have quantity'); }
      if (Number(item.data.quantity.value) > 0) {
        this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.quantity.value': Number(item.data.quantity.value) - 1 });
      }
    });

    // Toggle Spell prepared value
    html.find('.item-prepare').click((ev) => {
      const itemId = $(ev.currentTarget).parents('.item').attr('data-item-id');
      // item = this.actor.items.find(i => { return i.id === itemId });
      const item = this.actor.getOwnedItem(itemId).data;
      if (!('prepared' in item.data)) { throw new Error('Tried to update prepared on item that does not have prepared'); }
      item.data.prepared.value = !item.data.prepared.value;
      this.actor.updateEmbeddedEntity('OwnedItem', item);
    });

    // Item Dragging
    const handler = (ev) => this._onDragItemStart(ev);
    html.find('.item').each((i, li) => {
      li.setAttribute('draggable', true);
      li.addEventListener('dragstart', handler, false);
    });

    // change background for dragged over items that are containers
      const containerItems = Array.from(html[0].querySelectorAll('[data-item-is-container="true"]'));
      containerItems
        .forEach((elem: HTMLElement) =>
            elem.addEventListener('dragenter', () => elem.classList.add('hover-container'), false))
    containerItems
          .forEach((elem: HTMLElement) => elem.addEventListener('dragleave', () => elem.classList.remove('hover-container'), false))

    // Action Rolling (experimental strikes)
    html.find('[data-action-index].item .item-image.action-strike').click((event) => {
      const actionIndex = $(event.currentTarget).parents('.item').attr('data-action-index');
      const opts = this.actor.getRollOptions(['all', 'attack-roll']);
      this.actor.data.data.actions[Number(actionIndex)].roll(event, opts);
    });

    html.find('[data-variant-index].variant-strike').click((event) => {
      const actionIndex = $(event.currentTarget).parents('.item').attr('data-action-index');
      const variantIndex = $(event.currentTarget).attr('data-variant-index');
      const opts = this.actor.getRollOptions(['all', 'attack-roll']);
      this.actor.data.data.actions[Number(actionIndex)].variants[Number(variantIndex)].roll(event, opts);
    });

    // Item Rolling
    html.find('[data-item-id].item .item-image').click((event) => this._onItemRoll(event));

    // Lore Item Rolling
    html.find('.item .lore-score-rollable').click((event) => {
      event.preventDefault();
      const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      const item = this.actor.getOwnedItem(itemId);
      this.actor.rollLoreSkill(event, item);
    });


    // Update Item Bonus on an actor.item input
    html.find('.focus-pool-input').change(async (event) => {
      event.preventDefault();
      const itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
      const focusPool = Math.clamped(Number(event.target.value), 0, 3);
      const item = this.actor.getOwnedItem(itemId);
      let focusPoints = getProperty(item.data, 'data.focus.points') || 0;
      focusPoints = Math.clamped( focusPoints , 0, focusPool );
      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.focus.points': focusPoints, 'data.focus.pool': focusPool });
    });

    // Update Item Bonus on an actor.item input
    html.find('.item-value-input').change(async (event) => {
      event.preventDefault();

      let itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      if (!itemId) {
        itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
      }

      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.item.value': Number(event.target.value) });
    });

    // Update Item Name
    html.find('.item-name-input').change(async (event) => {
      const itemId = event.target.attributes['data-item-id'].value;
      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, name: event.target.value });
    });


    // Update used slots for Spell Items
    html.find('.spell-slots-input').change(async (event) => {
      event.preventDefault();

      const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      const slotLvl = Number($(event.currentTarget).parents('.item').attr('data-level'));

      const key = `data.slots.slot${slotLvl}.value`;
      const options = { _id: itemId };
      options[key] = Number(event.target.value);

      await this.actor.updateEmbeddedEntity('OwnedItem', options);
    });

    // Update max slots for Spell Items
    html.find('.spell-max-input').change(async (event) => {
      event.preventDefault();

      const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      const slotLvl = Number($(event.currentTarget).parents('.item').attr('data-level'));
      const key = `data.slots.slot${slotLvl}.max`;
      const options = { _id: itemId };
      options[key] = Number(event.target.value);

      await this.actor.updateEmbeddedEntity('OwnedItem', options);
    });

    // Modify select element
    html.find('.ability-select').change(async (event) => {
      event.preventDefault();

      const itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.ability.value': event.target.value });
    });

    // Update max slots for Spell Items
    html.find('.prepared-toggle').click(async (event) => {
      event.preventDefault();

      const itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
      const itemToEdit = this.actor.getOwnedItem(itemId).data;
      if (itemToEdit.type !== 'spellcastingEntry') throw new Error('Tried to toggle prepared spells on a non-spellcasting entry');
      const bool = !(itemToEdit.data.showUnpreparedSpells || {}).value;

      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.showUnpreparedSpells.value': bool });
    });

    html.find('.level-prepared-toggle').click(async (event) => {
      event.preventDefault();

      const parentNode = $(event.currentTarget).parents('.spellbook-header');
      const itemId = parentNode.attr('data-item-id');
      const lvl = parentNode.attr('data-level')
      const itemToEdit = this.actor.getOwnedItem(itemId).data;
      if (itemToEdit.type !== 'spellcastingEntry') throw new Error('Tried to toggle prepared spells on a non-spellcasting entry');
      const currentDisplayLevels = itemToEdit.data.displayLevels || {};
      currentDisplayLevels[lvl] = !currentDisplayLevels[lvl];
      await this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.displayLevels': currentDisplayLevels });
      this.render();
    });

  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle cycling of dying
   * @private
   */
  _onClickDying(event) {
    event.preventDefault();
    const field = $(event.currentTarget).siblings('input[type="hidden"]');
    const maxDying = this.object.data.data.attributes.dying.max;
    // const wounded = this.object.data.data.attributes.wounded.value;
    const wounded = 0; // Don't automate wounded when clicking on dying until dying is also automated on damage from chat and Recovery rolls
    const doomed = this.object.data.data.attributes.doomed.value;

    // Get the current level and the array of levels
    const level = parseFloat(`${field.val()}`);
    let newLevel;

    // Toggle next level - forward on click, backwards on right
    if (event.type === 'click') {
      newLevel = Math.clamped( (level + 1 + wounded) , 0, maxDying );
      if (newLevel+doomed >= maxDying) newLevel = maxDying;
    } else if (event.type === 'contextmenu') {
      newLevel = Math.clamped( (level - 1) , 0, maxDying );
      if (newLevel+doomed >= maxDying) newLevel -= doomed;
    }

    // Update the field value and save the form
    field.val(newLevel);
    this._onSubmit(event);
  }

  /**
   * Handle clicking of stat levels. The max level is by default 4.
   * The max level can be set in the hidden input field with a data-max attribute. Eg: data-max="3"
   * @private
   */
  _onClickStatLevel(event) {
    event.preventDefault();
    const field = $(event.currentTarget).siblings('input[type="hidden"]');
    const max = field.data('max') ?? 4;
    const statIsItemType = field.data('stat-type') ?? false;

    // Get the current level and the array of levels
    const level = parseFloat(`${field.val()}`);
    let newLevel;

    // Toggle next level - forward on click, backwards on right
    if (event.type === 'click') {
      newLevel = Math.clamped( (level + 1) , 0, max );
    } else if (event.type === 'contextmenu') {
      newLevel = Math.clamped( (level - 1) , 0, max );
    }
    // Update the field value and save the form

    if(statIsItemType === 'item') {
      let itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
      if (itemId === undefined) {
        // Then item is spellcastingEntry, this could be refactored
        // but data-contained-id and proviciency/proficient need to be refactored everywhere to give
        // Lore Skills, Martial Skills and Spellcasting Entries the same structure.

        itemId = $(event.currentTarget).parents('.item-container').attr('data-container-id');
        if ($(event.currentTarget).attr('title') === game.i18n.localize("PF2E.Focus.pointTitle")) {
          const item = this.actor.getOwnedItem(itemId);
          const focusPoolSize = getProperty(item.data, 'data.focus.pool') || 1;
          newLevel = Math.clamped( newLevel , 0, focusPoolSize );
          this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.focus.points': newLevel });
        } else {
          this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.proficiency.value': newLevel });
        }
      } else {
        this.actor.updateEmbeddedEntity('OwnedItem', { _id: itemId, 'data.proficient.value': newLevel });
      }
      return;
    }
    field.val(newLevel);
    this._onSubmit(event);
  }


  /* -------------------------------------------- */

  _onDragItemStart(event: any): boolean {
    const itemId = event.currentTarget.getAttribute('data-item-id');

    if (itemId) {
      const item = this.actor.getOwnedItem(itemId);
	    event.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'Item',
        data: item.data,
        actorId: this.actor._id,
        tokenId: this.actor.token?.id,
        id: itemId,
      }));
    }

    return !!itemId;
  }

  /* -------------------------------------------- */

  /**
   * Extend the base _onDrop method to handle dragging spells onto spell slots.
   * @private
   */
  async _onDrop(event) {
    event.preventDefault();
    if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** PF2e _onDrop (spell) override method called *****');

    // get the item type of the drop target
    const dropSlotType = $(event.target).parents('.item').attr('data-item-type');
    const dropContainerType = $(event.target).parents('.item-container').attr('data-container-type');


    // if the drop target is of type spellSlot then check if the item dragged onto it is a spell.
    if (dropSlotType === 'spellSlot') {

      const dragData = event.dataTransfer.getData('text/plain');
      const dragItem = JSON.parse(dragData);
      // dragItem = this.actor.getOwnedItem(dragJSON.data._id);

      // if the dragged item is from a compendium pack.
      if (dragItem.pack) {
        if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** item from compendium pack dropped on a spellSlot *****');
        const dropID = $(event.target).parents('.item-container').attr('data-container-id');
        this.actor.importItemFromCollectionWithLocation(dragItem.pack, dragItem.id, dropID);
        return false;
      }

      // if the dragged item is a apell.
      if (dragItem && dragItem.data && dragItem.data.type === 'spell') {
        if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** spell dropped on a spellSlot *****');
        const dropID = $(event.target).parents('.item').attr('data-item-id');
        const spellLvl = Number($(event.target).parents('.item').attr('data-spell-lvl'));
        const entryId = $(event.target).parents('.item').attr('data-entry-id');

        this._allocatePreparedSpellSlot(spellLvl, dropID, dragItem.data, entryId);
      }

      // else if the dragged item is from another actor and is the data is explicitly provided
      else if (dragItem.data) {
        if (dragItem.data.type === 'spell') { // check if dragged item is a spell, if not, handle with the super _onDrop method.
          if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** spell dragged from another actor dropped on a spellSlot *****');
          if (dragItem.actorId === this.actor._id) return false; // Don't create duplicate items (ideally the previous if statement would have handled items being dropped on the same actor.)

          const dropID = $(event.target).parents('.item-container').attr('data-container-id');
          dragItem.data.data.location = {
            value: dropID,
          };
          // this.actor.createOwnedItem(dragData.data);
          this.actor.createEmbeddedEntity('OwnedItem', dragData.data);
          return false;
        }
        else if (dragItem.data.type === 'item') {
          console.log('An item from another sheet has been dropped here.');
        }
      }
    }

    if (dropContainerType === 'spellcastingEntry') { // if the drop container target is a spellcastingEntry then check if the item is a spell and if so update its location.
      const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
      // dragItem = this.actor.getOwnedItem(dragData._id);

      // if the dragged item is a spell and is from the same actor
      if (dragData && dragData.data && dragData.data.type === 'spell' && (dragData.actorId === this.actor.id)) {
        if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** spell from same actor dropped on a spellcasting entry *****');
        const dropID = $(event.target).parents('.item-container').attr('data-container-id');

        if (dropID) {
          dragData.data.data.location = { value: dropID };

          // Update Actor
          // await this.actor.updateOwnedItem(dragItem.data, true);
          await this.actor.updateEmbeddedEntity('OwnedItem', dragData.data);
          // await this.actor.updateEmbeddedEntity("OwnedItem", {_id: dragData.id, "data.data.location": {"value": dropID} });
        }
      }

      // else if the dragged item is from another actor and is the data is explicitly provided
      if (dragData.data) {
        if (dragData.data.type === 'spell') { // check if dragged item is a spell, if not, handle with the super _onDrop method.
          if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** spell from another actor dropped on a spellcasting entry *****');
          if (dragData.actorId === this.actor.id) return false; // Don't create duplicate items (ideally the previous if statement would have handled items being dropped on the same actor.)

          const dropID = $(event.target).parents('.item-container').attr('data-container-id');
          dragData.data.data.location = {
            value: dropID,
          };
          // this.actor.createOwnedItem(dragData.data);
          this.actor.createEmbeddedEntity('OwnedItem', dragData.data);
          return false;
        }
      }

      // else if the dragged item is from a compendium pack.
      else if (dragData.pack) {
        if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** item from a compendium pack dropped on a spellcasting entry *****');
        const dropID = $(event.target).parents('.item-container').attr('data-container-id');

        this.actor.importItemFromCollectionWithLocation(dragData.pack, dragData.id, dropID);
        return false;
      }

      // else if the dragged item is from the item sidebar.
      else if (dragData.id) {
        const dragItem = game.items.get(dragData.id);
        if (!dragItem) throw new Error('Dragged item not found');
        const dropID = $(event.target).parents('.item-container').attr('data-container-id');
        (dragItem.data.data as any).location = {
          value: dropID,
        };

        this.actor.createEmbeddedEntity('OwnedItem', dragItem.data);
        return false;
      }
    }

    if (CONFIG.debug.hooks === true) console.log('PF2e DEBUG | ***** PF2e _onDrop (spell) override method finished passing over to _onDropOverride *****');

    return this._onDropOverride(event);
  }

    /**
     * override super._onDrop to fix https://gitlab.com/foundrynet/foundryvtt/-/issues/2871
     * @param event
     * @return {Promise<boolean|*>}
     * @private
     */
    async _onDropOverride(event) {
        // Try to extract the data
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
            if (data.type !== "Item") return false;
        } catch (err) {
            return false;
        }
        // Case 1 - Import from a Compendium pack
        const actor = this.actor;
        let itemData;
        if (data.pack) {
            console.log(`Comes from compemdium`);
            const pack = game.packs.get(data.pack);
            itemData = await pack.getEntry(data.id);
        }
        // Case 2 - Data explicitly provided
        else if (data.data) {
            this.moveItemBetweenActors(event, data.actorId, data.tokenId, actor._id, actor.token?.id, data.id);
            return true;
        }
        // Case 3 - Import from World entity
        else {
            console.log(`From world entry`);
            const item = game.items.get(data.id);
            if (!item) return false;
            itemData = duplicate(item.data);
        }

        if (itemData.type === 'kit') {
            await addKit(itemData, async (newItems) => {
                const items = await actor.createOwnedItem(newItems);
                if (Array.isArray(items)) {
                    return items.map(item => item._id);
                }
                return [items._id];
            });
            return true;
        } else if (itemData.type === 'condition') {
          const condition = itemData as ConditionData;
          await PF2eConditionManager._addConditionEntity(condition, this.token);
          return true;
        }

        const container = $(event.target).parents('[data-item-is-container="true"]');
        let containerId = null;
        if (container[0] !== undefined) {
          containerId = container[0].dataset.itemId?.trim();
        }
        return PF2EActor.stashOrUnstash(actor, async () => {
            const newItemData = await actor.createOwnedItem(itemData);
            return actor.getOwnedItem(newItemData._id);
        }, containerId);
    }

    /**
     * Moves an item between two actors' inventories.
     * @param {event} event         Event that fired this method.
     * @param {actor} sourceActorId ID of the actor who originally owns the item.
     * @param {actor} targetActorId ID of the actor where the item will be stored.
     * @param {id} itemId           ID of the item to move between the two actors.
     */
    async moveItemBetweenActors(event, sourceActorId, sourceTokenId, targetActorId, targetTokenId, itemId) {
      const sourceActor = sourceTokenId ? game.actors.tokens[sourceTokenId] : game.actors.get(sourceActorId);
      const targetActor = targetTokenId ? game.actors.tokens[targetTokenId] : game.actors.get(targetActorId);
      const item = sourceActor.getOwnedItem(itemId);

      const isSameActor = (sourceActorId === targetActorId) && (sourceTokenId === targetTokenId);

      const container = $(event.target).parents('[data-item-is-container="true"]');
      let containerId = null;
      if (container[0] !== undefined) {
        containerId = container[0].dataset.itemId?.trim();
      }
      if (isSameActor) {
        await PF2EActor.stashOrUnstash(targetActor, () => { return item; }, containerId);
        return this._onSortItem(event, item.data);
      }
      const sourceItemQuantity = 'quantity' in item.data.data ? Number(item.data.data.quantity.value) : 0;

      // If more than one item can be moved, show a popup to ask how many to move
      if (sourceItemQuantity > 1)
      {
        const popup = new MoveLootPopup(sourceActor, {}, (quantity) => {
          console.log(`Accepted moving ${quantity} items`);
          PF2EActor.transferItemToActor(sourceActor, targetActor, item, quantity, containerId);
        });

        popup.render(true);
      }
      else
      {
        PF2EActor.transferItemToActor(sourceActor, targetActor, item, 1, containerId);
      }
      return true;
    }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    const item = this.actor.getOwnedItem(itemId);
    item.roll(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();

    const li = $(event.currentTarget).parent().parent();
    const itemId = li.attr('data-item-id');
    const itemType = li.attr('data-item-type');
    let item: PF2EItem;

    if (itemType === 'spellSlot') return;

    try {
      item = this.actor.getOwnedItem(itemId);
      if (!item.type) return;
    } catch (err) {
      return;
    }

    if (item.data.type === 'spellcastingEntry') return;

    const chatData = item.getChatData({ secrets: this.actor.owner });

    this._renderItemSummary(li, item, chatData);
  }

  _renderItemSummary(li, item, chatData) {
    const localize = game.i18n.localize.bind(game.i18n);

    // Toggle summary
    if (li.hasClass('expanded')) {
      const summary = li.children('.item-summary');
      summary.slideUp(200, () => summary.remove());
    } else {
      const div = $(`<div class="item-summary"><div class="item-description">${chatData.description.value}</div></div>`);
      const props = $('<div class="item-properties tags"></div>');
      if (chatData.properties) {
        chatData.properties.filter((p) => typeof p === 'string').forEach((p) => {
          props.append(`<span class="tag tag_secondary">${localize(p)}</span>`);
        });
      }
      if (chatData.critSpecialization) props.append(`<span class="tag" title="${localize(chatData.critSpecialization.description)}" style="background: rgb(69,74,124); color: white;">${localize(chatData.critSpecialization.label)}</span>`);
      // append traits (only style the tags if they contain description data)
      if (chatData.traits && chatData.traits.length) {
        chatData.traits.forEach((p) => {
          if (p.description) props.append(`<span class="tag tag_alt" title="${localize(p.description)}">${localize(p.label)}</span>`);
          else props.append(`<span class="tag">${localize(p.label)}</span>`);
        });
      }

      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass('expanded');
  }


  /* -------------------------------------------- */

    /**
     * Opens an item container
     */
    _toggleContainer(event) {
        const itemId = $(event.currentTarget).parents('.item').data('item-id');
        const item = this.actor.getOwnedItem(itemId);
        if (item === null || item.data.type !== 'backpack') {
          return;
        }

        const isCollapsed = item?.data?.data?.collapsed?.value ?? false;
        item.update({'data.collapsed.value': !isCollapsed});
    }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const data = duplicate(header.dataset);

    if (data.type === 'feat') {
      data.name = `New ${data.featType.capitalize()} ${data.type.capitalize()}`;
      mergeObject(data, { 'data.featType.value': data.featType });
    } else if (data.type === 'action') {
      data.name = `New ${data.actionType.capitalize()}`;
      mergeObject(data, { 'data.actionType.value': data.actionType });
    } else if (data.type === 'melee') {
      data.name = `New ${data.actionType.capitalize()}`;
      mergeObject(data, { 'data.weaponType.value': data.actionType });
    } else if (data.type === 'spell') {
      // for prepared spellcasting entries, set showUnpreparedSpells to true to avoid the confusion of nothing appearing to happen.
      this.actor._setShowUnpreparedSpells(data.location, data.level);

      data.name = `New  Level ${data.level} ${data.type.capitalize()}`;
      mergeObject(data, {
        'data.level.value': data.level,
        'data.location.value': data.location,
      });
      // Show the spellbook pages if you're adding a new spell
      const currentLvlToDisplay = {};
      currentLvlToDisplay[data.level] = true;
      this.actor.updateEmbeddedEntity('OwnedItem', {
        _id: data.location,
        'data.showUnpreparedSpells.value': true,
        'data.displayLevels': currentLvlToDisplay
      });
    } else if (data.type === 'lore') {
      if (this.actorType === 'npc') {
        data.name = 'Skill';
        data.img = '/icons/svg/d20-black.svg';
      } else data.name = `New ${data.type.capitalize()}`;
    } else {
      data.name = `New ${data.type.capitalize()}`;
    }
    // this.actor.createOwnedItem(data, {renderSheet: true});
    this.actor.createEmbeddedEntity('OwnedItem', data);
  }

  /* -------------------------------------------- */

  /**
   * Handle creating a new spellcasting entry for the actor
   * @private
   */

  _createSpellcastingEntry(event) {
    event.preventDefault();

    // let entries = this.actor.data.data.attributes.spellcasting.entry || {};

    let magicTradition = 'arcane';
    let spellcastingType = 'innate';

    // Render modal dialog
    const template = 'systems/pf2e/templates/actors/spellcasting-dialog.html';
    const title = 'Select Spellcasting Entry Details';
    const dialogOptions = {
      width: 300,
      top: event.clientY - 80,
      left: window.innerWidth - 710,
    };
    const dialogData = {
      magicTradition,
      magicTraditions: CONFIG.PF2E.magicTraditions,
      spellcastingType,
      spellcastingTypes: CONFIG.PF2E.preparationType,
    };
    renderTemplate(template, dialogData).then((dlg) => {
      new Dialog({
        title,
        content: dlg,
        buttons: {
          create: {
            label: 'Create',
            callback: (html: JQuery) => {
              // if ( onClose ) onClose(html, parts, data);
              let name = '';
              magicTradition = `${html.find('[name="magicTradition"]').val()}`;
              if (magicTradition === 'ritual') {
                spellcastingType = '';
                name = `${CONFIG.PF2E.magicTraditions[magicTradition]}s`;
              } else if (magicTradition === 'focus') {
                spellcastingType = '';
                name = `${CONFIG.PF2E.magicTraditions[magicTradition]} Spells`;
              } else if (magicTradition === 'scroll') {
                spellcastingType = '';
                name = `${CONFIG.PF2E.magicTraditions[magicTradition]}`;
              } else if (magicTradition === 'wand') {
                spellcastingType = 'prepared';
                name = `${CONFIG.PF2E.magicTraditions[magicTradition]}`;
              } else {
                spellcastingType = `${html.find('[name="spellcastingType"]').val()}`;
                name = `${CONFIG.PF2E.preparationType[spellcastingType]} ${CONFIG.PF2E.magicTraditions[magicTradition]} Spells`;
              }

              // Define new spellcasting entry
              const spellcastingEntity = {
                ability: {
                  type: 'String',
                  label: 'Spellcasting Ability',
                  value: '',
                },
                spelldc: {
                  type: 'String',
                  label: 'Class DC',
                  item: 0,
                },
                tradition: {
                  type: 'String',
                  label: 'Magic Tradition',
                  value: magicTradition,
                },
                prepared: {
                  type: 'String',
                  label: 'Spellcasting Type',
                  value: spellcastingType,
                },
                showUnpreparedSpells: { value: true },
              };

              const data = {
                name,
                type: 'spellcastingEntry',
                data: spellcastingEntity,
              };

              this.actor.createEmbeddedEntity('OwnedItem', data);
            }
          },
        },
        default: 'create',
      }, dialogOptions).render(true);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle removing an existing spellcasting entry for the actor
   * @private
   */

  _removeSpellcastingEntry(event) {
    event.preventDefault();

    const li = $(event.currentTarget).parents('.item');
    const itemId = li.attr('data-container-id');
    const item = this.actor.getOwnedItem(itemId);

    // Render confirmation modal dialog
    renderTemplate('systems/pf2e/templates/actors/delete-spellcasting-dialog.html').then((html) => {
      new Dialog({
        title: 'Delete Confirmation',
        content: html,
        buttons: {
          Yes: {
            icon: '<i class="fa fa-check"></i>',
            label: 'Yes',
            callback: async () => {
              console.log('PF2e | Deleting Spell Container: ', item.name);
              // Delete all child objects
              const itemsToDelete = [];
              for (const i of this.actor.data.items) {
                if (i.type === 'spell') {
                  if (i.data.location.value === itemId) {
                    itemsToDelete.push(i._id);
                  }
                }
              }

              await this.actor.deleteOwnedItem(itemsToDelete);

              // Delete item container
              await this.actor.deleteOwnedItem(itemId);
              li.slideUp(200, () => this.render(false));
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
          },
        },
        default: 'Yes',
      }).render(true);
    });
  }

  /* -------------------------------------------- */
  _onAddCoinsPopup(event) {
      event.preventDefault();
      new AddCoinsPopup(this.actor, {}).render(true)
  }

  _onSellAllTreasure(event) {
      event.preventDefault();
      sellAllTreasureSimple(this.actor);
  }

  _onTraitSelector(event) {
    event.preventDefault();
    const a = $(event.currentTarget);
    const options = {
      name: a.parents('label').attr('for'),
      title: a.parent().text().trim(),
      choices: CONFIG.PF2E[a.attr('data-options')],
      has_values: (a.attr('data-has-values') === 'true'),
      allow_empty_values: (a.attr('data-allow-empty-values') === 'true'),
      has_exceptions: (a.attr('data-has-exceptions') === 'true'),
    };
    new TraitSelector5e(this.actor, options).render(true);
  }

  _onCrbTraitSelector(event) {
    event.preventDefault();
    const a = $(event.currentTarget);
    const options = {
      name: a.parents('li').attr('for'),
      title: a.parent().parent().siblings('h4').text().trim(),
      choices: CONFIG.PF2E[a.attr('data-options')],
      has_values: (a.attr('data-has-values') === 'true'),
      allow_empty_values: (a.attr('data-allow-empty-values') === 'true'),
      has_exceptions: (a.attr('data-has-exceptions') === 'true'),
    };
    new TraitSelector5e(this.actor, options).render(true);
  }

  _onAreaEffect(event) {
    const areaType = $(event.currentTarget).attr('data-area-areaType');
    const areaSize = Number($(event.currentTarget).attr('data-area-size'));

    let tool = 'cone';
    if (areaType === 'burst') tool = 'circle';
    else if (areaType === 'emanation') tool = 'rect';
    else if (areaType === 'line') tool = 'ray';

    // Delete any existing templates for this actor.
    let templateData = this.actor.getFlag('pf2e', 'areaEffectId') || null;
    let templateScene = null;
    if (templateData) {
      templateScene = this.actor.getFlag('pf2e', 'areaEffectScene') || null;
      this.actor.setFlag('pf2e', 'areaEffectId', null);
      this.actor.setFlag('pf2e', 'areaEffectScene', null);

      console.log(`PF2e | Existing MeasuredTemplate ${templateData.id} from Scene ${templateScene} found`);
      if (canvas.templates.objects.children) {
        for (const placeable of canvas.templates.objects.children) {
          console.log(`PF2e | Placeable Found - id: ${placeable.data.id}, scene: ${canvas.scene._id}, type: ${placeable.constructor.name}`);
          if (placeable.data.id === templateData.id && canvas.scene._id === templateScene && placeable.constructor.name === 'MeasuredTemplate') {
            console.log(`PF2e | Deleting MeasuredTemplate ${templateData.id} from Scene ${templateScene}`);

            const existingTemplate = new MeasuredTemplate(templateData, templateScene);
            existingTemplate.delete(templateScene);
          }
        }
      }
    }

    // data to pull in dynamically
    let x;
    let y;

    let data = {};
    const gridWidth = canvas.grid.grid.w;

    if (areaType === 'emanation' || areaType === 'cone') {
      if (canvas.tokens.controlled.length > 1) {
        ui.notifications.info('Please select a single target token');
      } else if (canvas.tokens.controlled.length === 0) {
        ui.notifications.info('Please select a target token');
      } else {
        const t = canvas.tokens.controlled[0];
        let { rotation } = t.data;
        const { width } = t.data;

        x = t.data.x;
        y = t.data.y;

        // Cone placement logic
        if (tool === 'cone') {
          if (rotation < 0) rotation = 360 + rotation;
          if (rotation < 35) {
            x += (gridWidth / 2);
            y += (gridWidth);
          } else if (rotation < 55) {
            y += (gridWidth);
          } else if (rotation < 125) {
            y += (gridWidth / 2);
          } else if (rotation < 145) {
            // y = y;
          } else if (rotation < 215) {
            x += (gridWidth / 2);
          } else if (rotation < 235) {
            x += (gridWidth);
          } else if (rotation < 305) {
            x += (gridWidth);
            y += (gridWidth / 2);
          } else if (rotation < 325) {
            x += (gridWidth);
            y += (gridWidth);
          } else {
            x += (gridWidth / 2);
            y += (gridWidth);
          }
          rotation += 90;

          data = {
            t: tool, x, y, distance: areaSize, direction: rotation, fillColor: game.user.data.color || '#FF0000',
          };
        } else if (tool === 'rect') {
          x -= (gridWidth * (areaSize / 5));
          y -= (gridWidth * (areaSize / 5));
          rotation = 45;

          const rectSide = areaSize + (width * 5) + areaSize;
          const distance = Math.sqrt(rectSide ** 2 + rectSide ** 2);
          data = {
            t: tool, x, y, distance, direction: rotation, fillColor: game.user.data.color || '#FF0000',
          };
        }

        // Create the template
        MeasuredTemplate.create(canvas.scene._id, data).then((results) => {
          templateData = results.data;

          // Save MeasuredTemplate information to actor flags
          this.actor.setFlag('pf2e', 'areaEffectId', templateData);
          this.actor.setFlag('pf2e', 'areaEffectScene', canvas.scene._id);
        });
      }
    }
  }

  /**
   * Always submit on a form field change. Added because tabbing between fields
   * wasn't working.
   */
  _onChangeInput(event) {
    this._onSubmit(event);
  }
}

export default ActorSheetPF2e;
