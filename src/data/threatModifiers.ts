import type { ThreatModifierId, ThreatModifierDefinition } from '../core/types';

export const THREAT_MODIFIERS: Record<ThreatModifierId, ThreatModifierDefinition> = {
  terminator_reinforcements: {
    id: 'terminator_reinforcements',
    name: 'TERMINATOR REINFORCEMENTS',
    description: '+25% enemy health across all machine units.',
    scrapBonusPercent: 15
  },
  plasma_overcharge: {
    id: 'plasma_overcharge',
    name: 'PLASMA OVERCHARGE',
    description: '+20% machine projectile and contact damage.',
    scrapBonusPercent: 15
  },
  relentless_pursuit: {
    id: 'relentless_pursuit',
    name: 'RELENTLESS PURSUIT',
    description: '+15% enemy movement and hunting speed.',
    scrapBonusPercent: 15
  },
  emp_damping: {
    id: 'emp_damping',
    name: 'EMP DAMPING FIELDS',
    description: '-15% player weapon cooldown recovery speed.',
    scrapBonusPercent: 15
  },
  supply_starvation: {
    id: 'supply_starvation',
    name: 'SUPPLY STARVATION',
    description: '-20% medical and salvage drop rates.',
    scrapBonusPercent: 15
  },
  jammed_frequency: {
    id: 'jammed_frequency',
    name: 'JAMMED FREQUENCY',
    description: 'Skynet telemetry jamming scrambles HUD threat sensors.',
    scrapBonusPercent: 15
  },
  scarcity_protocol: {
    id: 'scarcity_protocol',
    name: 'SCARCITY PROTOCOL',
    description: 'All purchased meta-upgrades operate at 50% effectiveness.',
    scrapBonusPercent: 15
  },
  hyperalloy_surge: {
    id: 'hyperalloy_surge',
    name: 'HYPERALLOY SURGE',
    description: '+30% elite machine spawn rate with dual affixes.',
    scrapBonusPercent: 15
  },
  no_second_chances: {
    id: 'no_second_chances',
    name: 'NO SECOND CHANCES',
    description: 'All revivals and defibrillators are offline. One life only.',
    scrapBonusPercent: 15
  },
  judgment_hour: {
    id: 'judgment_hour',
    name: 'JUDGMENT HOUR',
    description: 'Run duration compressed to 8 minutes with bi-minute boss sieges.',
    scrapBonusPercent: 15
  }
};

export function computeThreatScrapMultiplier(activeThreats: ThreatModifierId[]): number {
  return 1 + activeThreats.length * 0.15;
}
