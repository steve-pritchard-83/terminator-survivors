import * as THREE from 'three';
import { disposeObject3D } from './dispose';
import { ProceduralTextures } from './ProceduralTextures';
import { PALETTE } from '../data/artDirection';

const beamVertex = `
  varying float vAlong;
  varying float vFacing;
  void main() {
    // uv.y runs 1 at the lamp to 0 at the far end of the beam
    vAlong = uv.y;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mvPosition.xyz)));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const beamFragment = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlong;
  varying float vFacing;
  void main() {
    // Brightest at the lamp, fading to nothing before the open far end (otherwise the end
    // shows as a darker ellipse where only the back wall is visible); soft at the silhouette edges
    float along = pow(vAlong, 1.6) * smoothstep(0.0, 0.3, vAlong);
    float core = pow(vFacing, 2.0);
    gl_FragColor = vec4(uColor * uOpacity * along * core, 1.0);
  }
`;

/** Hard white-blue HK searchlight: a haze beam plus a soft bright pool where it meets the ground. */
export class VolumetricSearchlight {
  public readonly group = new THREE.Group();
  private readonly beamMat: THREE.ShaderMaterial;
  private readonly poolMat: THREE.MeshBasicMaterial;
  private readonly pool: THREE.Mesh;
  private readonly normalColor = new THREE.Color(PALETTE.searchlight);
  private readonly alertColor = new THREE.Color(0xff2a1a);

  constructor(length = 10, radius = 2.6) {
    // Non-zero top radius avoids degenerate apex normals (NaN on some mobile GPUs)
    const beamGeo = new THREE.CylinderGeometry(0.16, radius, length, 20, 1, true);
    beamGeo.translate(0, -length / 2, 0);
    beamGeo.rotateX(-Math.PI / 2); // Points along +Z in local space

    this.beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.normalColor.clone() },
        uOpacity: { value: 0.3 }
      },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.frustumCulled = false;
    this.group.add(beam);

    const poolGeo = new THREE.PlaneGeometry(radius * 2.4, radius * 2.4);
    poolGeo.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: typeof document !== 'undefined' ? ProceduralTextures.getSoftGlowSprite() : null,
      color: PALETTE.searchlight,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.pool = new THREE.Mesh(poolGeo, this.poolMat);
    this.pool.frustumCulled = false;
    this.group.add(this.pool);
  }

  public update(timeSeconds: number, alertLevel: number, groundYOffset: number): void {
    const alert = Math.max(0, Math.min(1, Number.isFinite(alertLevel) ? alertLevel : 0));
    const flicker = 0.95 + 0.05 * Math.sin(timeSeconds * 23.0);

    (this.beamMat.uniforms.uColor.value as THREE.Color).lerpColors(this.normalColor, this.alertColor, alert);
    this.beamMat.uniforms.uOpacity.value = (0.3 + 0.25 * alert) * flicker;

    this.poolMat.color.lerpColors(this.normalColor, this.alertColor, alert);
    this.poolMat.opacity = (0.45 + 0.3 * alert) * flicker;
    this.pool.position.set(0, groundYOffset, 6.5);
  }

  public dispose(): void {
    disposeObject3D(this.group);
  }
}
