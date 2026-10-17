import { describe, it, expect, vi } from 'vitest';
import {
  createEnvironment,
  CyberdyneEnvironment,
  TechNoirEnvironment,
  SkynetCentralEnvironment,
  BunkerEnvironment
} from '../../src/graphics/environments';
import { InteractiveEnvironmentSystem } from '../../src/systems/InteractiveEnvironmentSystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import * as THREE from 'three';

describe('P6-02: New Stages Environments and Mechanics', () => {
  it('instantiates dedicated environment classes for each stage', () => {
    const cyberdyne = createEnvironment('cyberdyne_factory');
    expect(cyberdyne instanceof CyberdyneEnvironment).toBe(true);

    const techNoir = createEnvironment('tech_noir_1984');
    expect(techNoir instanceof TechNoirEnvironment).toBe(true);

    const skynet = createEnvironment('skynet_central_tde');
    expect(skynet instanceof SkynetCentralEnvironment).toBe(true);

    const bunker = createEnvironment('century_city_bunker');
    expect(bunker instanceof BunkerEnvironment).toBe(true);

    const wasteland = createEnvironment('la_2029_wasteland');
    expect(wasteland).toBeDefined();

    cyberdyne.dispose();
    techNoir.dispose();
    skynet.dispose();
    bunker.dispose();
    wasteland.dispose();
  });

  describe('Cyberdyne Factory Mechanics', () => {
    it('applies conveyor belt velocity within conveyor zones and returns null outside', () => {
      const env = new CyberdyneEnvironment();
      // (-15, 0) is inside the first vertical conveyor (vx: 0, vz: 3.5)
      const onBelt = env.getConveyorVelocity(-15, 0);
      expect(onBelt).toBeDefined();
      expect(onBelt?.vz).toBe(3.5);

      // (0, 0) is outside conveyors
      const offBelt = env.getConveyorVelocity(0, 0);
      expect(offBelt).toBeNull();
      env.dispose();
    });

    it('applies molten steel hazard damage within vats', () => {
      const env = new CyberdyneEnvironment();
      // Vat at (-22, -22) with radius 4.5
      const vatDmgPlayer = env.getHazardDamage(-22, -22, 1.0, true);
      expect(vatDmgPlayer).toBeGreaterThan(0);

      const vatDmgEnemy = env.getHazardDamage(-22, -22, 1.0, false);
      expect(vatDmgEnemy).toBeGreaterThan(vatDmgPlayer);

      // (0, 0) is safe
      const safeDmg = env.getHazardDamage(0, 0, 1.0, true);
      expect(safeDmg).toBe(0);
      env.dispose();
    });
  });

  describe('Tech Noir 1984 Mechanics', () => {
    it('initializes street grid, police cruisers, and obstacles', () => {
      const env = new TechNoirEnvironment();
      expect(env.obstacleColliders.length).toBeGreaterThan(0);
      env.update(0, 0, 0.05);
      env.dispose();
      expect(env.obstacleColliders.length).toBe(0);
    });
  });

  describe('Skynet Central TDE Mechanics', () => {
    it('toggles laser grid hazard and applies damage when active', () => {
      const env = new SkynetCentralEnvironment();
      expect(env.obstacleColliders.length).toBeGreaterThan(0);

      // Initial cycle: laser active (at cycle 0 < 3.5s)
      env.update(0, 0, 0.1);
      // Crossing x barrier at x=16, z=0
      const activeDmg = env.getHazardDamage(16, 0, 1.0, true);
      expect(activeDmg).toBeGreaterThan(0);

      // Safe in the center
      const centerDmg = env.getHazardDamage(0, 0, 1.0, true);
      expect(centerDmg).toBe(0);

      // Fast forward past active phase (cycle at 4.5s -> inactive)
      env.update(0, 0, 4.4);
      const inactiveDmg = env.getHazardDamage(16, 0, 1.0, true);
      expect(inactiveDmg).toBe(0);

      env.dispose();
    });
  });

  describe('Century City Bunker Mechanics', () => {
    it('tracks bunker door health and breaches upon reaching 0 HP', () => {
      const env = new BunkerEnvironment();
      const initialHp = env.getBunkerHealth();
      expect(initialHp).toEqual({ current: 1500, max: 1500 });

      // Damage bunker
      env.damageBunker(500);
      expect(env.getBunkerHealth()?.current).toBe(1000);

      // Breach bunker
      env.damageBunker(1200);
      expect(env.getBunkerHealth()?.current).toBe(0);

      env.dispose();
    });
  });

  describe('InteractiveEnvironmentSystem integration', () => {
    it('moves player along conveyor belt during interactiveEnv update', () => {
      const runState = new RunState();
      runState.playerPos = { x: -15, z: 0 }; // On conveyor
      const grid = new SpatialHashGrid(4.0);
      const scene = new THREE.Scene();
      const mockAudio = { playSearchlightAlert: vi.fn(), playVaultJackpot: vi.fn() } as any;
      const mockParticles = { spawnExplosion: vi.fn() } as any;
      const mockPickup = { spawnSupplyCrate: vi.fn() } as any;
      const mockEnemySys = { enemyProjectiles: [] } as any;

      const sys = new InteractiveEnvironmentSystem(
        runState,
        grid,
        scene,
        mockAudio,
        mockParticles,
        mockPickup,
        mockEnemySys
      );

      const cyberdyne = new CyberdyneEnvironment();
      // Tick update with cyberdyne environment
      sys.update(1.0, cyberdyne);

      // Player should have drifted along +z
      expect(runState.playerPos.z).toBeCloseTo(3.5);

      sys.dispose();
      cyberdyne.dispose();
    });
  });
});
