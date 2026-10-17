import * as THREE from 'three';

export class ProceduralTextures {
  private static brushedMetalNormal: THREE.CanvasTexture | null = null;
  private static brushedMetalRoughness: THREE.CanvasTexture | null = null;
  private static groundAlbedo: THREE.CanvasTexture | null = null;
  private static groundBump: THREE.CanvasTexture | null = null;
  private static softGlowSprite: THREE.CanvasTexture | null = null;

  private static get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    try {
      if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
        return null;
      }
      return canvas.getContext('2d');
    } catch {
      return null;
    }
  }

  public static getBrushedMetalNormal(): THREE.CanvasTexture {
    if (this.brushedMetalNormal) return this.brushedMetalNormal;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      // Normal map base: RGB (128, 128, 255)
      ctx.fillStyle = 'rgb(128, 128, 255)';
      ctx.fillRect(0, 0, size, size);

      // Micro horizontal scratches and panel grooves
      for (let y = 0; y < size; y += 2) {
        const tint = Math.floor(128 + (Math.random() - 0.5) * 40);
        ctx.fillStyle = `rgb(${tint}, 128, 255)`;
        ctx.fillRect(0, y, size, 1);
      }
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
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y++) {
        const val = Math.floor(35 + Math.random() * 45);
        ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        ctx.fillRect(0, y, size, 1);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.brushedMetalRoughness = tex;
    return tex;
  }

  private static envMap: THREE.CanvasTexture | null = null;

  public static getMetallicEnvMap(): THREE.CanvasTexture {
    if (this.envMap) return this.envMap;
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      // Bright Cameron cobalt-silver sky dome gradient for chrome specular reflections
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0.0, '#4a88d9');
      grad.addColorStop(0.45, '#b8d8ff');
      grad.addColorStop(0.5, '#ffffff'); // Horizon specular studio strip
      grad.addColorStop(0.55, '#5a7898');
      grad.addColorStop(1.0, '#1e2f48');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    this.envMap = tex;
    return tex;
  }

  public static getWastelandGroundAlbedo(): THREE.CanvasTexture {
    if (this.groundAlbedo) return this.groundAlbedo;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      // Moonlit scorched slate-ash battlefield (#1e2b3c)
      ctx.fillStyle = '#1e2b3c';
      ctx.fillRect(0, 0, size, size);

      // Multi-scale ash dust & soil grain
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 24;
        data[i] = Math.max(18, Math.min(68, 30 + noise * 0.8));
        data[i + 1] = Math.max(28, Math.min(85, 43 + noise * 0.9));
        data[i + 2] = Math.max(40, Math.min(110, 60 + noise * 1.0));
      }
      ctx.putImageData(imgData, 0, 0);

      // Soft blast craters & scorched ash patches
      for (let c = 0; c < 14; c++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const cr = 18 + Math.random() * 36;
        const grad = ctx.createRadialGradient(cx, cy, cr * 0.1, cx, cy, cr);
        grad.addColorStop(0, 'rgba(10, 15, 22, 0.55)');
        grad.addColorStop(0.65, 'rgba(42, 58, 78, 0.25)');
        grad.addColorStop(1, 'rgba(30, 43, 60, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cracked asphalt fault lines
      ctx.strokeStyle = 'rgba(10, 16, 24, 0.45)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += (Math.random() - 0.5) * 48;
          y += (Math.random() - 0.5) * 48;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Subtle weathered gravel & ash flecks (no bright glowing dots)
      ctx.fillStyle = 'rgba(95, 112, 132, 0.32)';
      for (let i = 0; i < 90; i++) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const br = 0.8 + Math.random() * 1.6;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.groundAlbedo = tex;
    return tex;
  }

  public static getWastelandGroundBump(): THREE.CanvasTexture {
    if (this.groundBump) return this.groundBump;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
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
    }

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
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.18)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.softGlowSprite = tex;
    return tex;
  }
}
