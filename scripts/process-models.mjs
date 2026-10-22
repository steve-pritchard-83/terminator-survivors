// Dev tool: turns the raw downloaded models into the game-ready files in public/models.
//   node scripts/process-models.mjs [rawDir] [onlyOutputName]
// rawDir defaults to ../TerminatorSurvivors_models (the raw files are kept outside the repo).
// Per model it can keep or drop meshes, strip a scanned ground patch, retint materials, merge
// pieces, simplify to a triangle budget, and re-encode textures as WebP at 1024 px. Every model
// also gets a phone variant (name.m.glb: 512 px textures, optionally fewer triangles).
// Sizing, posing and orientation are applied at load time (src/graphics/ModelLibrary.ts).
import path from 'node:path';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  clearNodeTransform,
  compactPrimitive,
  dedup,
  flatten,
  join,
  metalRough,
  prune,
  simplify,
  textureCompress,
  weld
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const rawDir = path.resolve(process.argv[2] ?? '../TerminatorSurvivors_models');
const only = process.argv[3];
const outDir = path.resolve('public/models');
fs.mkdirSync(outDir, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function countTris(doc) {
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  }
  return tris;
}

/** Removes triangles whose vertices all sit within `height` of the lowest point (a scanned ground patch). */
function stripGround(doc, height) {
  let minY = Infinity;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) minY = Math.min(minY, p.getAttribute('POSITION').getMin([])[1]);
  }
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const idx = p.getIndices();
      if (!idx) continue;
      const keep = [];
      const v = [];
      for (let t = 0; t < idx.getCount(); t += 3) {
        let low = 0;
        for (let k = 0; k < 3; k++) if (pos.getElement(idx.getScalar(t + k), v)[1] < minY + height) low++;
        if (low < 3) keep.push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2));
      }
      idx.setArray(new Uint32Array(keep));
    }
  }
}

/**
 * Turns a hilly scanned terrain tile into a flat one the game can walk on: drops triangles with
 * stray vertices outside the ground's footprint, subtracts the smoothed ground height from every
 * vertex (so props keep their height above the ground), and centres the tile on the origin.
 */
function flattenTerrain(doc, groundMeshName) {
  const meshes = doc.getRoot().listMeshes();
  const groundPrim = meshes.find((m) => m.getName() === groundMeshName).listPrimitives()[0];
  const gp = groundPrim.getAttribute('POSITION');
  const [minX, minY, minZ] = gp.getMin([]);
  const [maxX, , maxZ] = gp.getMax([]);
  const cells = 48;
  const sum = new Float64Array(cells * cells);
  const count = new Float64Array(cells * cells);
  const cellOf = (x, z) => [
    Math.min(cells - 1, Math.max(0, Math.floor(((x - minX) / (maxX - minX)) * cells))),
    Math.min(cells - 1, Math.max(0, Math.floor(((z - minZ) / (maxZ - minZ)) * cells)))
  ];
  const v = [];
  for (let i = 0; i < gp.getCount(); i++) {
    gp.getElement(i, v);
    const [cx, cz] = cellOf(v[0], v[2]);
    sum[cz * cells + cx] += v[1];
    count[cz * cells + cx]++;
  }
  // Average per cell, fill gaps from neighbours, then blur twice so only the hills are removed
  let h = new Float64Array(cells * cells);
  for (let i = 0; i < h.length; i++) h[i] = count[i] ? sum[i] / count[i] : NaN;
  for (let pass = 0; pass < cells && h.some(Number.isNaN); pass++) {
    const next = h.slice();
    for (let z = 0; z < cells; z++) for (let x = 0; x < cells; x++) {
      if (!Number.isNaN(h[z * cells + x])) continue;
      let s = 0;
      let n = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const val = h[(z + dz) * cells + (x + dx)];
        if (x + dx >= 0 && x + dx < cells && z + dz >= 0 && z + dz < cells && !Number.isNaN(val)) { s += val; n++; }
      }
      if (n) next[z * cells + x] = s / n;
    }
    h = next;
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float64Array(h.length);
    for (let z = 0; z < cells; z++) for (let x = 0; x < cells; x++) {
      let s = 0;
      let n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const zz = z + dz;
        if (xx >= 0 && xx < cells && zz >= 0 && zz < cells) { s += h[zz * cells + xx]; n++; }
      }
      next[z * cells + x] = s / n;
    }
    h = next;
  }
  const heightAt = (x, z) => {
    const fx = Math.min(cells - 1.001, Math.max(0, ((x - minX) / (maxX - minX)) * cells - 0.5));
    const fz = Math.min(cells - 1.001, Math.max(0, ((z - minZ) / (maxZ - minZ)) * cells - 0.5));
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const at = (xx, zz) => h[zz * cells + xx];
    return (at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx) * (1 - tz) + (at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx) * tz;
  };
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const inside = (p) => p[0] > minX - 1 && p[0] < maxX + 1 && p[2] > minZ - 1 && p[2] < maxZ + 1 && p[1] > minY - 1;
  for (const m of meshes) {
    for (const prim of m.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (idx) {
        const keep = [];
        for (let t = 0; t < idx.getCount(); t += 3) {
          let ok = true;
          for (let k = 0; k < 3; k++) if (!inside(pos.getElement(idx.getScalar(t + k), v))) ok = false;
          if (ok) keep.push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2));
        }
        idx.setArray(new Uint32Array(keep));
        compactPrimitive(prim);
      }
      const p = prim.getAttribute('POSITION');
      // The ground's border skirt dips well below the surface; flattened, it would cut a trench between tiles
      const isGround = prim === groundPrim;
      for (let i = 0; i < p.getCount(); i++) {
        p.getElement(i, v);
        const y = v[1] - heightAt(v[0], v[2]);
        p.setElement(i, [v[0] - cx, isGround ? Math.min(0.4, Math.max(-0.3, y)) : y, v[2] - cz]);
      }
    }
  }
}

/**
 * Topology-blind reduction for models made of thousands of small separate parts (bolts, links,
 * panels), which the regular simplifier must preserve. Fine for things that are small on screen.
 */
function sloppyTo(doc, targetTris) {
  const ratio = targetTris / countTris(doc);
  if (ratio >= 1) return;
  for (const m of doc.getRoot().listMeshes()) {
    for (const prim of m.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      if (!idx || !pos) continue;
      const indices = new Uint32Array(idx.getArray());
      const positions = new Float32Array(pos.getArray());
      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target, 1);
      idx.setArray(new Uint32Array(out));
      compactPrimitive(prim);
    }
  }
}

/**
 * @param {string} source raw file
 * @param {string} outName output file
 * @param {object} opts
 *   keep(meshName) => boolean   which meshes to keep (default all)
 *   tris                        triangle budget after simplification
 *   error                       simplification error allowance (fraction of the model's size)
 *   ground                      strip a ground patch this thick (source units)
 *   retint(material)            adjust material colours
 *   mobileTris                  triangle budget for the phone variant (default: same as desktop)
 *   prepare(doc)                custom clean-up after transforms are baked (world space, y up)
 */
async function processModel(source, outName, opts = {}) {
  if (only && only !== outName) return;
  const doc = await io.read(path.join(rawDir, source));
  if (opts.keep) {
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (mesh && !opts.keep(mesh.getName())) node.dispose();
    }
  }
  const rigged = doc.getRoot().listSkins().length > 0;
  if (!rigged) {
    // Bake node transforms into the vertices so filtering happens in world space (y up)
    await doc.transform(flatten());
    for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  }
  if (opts.ground) stripGround(doc, opts.ground);
  if (opts.prepare) opts.prepare(doc);
  if (opts.retint) for (const m of doc.getRoot().listMaterials()) opts.retint(m);

  await MeshoptSimplifier.ready;
  const steps = [metalRough(), prune(), dedup()];
  // Rigged models keep their node hierarchy; static ones are merged into as few pieces as possible
  if (!rigged) steps.push(join({ keepNamed: false }));
  steps.push(weld());
  await doc.transform(...steps);
  const before = countTris(doc);
  if (opts.tris && before > opts.tris) {
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: opts.tris / before, error: opts.error ?? 0.02 })
    );
    // Still far over budget: the model is mostly small detached parts
    if (countTris(doc) > opts.tris * 1.5) sloppyTo(doc, opts.tris);
  }
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 })
  );
  const out = path.join(outDir, outName);
  await io.write(out, doc);
  console.log(
    `${outName}: ${Math.round(before)} -> ${Math.round(countTris(doc))} tris, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`
  );

  // Phone variant: smaller textures (about a quarter of the GPU memory), optionally fewer triangles
  const mobile = await io.read(out);
  const desktopTris = countTris(mobile);
  if (opts.mobileTris && desktopTris > opts.mobileTris) {
    await mobile.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: opts.mobileTris / desktopTris, error: 0.02 })
    );
  }
  await mobile.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 })
  );
  const mobileOut = out.replace(/\.glb$/, '.m.glb');
  await io.write(mobileOut, mobile);
  console.log(`  phone: ${Math.round(countTris(mobile))} tris, ${(fs.statSync(mobileOut).size / 1024).toFixed(0)} KB`);
}

// The two HKs ship in one file
await processModel('hunter_killer_tank_and_aerial.glb', 'hk_tank.glb', { keep: (name) => name === 'Object_0' });
await processModel('hunter_killer_tank_and_aerial.glb', 'hk_aerial.glb', {
  keep: (name) => name === 'Object_1',
  mobileTris: 11000
});

// Rigged A-pose characters; posed (and split or animated) at load time
await processModel('t_800_low_poly_portp3d.glb', 't800.glb', { tris: 10500, mobileTris: 3500 });
await processModel('Infiltrator.glb', 'infiltrator.glb');
await processModel('player.glb', 'player.glb');

// T-1000: drop the checkerboard floor (ten flat tiles) and the liquid-metal splash at its feet
await processModel('t-1000.glb', 't1000.glb', {
  keep: (name) => !/^Object_[0-9]$/.test(name),
  ground: 60,
  tris: 24000,
  error: 0.01,
  mobileTris: 12000
});

// Bosses and vehicles
await processModel('skynet_core.glb', 'skynet_core.glb');
await processModel('T1_Tracked.glb', 't1_tracked.glb', {
  tris: 18000,
  mobileTris: 8000,
  error: 0.02,
  // Army green and bright cyan read as a toy here: gunmetal hull, Skynet-red lights
  retint(m) {
    const [r, g, b] = m.getBaseColorFactor();
    const glow = Math.max(r, g, b) > 0.7 && Math.max(r, g, b) - Math.min(r, g, b) > 0.4;
    if (glow) {
      m.setBaseColorFactor([0.9, 0.05, 0.03, 1]);
      m.setEmissiveFactor([1, 0.08, 0.04]);
    } else {
      const grey = Math.min(0.42, (r + g + b) / 3 + 0.04);
      m.setBaseColorFactor([grey * 0.95, grey, grey * 1.05, 1]);
      m.setMetallicFactor(0.85);
      m.setRoughnessFactor(0.42);
    }
  }
});

// Instanced in large numbers: kept light
await processModel('burnt_car.glb', 'burnt_car.glb', { ground: 0.2, tris: 12000, error: 0.02, mobileTris: 6000 });
await processModel('plasma_rifle.glb', 'plasma_rifle.glb');

// T-600: only the T-pose body is kept (it carries the shared plasma rifle)
await processModel('t-600.glb', 't600.glb', { keep: (name) => name === 'Object_1' });

// Second batch of enemies, allies and pickups
await processModel('moto.glb', 'moto.glb', { tris: 9000, mobileTris: 4500 });
await processModel('turret.glb', 'turret.glb');
await processModel('k9.glb', 'k9.glb', { tris: 4000, mobileTris: 2000 });
await processModel('seeker.glb', 'seeker.glb', { tris: 2500, mobileTris: 1200 });
await processModel('xp.glb', 'xp.glb');

// Ash and bone field: fog shells dropped, hills baked flat. The bones are drawn as many small instanced
// patches (so each copy stays light); the dirt's textures become the ground's fine detail.
await processModel('apocalyptic_ground.glb', 'ground.glb', {
  keep: (name) => !/Fog/.test(name),
  prepare: (doc) => flattenTerrain(doc, 'BonesAndGround_Ground_0'),
  tris: 12000,
  error: 0.01,
  mobileTris: 4500
});
