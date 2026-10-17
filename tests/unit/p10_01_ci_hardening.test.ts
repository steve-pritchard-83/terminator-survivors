import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('P10-01 CI hardening & coverage', () => {
  it('configures vitest coverage with required thresholds', async () => {
    const configPath = path.resolve('vitest.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf8');

    expect(content).toContain("provider: 'v8'");
    expect(content).toContain("'src/state/**'");
    expect(content).toContain('lines: 80');
    expect(content).toContain("'src/systems/**'");
    expect(content).toContain('lines: 60');
    expect(content).toContain("'src/core/**'");
    expect(content).toContain('lines: 70');
  });

  it('defines test:coverage, test:bundle-size, and lint in package.json', () => {
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.scripts['lint']).toBe('eslint .');
    expect(pkg.scripts['test:coverage']).toContain('--coverage');
    expect(pkg.scripts['test:bundle-size']).toContain('check-bundle-size.mjs');
  });

  it('configures CI workflow with lint, coverage, bundle check and artifact upload on failure', () => {
    const ciPath = path.resolve('.github', 'workflows', 'ci-deploy.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const ciContent = fs.readFileSync(ciPath, 'utf8');

    expect(ciContent).toContain('npm run lint');
    expect(ciContent).toContain('npm run test:coverage');
    expect(ciContent).toContain('npm run test:bundle-size');
    expect(ciContent).toContain('actions/upload-artifact@v4');
    expect(ciContent).toContain('playwright-report');
  });

  it('provides check-bundle-size script that accurately measures bundle size', () => {
    const scriptPath = path.resolve('scripts', 'check-bundle-size.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    expect(scriptContent).toContain('distAssetsDir');
    expect(scriptContent).toContain('--max-kb');
  });
});
