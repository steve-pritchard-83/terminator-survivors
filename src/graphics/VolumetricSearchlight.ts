import * as THREE from 'three';

export class VolumetricSearchlight {
  public readonly group = new THREE.Group();
  private readonly coneMat: THREE.ShaderMaterial;
  private readonly groundDiscMat: THREE.MeshBasicMaterial;

  constructor(length = 12, radius = 3.6) {
    const coneGeo = new THREE.ConeGeometry(radius, length, 28, 1, true);
    coneGeo.translate(0, -length / 2, 0);
    coneGeo.rotateX(-Math.PI / 2); // Points along +Z in local space

    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xd8f4ff) },
        uAlertColor: { value: new THREE.Color(0xff2222) },
        uAlertLevel: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vAxial;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vAxial = clamp(1.0 - (position.z / ${length.toFixed(1)}), 0.0, 1.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uAlertColor;
        uniform float uAlertLevel;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vAxial;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(abs(dot(normalize(vNormal), viewDir)), 1.4);
          float axialFade = pow(vAxial, 1.35) * smoothstep(0.0, 0.12, vAxial);
          float dust = 0.88 + 0.12 * sin(vAxial * 18.0 - uTime * 4.0);
          vec3 col = mix(uColor, uAlertColor, clamp(uAlertLevel, 0.0, 1.0));
          float alpha = fresnel * axialFade * dust * (0.34 + 0.25 * uAlertLevel);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    const coneMesh = new THREE.Mesh(coneGeo, this.coneMat);
    this.group.add(coneMesh);

    const discGeo = new THREE.RingGeometry(0.2, radius * 0.95, 32);
    discGeo.rotateX(-Math.PI / 2);
    this.groundDiscMat = new THREE.MeshBasicMaterial({
      color: 0xd8f4ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const discMesh = new THREE.Mesh(discGeo, this.groundDiscMat);
    discMesh.name = 'groundDisc';
    this.group.add(discMesh);
  }

  public update(timeSeconds: number, alertLevel: number, groundYOffset: number): void {
    this.coneMat.uniforms.uTime.value = timeSeconds;
    this.coneMat.uniforms.uAlertLevel.value = alertLevel;
    this.groundDiscMat.color.lerpColors(
      new THREE.Color(0xd8f4ff),
      new THREE.Color(0xff2222),
      Math.min(1, alertLevel)
    );
    const disc = this.group.getObjectByName('groundDisc');
    if (disc) {
      disc.position.set(0, groundYOffset, 8.5);
    }
  }
}
