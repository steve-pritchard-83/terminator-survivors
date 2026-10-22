import * as THREE from 'three';
import { disposeObject3D } from './dispose';
import { HKAerialMesh } from './meshes/HKAerialMesh';
import { HKTankMesh } from './meshes/HKTankMesh';
import { InfiltratorMesh } from './meshes/InfiltratorMesh';
import { T1000Mesh } from './meshes/T1000Mesh';
import { SkynetCoreMesh } from './meshes/SkynetCoreMesh';
import { T1MinigunMesh, MotoTerminatorMesh, PlasmaTurretMesh } from './meshes/NewEnemyMeshes';
import { createDogMesh, createReprogrammedT800Mesh } from './meshes/AllyMeshes';

/**
 * Compiles the shaders of everything that can appear mid-run before the run starts. A shader compiles the
 * first time something is drawn, and a boss's point light changes the light count, which recompiles every
 * material in the scene: on a phone either shows up as a freeze of a second or more in the middle of play.
 *
 * The scene is compiled with no extra lights, then with the Infiltrator's light, then with the Core's too,
 * so each light count the game can reach is ready.
 */
export async function prewarmShaders(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
  // Not compileAsync: it also polls hidden materials that are never compiled, and throws on them
  const compilePass = async (): Promise<void> => {
    renderer.compile(scene, camera);
    // Let a frame draw between passes so the title screen does not freeze
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };
  const holder = new THREE.Group();
  holder.position.set(0, -500, 0);
  scene.add(holder);
  const disposers: Array<() => void> = [];
  const add = (object: THREE.Object3D, dispose: () => void): void => {
    holder.add(object);
    disposers.push(dispose);
  };
  try {
    const tank = new HKTankMesh();
    const patrol = new HKAerialMesh(false);
    const leader = new HKAerialMesh(true);
    const t1 = new T1MinigunMesh();
    const moto = new MotoTerminatorMesh();
    const turret = new PlasmaTurretMesh();
    const t1000 = new T1000Mesh();
    const dog = createDogMesh();
    const ally = createReprogrammedT800Mesh(true);
    add(tank.group, () => tank.dispose());
    add(patrol.group, () => patrol.dispose());
    add(leader.group, () => leader.dispose());
    add(t1.group, () => t1.dispose());
    add(moto.group, () => moto.dispose());
    add(turret.group, () => turret.dispose());
    add(t1000.group, () => t1000.dispose());
    add(dog, () => disposeObject3D(dog));
    add(ally, () => disposeObject3D(ally));
    await compilePass();

    // Boss lights: one extra point light, then two
    const infiltrator = new InfiltratorMesh();
    add(infiltrator.group, () => infiltrator.dispose());
    await compilePass();
    const core = new SkynetCoreMesh();
    add(core.group, () => core.dispose());
    await compilePass();
  } catch {
    // Warming up is an optimisation only; shaders then compile on first use as before
  } finally {
    scene.remove(holder);
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // already disposed
      }
    }
  }
}
