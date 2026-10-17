import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('P10-05 Release Engineering & PWA Audit', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('validates index.html conforms to PWA, SEO, and accessibility metadata standards', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toMatch(/<html\s+lang="en">/i);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('content="#050d1a"');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('Terminator Real NFI');
  });

  it('validates all required PWA icon assets exist on disk with valid file sizes', () => {
    const iconFiles = [
      'public/icons/favicon.png',
      'public/icons/favicon.svg',
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/icon-maskable-512.png'
    ];

    for (const file of iconFiles) {
      const fullPath = path.join(rootDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it('validates Vite PWA manifest and Workbox precache architecture in vite.config.ts', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.ts');
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

    expect(viteConfig).toContain('VitePWA');
    expect(viteConfig).toContain("display: 'standalone'");
    expect(viteConfig).toContain("orientation: 'landscape'");
    expect(viteConfig).toContain("theme_color: '#050d1a'");
    expect(viteConfig).toContain("background_color: '#050d1a'");
    expect(viteConfig).toContain('icons/icon-maskable-512.png');
    expect(viteConfig).toContain("purpose: 'maskable'");
    expect(viteConfig).toContain('workbox:');
    expect(viteConfig).toContain('cleanupOutdatedCaches: true');
    expect(viteConfig).toContain("navigateFallback: 'index.html'");
    expect(viteConfig).toContain('terminator-sfx-wav-cache');
  });

  it('verifies code splitting rules in vite.config.ts for budget compliance', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.ts');
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

    expect(viteConfig).toContain('manualChunks');
    expect(viteConfig).toContain("'three-vendor'");
    expect(viteConfig).toContain("'stage-environments'");
    expect(viteConfig).toContain("'codex'");
    expect(viteConfig).toContain("'settings'");
  });

  it('verifies CI deployment pipeline runs build, coverage, bundle check, and e2e testing', () => {
    const ciPath = path.join(rootDir, '.github/workflows/ci-deploy.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const ciConfig = fs.readFileSync(ciPath, 'utf-8');
    expect(ciConfig).toContain('npm run typecheck');
    expect(ciConfig).toContain('npm run lint');
    expect(ciConfig).toContain('npm run test:coverage');
    expect(ciConfig).toContain('npm run build');
    expect(ciConfig).toContain('npm run test:bundle-size');
    expect(ciConfig).toContain('npm run test:e2e');
    expect(ciConfig).toContain('actions/upload-pages-artifact');
  });
});
