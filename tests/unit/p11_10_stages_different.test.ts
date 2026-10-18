import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages';

describe('P11-10 Stages are actually different (Unit)', () => {
  it('any two stages produce different boss orders in their wave timelines', () => {
    const wastelandTimeline = STAGES.la_2029_wasteland.waveTimeline;
    const cyberdyneTimeline = STAGES.cyberdyne_factory.waveTimeline;
    const techNoirTimeline = STAGES.tech_noir_1984.waveTimeline;
    const skynetCentralTimeline = STAGES.skynet_central_tde.waveTimeline;
    const bunkerTimeline = STAGES.century_city_bunker.waveTimeline;

    // Minute 2 boss comparison
    const wastelandBossM2 = wastelandTimeline[2]?.boss; // infiltrator_csm101
    const cyberdyneBossM2 = cyberdyneTimeline[2]?.boss; // t1000_prototype
    const skynetBossM2 = skynetCentralTimeline[2]?.boss; // hk_aerial_squadron_leader
    const bunkerBossM2 = bunkerTimeline[2]?.boss; // hk_tank_goliath

    expect(wastelandBossM2).not.toBe(cyberdyneBossM2);
    expect(cyberdyneBossM2).not.toBe(skynetBossM2);
    expect(skynetBossM2).not.toBe(bunkerBossM2);

    // Minute 3 boss comparison (Tech Noir has early boss at M3)
    const techNoirBossM3 = techNoirTimeline[3]?.boss;
    const wastelandBossM3 = wastelandTimeline[3]?.boss;
    expect(techNoirBossM3).toBe('t600_rusted');
    expect(wastelandBossM3).toBeUndefined();

    // Check pool weights differ
    const wastelandM5Pool = wastelandTimeline[5].pool;
    const cyberdyneM5Pool = cyberdyneTimeline[5].pool;
    const t1Wasteland = wastelandM5Pool.find((p) => p.archetype === 't1_minigun_tracked')?.weight ?? 0;
    const t1Cyberdyne = cyberdyneM5Pool.find((p) => p.archetype === 't1_minigun_tracked')?.weight ?? 0;
    expect(t1Cyberdyne).toBeGreaterThan(t1Wasteland);
  });
});
