import { describe, it, expect, beforeEach } from 'vitest';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';

describe('P4-04 Enemy death debris', () => {
  let particles: ParticleSystem;
  let runState: RunState;
  let grid: SpatialHashGrid;
  let audio: AudioEngine;
  let endoBatch: EndoskeletonBatch;
  let enemySystem: EnemySystem;

  beforeEach(() => {
    particles = new ParticleSystem();
    runState = new RunState();
    runState.initRun('reese_2029', {});
    grid = new SpatialHashGrid(4.0);
    audio = new AudioEngine();
    endoBatch = new EndoskeletonBatch(32);
    enemySystem = new EnemySystem(runState, grid, audio, particles, endoBatch);
  });

  describe('Debris spawning and visual properties', () => {
    it('spawns 3 to 6 chunks by default when count is omitted', () => {
      particles.spawnEnemyDebris(10, 0.5, 20);
      const count = particles.getDebrisCount();
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(6);
    });

    it('spawns exact number of chunks when count is specified', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 5);
      expect(particles.getDebrisCount()).toBe(5);
    });

    it('guarantees at least one skull chunk with red eye optics', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 4);
      const chunks = particles.activeDebris;
      const skull = chunks.find((c) => c.type === 'skull');
      expect(skull).toBeDefined();
      expect(skull!.hasRedEye).toBe(true);
      expect(skull!.eyeMesh).toBeDefined();
      expect(skull!.eyeMat).toBeDefined();
      expect(skull!.eyeMat!.color.getHex()).toBe(0xff1111);
    });

    it('styles all debris chunks with chrome metallic material', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 4);
      for (const chunk of particles.activeDebris) {
        expect(chunk.coreMat.metalness).toBeGreaterThanOrEqual(0.8);
        expect(chunk.coreMat.vertexColors).toBe(true);
        expect(chunk.coreMat.transparent).toBe(true);
        expect(chunk.group.visible).toBe(true);
      }
    });
  });

  describe('Physics bounce and settling', () => {
    it('initializes chunks with upward pop velocity and tumbling angular velocity', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 1);
      const chunk = particles.activeDebris[0];
      expect(chunk.vy).toBeGreaterThan(2.0);
      expect(chunk.y).toBeCloseTo(0.5, 1);
      expect(chunk.vRotX !== 0 || chunk.vRotY !== 0 || chunk.vRotZ !== 0).toBe(true);
    });

    it('integrates gravity and bounces when reaching ground level', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 1);
      const chunk = particles.activeDebris[0];
      chunk.vy = -3.0; // Force falling downward
      chunk.y = 0.15;

      // Update by dt = 0.05s -> y drops below ground level 0.08
      particles.update(0.05);

      expect(chunk.y).toBe(0.08);
      // Velocity should have bounced upward (negative becomes positive) with restitution
      expect(chunk.vy).toBeGreaterThan(0);
    });

    it('settles completely once vertical bounce velocity falls below 0.4', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 1);
      const chunk = particles.activeDebris[0];
      chunk.vy = -0.3; // Low speed impact
      chunk.y = 0.09;
      chunk.vx = 1.0;
      chunk.vz = 1.0;
      chunk.vRotX = 2.0;

      particles.update(0.02);

      expect(chunk.y).toBe(0.08);
      expect(chunk.vy).toBe(0);
      expect(chunk.vx).toBe(0);
      expect(chunk.vz).toBe(0);
      expect(chunk.vRotX).toBe(0);
    });
  });

  describe('Red eye power-down flicker and fade', () => {
    it('flickers red eye optic during first 0.7s then turns off completely', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 1);
      const skull = particles.activeDebris[0];
      expect(skull.hasRedEye).toBe(true);

      // Advance by 0.1s: still in flicker window (< 0.7s)
      particles.update(0.1);
      expect(skull.life).toBeCloseTo(0.1, 2);

      // Advance past 0.7s: eye shuts off completely
      particles.update(0.65);
      expect(skull.life).toBeGreaterThan(0.7);
      expect(skull.eyeMat!.opacity).toBe(0);
      expect(skull.eyeMesh!.visible).toBe(false);
    });

    it('fades out chrome material after 3.0s and expires at 4.0s', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 1);
      const chunk = particles.activeDebris[0];

      // At 2.0s, opacity is full (1.0)
      particles.update(2.0);
      expect(chunk.coreMat.opacity).toBe(1.0);

      // At 3.5s, opacity is partially faded
      particles.update(1.5);
      expect(chunk.coreMat.opacity).toBeCloseTo(0.5, 1);

      // At 4.05s, chunk expires and is removed from active debris
      particles.update(0.55);
      expect(particles.getDebrisCount()).toBe(0);
    });
  });

  describe('Debris cap and pooling', () => {
    it('caps total debris at 300, recycling oldest chunks when exceeded', () => {
      // Spawn 70 calls of 4 chunks = 280 chunks
      for (let i = 0; i < 70; i++) {
        particles.spawnEnemyDebris(i, 0.5, 0, 4);
      }
      expect(particles.getDebrisCount()).toBe(280);

      // Spawn 10 more calls of 4 chunks = 40 chunks -> would be 320, must cap at 300
      for (let i = 0; i < 10; i++) {
        particles.spawnEnemyDebris(i, 0.5, 0, 4);
      }
      expect(particles.getDebrisCount()).toBe(300);

      // Spawn 50 more chunks
      particles.spawnEnemyDebris(100, 0.5, 100, 50);
      expect(particles.getDebrisCount()).toBe(300);
    });

    it('clear() returns all active debris to the pool and hides meshes', () => {
      particles.spawnEnemyDebris(0, 0.5, 0, 6);
      expect(particles.getDebrisCount()).toBe(6);

      particles.clear();
      expect(particles.getDebrisCount()).toBe(0);
    });
  });

  describe('EnemySystem integration', () => {
    it('spawns debris on enemy death', () => {
      const enemy = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5);
      enemy.hp = 0;

      expect(particles.getDebrisCount()).toBe(0);
      enemySystem.update(0.016, 1.0);

      expect(particles.getDebrisCount()).toBeGreaterThanOrEqual(3);
      expect(enemySystem.activeEnemies.length).toBe(0);
    });

    it('spawns 8 debris chunks on boss death', () => {
      const boss = enemySystem.spawnEnemy('t800_endoskeleton', 5, 5);
      boss.isBoss = true;
      boss.hp = 0;

      expect(particles.getDebrisCount()).toBe(0);
      enemySystem.update(0.016, 1.0);

      expect(particles.getDebrisCount()).toBe(8);
    });
  });
});
