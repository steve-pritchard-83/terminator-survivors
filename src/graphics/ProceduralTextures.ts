import * as THREE from 'three';

export class ProceduralTextures {
  private static brushedMetalNormal: THREE.CanvasTexture | null = null;
  private static brushedMetalRoughness: THREE.CanvasTexture | null = null;
  private static groundAlbedo: THREE.CanvasTexture | null = null;
  private static groundBump: THREE.CanvasTexture | null = null;
  private static softGlowSprite: THREE.CanvasTexture | null = null;

  public static getBrushedMetalNormal(): THREE.CanvasTexture {
    if (this.brushedMetalNormal) return this.brushedMetalNormal;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Normal map base: RGB (128, 128, 255)
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, size, size);

    // Micro horizontal scratches and panel grooves
    for (let y = 0; y < size; y += 2) {
      const tint = Math.floor(128 + (Math.random() - 0.5) * 40);
      ctx.fillStyle = `rgb(${tint}, 128, 255)`;
      ctx.fillRect(0, y, size, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.brushedMetalNormal = tex;
    return tex;
  }

  public static getBrushedMetalRoughness(): THREE.CanvasTexture {
    if (this.brushedMetalRoughness) return this.brushedMetalRoughness;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      const val = Math.floor(35 + Math.random() * 45);
      ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
      ctx.fillRect(0, y, size, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.brushedMetalRoughness = tex;
    return tex;
  }

  public static getWastelandGroundAlbedo(): THREE.CanvasTexture {
    if (this.groundAlbedo) return this.groundAlbedo;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base nocturnal cold slate ground #101824
    ctx.fillStyle = '#101824';
    ctx.fillRect(0, 0, size, size);

    // Ash dust noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      data[i] = Math.max(8, Math.min(45, 16 + noise * 0.6));
      data[i + 1] = Math.max(14, Math.min(60, 24 + noise * 0.8));
      data[i + 2] = Math.max(24, Math.min(80, 36 + noise * 1.1));
    }
    ctx.putImageData(imgData, 0, 0);

    // Cracked asphalt veins & bleached bone fragments
    ctx.strokeStyle = 'rgba(4, 8, 16, 0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Bleached skull bone flecks #B8C2CC
    ctx.fillStyle = 'rgba(184, 194, 204, 0.35)';
    for (let i = 0; i < 90; i++) {
      const bx = Math.random() * size;
      const by = Math.random() * size;
      const br = 1 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    this.groundAlbedo = tex;
    return tex;
  }

  public static getWastelandGroundBump(): THREE.CanvasTexture {
    if (this.groundBump) return this.groundBump;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = Math.floor(128 + (Math.random() - 0.5) * 60);
      data[i] = n;
      data[i + 1] = n;
      data[i + 2] = n;
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    this.groundBump = tex;
    return tex;
  }

  public static getSoftGlowSprite(): THREE.CanvasTexture {
    if (this.softGlowSprite) return this.softGlowSprite;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.18)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    this.softGlowSprite = tex;
    return tex;
  }
}
