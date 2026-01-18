/**
 * Scene Index - Export all available scenes
 */

export { BaseScene } from './BaseScene.js';
export { CosmicOrbs } from './CosmicOrbs.js';
export { CrystalGrid } from './CrystalGrid.js';
export { ForestValley } from './ForestValley.js';

// Available scenes list
export const SCENES = [
    { id: 'cosmic-orbs', Scene: () => import('./CosmicOrbs.js').then(m => new m.CosmicOrbs()) },
    { id: 'crystal-grid', Scene: () => import('./CrystalGrid.js').then(m => new m.CrystalGrid()) },
    { id: 'forest-valley', Scene: () => import('./ForestValley.js').then(m => new m.ForestValley()) },
];
