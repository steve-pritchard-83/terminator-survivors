import type * as THREE from 'three';
import type { ActiveEnemy } from '../../core/types';
import type { WeaponPattern, WeaponFireContext } from './WeaponPattern';
import { createDogMesh } from '../../graphics/meshes/AllyMeshes';
import { ALL_WEAPONS } from '../../data/weapons';
import { K9_BITE_ARMOR_STRIP } from '../../data/balance';
import { disposeObject3D } from '../../graphics/dispose';

interface ActiveDog {
  mesh: THREE.Group;
  x: number;
  z: number;
  biteCooldown: number;
  trotPhase: number;
}

export class DogUnit implements WeaponPattern {
  public dogs: ActiveDog[] = [];

  public fire(): void {
    // Autonomous entity; continuous movement & attacks handled in update
  }

  public update(
    dt: number,
    px: number,
    pz: number,
    _enemies: ActiveEnemy[],
    ctx: WeaponFireContext
  ): void {
    const k9Slot = ctx.runState.weapons.get('resistance_k9');
    const packSlot = ctx.runState.weapons.get('k9_pack');
    const activeSlot = packSlot || k9Slot;

    if (!activeSlot) {
      this.clear(ctx.group);
      return;
    }

    const isPack = !!packSlot;
    const def = ALL_WEAPONS[activeSlot.id];
    const stats = def?.levels[Math.min(activeSlot.level - 1, def.levels.length - 1)] ?? {
      damage: 35,
      speed: 10.5,
      amount: 1,
      area: 1.0,
      cooldown: 0.5,
      duration: 1.0,
      pierce: 1,
      level: 1,
      description: ''
    };

    const targetCount = isPack ? 3 : (stats.amount >= 2 ? 2 : 1);

    // Sync active dog meshes
    while (this.dogs.length < targetCount) {
      const mesh = createDogMesh();
      const angle = (this.dogs.length / targetCount) * Math.PI * 2;
      const x = px + Math.cos(angle) * 2;
      const z = pz + Math.sin(angle) * 2;
      mesh.position.set(x, 0, z);
      ctx.group.add(mesh);
      this.dogs.push({
        mesh,
        x,
        z,
        biteCooldown: 0,
        trotPhase: ctx.rng.next() * Math.PI * 2
      });
    }
    while (this.dogs.length > targetCount) {
      const removed = this.dogs.pop()!;
      ctx.group.remove(removed.mesh);
      disposeObject3D(removed.mesh);
    }

    const might = ctx.runState.computedStats.mightMultiplier;
    const dmg = Math.round(stats.damage * might);
    const speed = stats.speed;

    for (let i = 0; i < this.dogs.length; i++) {
      const dog = this.dogs[i];
      dog.biteCooldown = Math.max(0, dog.biteCooldown - dt);

      const distToPlayer = Math.hypot(dog.x - px, dog.z - pz);

      // Determine target destination
      let targetX = px;
      let targetZ = pz;
      let targetEnemy: ActiveEnemy | null = null;

      if (distToPlayer > 10.0) {
        // Return to Kyle Reese if too far
        const angle = (i / this.dogs.length) * Math.PI * 2;
        targetX = px + Math.cos(angle) * 2.5;
        targetZ = pz + Math.sin(angle) * 2.5;
      } else {
        // Find nearest machine, prioritizing Infiltrators and T-1000
        const queryRange = 12.0;
        const candidates = ctx.grid.queryRadius(dog.x, dog.z, queryRange, ctx.scratch.droneHit);
        let bestScore = Infinity;

        for (let c = 0; c < candidates.length; c++) {
          const entity = candidates[c];
          if (entity.type !== 'enemy') continue;
          const enemy = entity as ActiveEnemy;
          const edist = Math.hypot(enemy.x - dog.x, enemy.z - dog.z);

          // Priority score: lower is better; prioritize Infiltrators and T-1000
          let priority = edist;
          if (enemy.archetype === 'infiltrator_csm101' || enemy.archetype === 't1000_prototype') {
            priority -= 8.0;
          }

          if (priority < bestScore) {
            bestScore = priority;
            targetEnemy = enemy;
            targetX = enemy.x;
            targetZ = enemy.z;
          }
        }

        if (!targetEnemy) {
          // Patrol near player
          const patrolAngle = (ctx.runState.timeSeconds * 2) + (i * (Math.PI * 2 / this.dogs.length));
          targetX = px + Math.cos(patrolAngle) * 3.2;
          targetZ = pz + Math.sin(patrolAngle) * 3.2;
        }
      }

      // Move toward target
      const dx = targetX - dog.x;
      const dz = targetZ - dog.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.4) {
        const step = Math.min(dist, speed * dt);
        dog.x += (dx / dist) * step;
        dog.z += (dz / dist) * step;
        dog.mesh.rotation.y = Math.atan2(dx, dz);

        // A gallop is a bound and a rocking pitch
        dog.trotPhase += dt * 14.0;
        const body = dog.mesh.getObjectByName('body');
        if (body) {
          body.position.y = Math.abs(Math.sin(dog.trotPhase)) * 0.09;
          body.rotation.x = Math.sin(dog.trotPhase) * 0.1;
        }
      }

      dog.mesh.position.set(dog.x, 0, dog.z);

      // Bite attack when near enemy
      if (targetEnemy && dist < 1.4 && dog.biteCooldown <= 0) {
        dog.biteCooldown = isPack ? 0.32 : 0.52;
        const hitDir = { x: targetEnemy.x - dog.x, z: targetEnemy.z - dog.z };
        ctx.applyDamageToTarget(targetEnemy, dmg, def.knockback, hitDir, def.id);
        ctx.audio.playEndoHit();
        ctx.particles.spawnPlasmaImpact(targetEnemy.x, 0.4, targetEnemy.z);

        // K-9 detection: reveals T-1000 and strips Infiltrator stealth/armor
        if (
          targetEnemy.archetype === 'infiltrator_csm101' ||
          targetEnemy.archetype === 't1000_prototype'
        ) {
          targetEnemy.armorStripMultiplier = Math.min(targetEnemy.armorStripMultiplier, K9_BITE_ARMOR_STRIP);
        }
      }
    }
  }

  public clear(group: THREE.Group): void {
    for (const d of this.dogs) {
      group.remove(d.mesh);
      disposeObject3D(d.mesh);
    }
    this.dogs.length = 0;
  }
}
