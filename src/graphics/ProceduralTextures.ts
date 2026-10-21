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
    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      // Future-war night: dark steel-blue sky, burning amber horizon, bright cold highlights.
      // Chrome needs strong contrast in what it reflects, otherwise it reads as flat blue plastic.
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      // The camera looks down on the action, so top-facing chrome reflects the zenith: keep it a cold silver-grey
      sky.addColorStop(0.0, '#6f86a3');
      sky.addColorStop(0.3, '#3d5373');
      sky.addColorStop(0.46, '#4a5e78');
      sky.addColorStop(0.5, '#7d6556'); // dull fires on the horizon
      sky.addColorStop(0.54, '#2a2a30');
      sky.addColorStop(1.0, '#06090e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Cold moon-like key light
      const moon = ctx.createRadialGradient(width * 0.3, height * 0.18, 4, width * 0.3, height * 0.18, 70);
      moon.addColorStop(0, 'rgba(235,245,255,1)');
      moon.addColorStop(1, 'rgba(235,245,255,0)');
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, width, height);

      // Searchlight / HK glare streaks
      ctx.globalCompositeOperation = 'lighter';
      const streaks: Array<[number, number, number, number]> = [
        [0.62, 0.12, 0.05, 0.9],
        [0.78, 0.2, 0.035, 0.7],
        [0.08, 0.26, 0.04, 0.6],
        [0.9, 0.08, 0.03, 0.5]
      ];
      for (const [fx, fy, fw, alpha] of streaks) {
        const g = ctx.createLinearGradient((fx - fw) * width, 0, (fx + fw) * width, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(220,236,255,${alpha})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect((fx - fw) * width, fy * height - 4, fw * 2 * width, 8);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    this.envMap = tex;
    return tex;
  }

  public static getWastelandGroundAlbedo(): THREE.CanvasTexture {
    if (this.groundAlbedo) return this.groundAlbedo;
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = this.get2DContext(canvas);

    if (ctx) {
      // Moonlit scorched slate-ash battlefield base (#1e2b3c)
      ctx.fillStyle = '#1e2b3c';
      ctx.fillRect(0, 0, size, size);

      // Multi-scale ash dust & soil grain
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 28;
        data[i] = Math.max(16, Math.min(72, 30 + noise * 0.8));
        data[i + 1] = Math.max(26, Math.min(90, 43 + noise * 0.9));
        data[i + 2] = Math.max(38, Math.min(115, 60 + noise * 1.0));
      }
      ctx.putImageData(imgData, 0, 0);

      // Heavy HK-Tank tracks carved into the ash earth
      for (let t = 0; t < 2; t++) {
        const trackX = t === 0 ? size * 0.28 : size * 0.72;
        for (const ox of [-34, 34]) {
          const grad = ctx.createLinearGradient(trackX + ox - 14, 0, trackX + ox + 14, 0);
          grad.addColorStop(0, 'rgba(12, 17, 24, 0.1)');
          grad.addColorStop(0.3, 'rgba(10, 15, 22, 0.42)');
          grad.addColorStop(0.7, 'rgba(8, 12, 18, 0.42)');
          grad.addColorStop(1, 'rgba(12, 17, 24, 0.1)');
          ctx.fillStyle = grad;
          ctx.fillRect(trackX + ox - 14, 0, 28, size);

          // Transverse tread chevrons / cleats
          ctx.fillStyle = 'rgba(6, 9, 14, 0.48)';
          for (let y = 0; y < size; y += 18) {
            ctx.fillRect(trackX + ox - 12, y, 24, 5);
          }
        }
      }

      // Blown plasma blast craters & scorched ash patches
      for (let c = 0; c < 22; c++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const cr = 24 + Math.random() * 52;
        const grad = ctx.createRadialGradient(cx, cy, cr * 0.08, cx, cy, cr);
        grad.addColorStop(0, 'rgba(8, 11, 16, 0.65)');
        grad.addColorStop(0.45, 'rgba(18, 25, 36, 0.45)');
        grad.addColorStop(0.75, 'rgba(38, 52, 72, 0.22)');
        grad.addColorStop(1, 'rgba(30, 43, 60, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();

        // Radiating scorch cracks from crater rims
        ctx.strokeStyle = 'rgba(8, 12, 18, 0.35)';
        ctx.lineWidth = 1.2;
        for (let r = 0; r < 4; r++) {
          const a = Math.random() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * cr * 0.6, cy + Math.sin(a) * cr * 0.6);
          ctx.lineTo(cx + Math.cos(a) * cr * 1.3, cy + Math.sin(a) * cr * 1.3);
          ctx.stroke();
        }
      }

      // Cracked tectonic fault lines & asphalt fractures
      ctx.strokeStyle = 'rgba(10, 16, 24, 0.52)';
      ctx.lineWidth = 2.0;
      for (let i = 0; i < 24; i++) {
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

      // Weathered concrete gravel, pulverized ceramic, and bone dust
      ctx.fillStyle = 'rgba(110, 130, 155, 0.35)';
      for (let i = 0; i < 180; i++) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const br = 0.7 + Math.random() * 2.2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    this.groundAlbedo = tex;
    return tex;
  }

  public static getWastelandGroundBump(): THREE.CanvasTexture {
    if (this.groundBump) return this.groundBump;
    const size = 512;
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
        const n = Math.floor(128 + (Math.random() - 0.5) * 68);
        data[i] = n;
        data[i + 1] = n;
        data[i + 2] = n;
      }
      ctx.putImageData(imgData, 0, 0);

      // Tank tread depth impressions
      ctx.fillStyle = 'rgb(90, 90, 90)';
      for (let t = 0; t < 2; t++) {
        const trackX = t === 0 ? size * 0.28 : size * 0.72;
        for (const ox of [-17, 17]) {
          ctx.fillRect(trackX + ox - 7, 0, 14, size);
        }
      }

      // Crater lip raised rim highlights
      ctx.strokeStyle = 'rgb(175, 175, 175)';
      ctx.lineWidth = 3.5;
      for (let c = 0; c < 12; c++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const cr = 14 + Math.random() * 28;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
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
