import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { KyleReeseMesh } from '../../src/graphics/meshes/KyleReeseMesh';
import { EndoskeletonBatch } from '../../src/graphics/meshes/EndoskeletonBatch';
import { HKAerialMesh } from '../../src/graphics/meshes/HKAerialMesh';
import { HKAerialBehaviour } from '../../src/systems/enemies/HKAerialBehaviour';
import { RunState } from '../../src/state/RunState';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { ParticleSystem } from '../../src/systems/ParticleSystem';
import { WeaponSystem } from '../../src/systems/WeaponSystem';
import type { ActiveEnemy } from '../../src/core/types';
import type { EnemyContext } from '../../src/systems/enemies/EnemyBehaviour';
import { globalRNG } from '../../src/core/RNG';

describe('P9-06 Character & enemy animation pass', () => {
  describe('Kyle Reese procedural animations', () => {
    let kyle: KyleReeseMesh;

    beforeEach(() => {
      kyle = new KyleReeseMesh();
    });

    it('triggers weapon recoil with intensity and recovers smoothly over time', () => {
      expect(kyle.recoil.offset).toBe(0);
      expect(kyle.recoil.pitch).toBe(0);

      kyle.triggerRecoil(1.5);
      expect(kyle.recoil.offset).toBeGreaterThan(0.1);
      expect(kyle.recoil.pitch).toBeLessThan(0);
      expect(kyle.weaponGroup.position.z).toBeLessThan(0.1);
      expect(kyle.weaponGroup.rotation.x).toBeLessThan(0);

      const initialOffset = kyle.recoil.offset;
      const initialPitch = kyle.recoil.pitch;
      kyle.updateAnimation(0.05, 0, 0, false);
      expect(kyle.recoil.offset).toBeLessThan(initialOffset);
      expect(kyle.recoil.pitch).toBeGreaterThan(initialPitch);

      // Fast forward to complete recovery
      for (let i = 0; i < 20; i++) {
        kyle.updateAnimation(0.05, 0, 0, false);
      }
      expect(kyle.recoil.offset).toBeCloseTo(0, 2);
      expect(kyle.recoil.pitch).toBeCloseTo(0, 2);
    });

    it('executes a dynamic combat roll during dash and recovers upright', () => {
      expect(kyle.torsoGroup.position.y).toBe(0.85);
      expect(kyle.torsoGroup.rotation.x).toBe(0);

      // Halfway into dash (0.15s of 0.3s roll duration)
      kyle.updateAnimation(0.15, 6.0, 0, true);
      expect(kyle.torsoGroup.position.y).toBeLessThan(0.85); // lower center of mass
      expect(kyle.torsoGroup.rotation.x).toBeGreaterThan(1.0); // rolling forward
      expect(kyle.leftLeg.rotation.x).toBe(-0.7); // tucked legs

      // End of dash
      kyle.updateAnimation(0.16, 6.0, 0, true);
      // Once dashing ceases, torso resets to upright height
      kyle.updateAnimation(0.016, 0, 0, false);
      expect(kyle.torsoGroup.position.y).toBe(0.85);
      expect(kyle.torsoGroup.rotation.x).toBe(0);
    });

    it('applies hip sway and torso twist during walk cycle', () => {
      kyle.updateAnimation(0.1, 4.0, 0, false);
      expect(kyle.torsoGroup.rotation.z).not.toBe(0); // hip sway
      expect(kyle.torsoGroup.rotation.y).not.toBe(0); // shoulder twist
      expect(kyle.coatTails.rotation.x).toBeGreaterThan(0.4);
    });
  });

  describe('Weapon-specific recoil scaling', () => {
    it('applies different recoil intensities depending on fired weapon type', () => {
      const runState = new RunState();
      runState.initRun('reese_2029', {});
      const grid = new SpatialHashGrid();
      const audio = new AudioEngine();
      const particles = new ParticleSystem();
      const kyle = new KyleReeseMesh();
      const weaponSys = new WeaponSystem(runState, grid, audio, particles, kyle);

      // Trigger ithaca_37 shotgun (heavy recoil scale 1.8)
      runState.weapons.clear();
      runState.weapons.set('ithaca_37', { id: 'ithaca_37', level: 1, cooldownTimer: 0, evolved: false });
      weaponSys.update(0.016, [], 0);
      const shotgunRecoil = kyle.recoil.offset;
      expect(shotgunRecoil).toBeGreaterThan(0.15);

      // Reset and trigger m16_carbine (light rapid kick scale 0.5)
      for (let i = 0; i < 30; i++) kyle.updateAnimation(0.05, 0, 0, false);
      expect(kyle.recoil.offset).toBeCloseTo(0, 2);

      runState.weapons.clear();
      runState.weapons.set('m16_carbine', { id: 'm16_carbine', level: 1, cooldownTimer: 0, evolved: false });
      weaponSys.update(0.016, [], 0);
      const m16Recoil = kyle.recoil.offset;
      expect(m16Recoil).toBeGreaterThan(0);
      expect(m16Recoil).toBeLessThan(shotgunRecoil);
    });
  });

  function createMockEnemy(overrides: Partial<ActiveEnemy>): ActiveEnemy {
    return {
      type: 'enemy',
      id: 1,
      archetype: 't800_endoskeleton',
      x: 0,
      z: 0,
      hp: 100,
      maxHp: 100,
      speed: 1.0,
      radius: 0.5,
      damage: 10,
      isBoss: false,
      isFlying: false,
      xpValue: 10,
      slowTimer: 0,
      armorStripMultiplier: 1.0,
      attackCooldown: 0,
      hitFlashTimer: 0,
      ...overrides
    };
  }

  describe('Endoskeleton hit stagger', () => {
    it('applies backward pitch and physical displacement when hitFlashTimer is active', () => {
      const batch = new EndoskeletonBatch(10);
      const normalEnemy = createMockEnemy({
        id: 1,
        archetype: 't800_endoskeleton',
        x: 0,
        z: 10,
        hp: 100,
        maxHp: 100,
        hitFlashTimer: 0
      });

      const hitEnemy = createMockEnemy({
        id: 2,
        archetype: 't800_endoskeleton',
        x: 0,
        z: 10,
        hp: 80,
        maxHp: 100,
        hitFlashTimer: 0.15
      });

      // Player at (0, 20), facing angle is 0
      batch.updateBatch([normalEnemy, hitEnemy], 1.0, 0, 20);

      const matrixNormal = new THREE.Matrix4();
      const matrixHit = new THREE.Matrix4();
      batch.chassisInstancedMesh.getMatrixAt(0, matrixNormal);
      batch.chassisInstancedMesh.getMatrixAt(1, matrixHit);

      const posNormal = new THREE.Vector3();
      const posHit = new THREE.Vector3();
      const rotNormal = new THREE.Quaternion();
      const rotHit = new THREE.Quaternion();
      const scaleDummy = new THREE.Vector3();

      matrixNormal.decompose(posNormal, rotNormal, scaleDummy);
      matrixHit.decompose(posHit, rotHit, scaleDummy);

      // Hit enemy must be displaced backward from player and pitched back
      const eulerHit = new THREE.Euler().setFromQuaternion(rotHit);
      expect(eulerHit.x).toBeLessThan(0); // pitched back
      expect(posHit.y).toBeLessThan(posNormal.y); // impact dip
      expect(posHit.z).toBeLessThan(posNormal.z); // pushed back away from player (facing +Z, pushes -Z)
    });
  });

  describe('HK Aerial rotor and thruster tilt', () => {
    it('tilts thruster nacelles and banks the fuselage when moving laterally and forward', () => {
      const hk = new HKAerialMesh();
      expect(hk.group.rotation.x).toBe(0);
      expect(hk.group.rotation.z).toBe(0);

      // Update with forward velocity (facing 0, forward is +Z)
      hk.group.rotation.y = 0;
      hk.update(0, 0, 0, 0, 5.0, 0.1);
      expect(hk.currentPitch).toBeGreaterThan(0);
      expect(hk.group.rotation.x).toBeCloseTo(hk.currentPitch, 3);
      expect(hk.leftTurbine.rotation.x).toBeGreaterThan(0);

      // Update with lateral strafe velocity (vx > 0)
      hk.update(0, 0, 0, 4.0, 0, 0.1);
      expect(hk.currentRoll).toBeLessThan(0);
      expect(hk.group.rotation.z).toBeCloseTo(hk.currentRoll, 3);
      // Differential tilt on nacelles during bank
      expect(hk.leftTurbine.rotation.x).not.toBe(hk.rightTurbine.rotation.x);
    });

    it('HKAerialBehaviour calculates enemy velocity and feeds it to mesh tilt', () => {
      const behaviour = new HKAerialBehaviour();
      const sceneGroup = new THREE.Group();
      const runState = new RunState();
      runState.initRun('reese_2029', {});

      const ctx: EnemyContext = {
        runState,
        audio: new AudioEngine(),
        particles: new ParticleSystem(),
        group: sceneGroup,
        timeSeconds: 0,
        emit: () => {},
        applyPlayerDamage: () => {},
        spawnEnemyProjectile: () => {},
        rng: globalRNG
      };

      const enemy = createMockEnemy({
        id: 99,
        archetype: 'hk_aerial_patrol',
        x: 0,
        z: 20,
        hp: 200,
        maxHp: 200,
        speed: 3.0,
        radius: 1.5,
        attackCooldown: 0,
        hitFlashTimer: 0
      });

      behaviour.createVisual(enemy, ctx);

      // Tick 1
      behaviour.update(enemy, 0.05, ctx);

      // Enemy moves forward towards player at (0, 0)
      enemy.z = 18.0;
      behaviour.update(enemy, 0.05, ctx);

      // Check that state tracked prev positions
      expect(enemy.state?.prevX).toBe(0);
      expect(enemy.state?.prevZ).toBe(18.0);
    });
  });
});
