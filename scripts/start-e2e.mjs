import { spawn } from 'child_process';

process.env.VITE_E2E = '1';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('[E2E Server] Building bundle with VITE_E2E=1...');
const buildProcess = spawn(npmCmd, ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_E2E: '1' }
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`[E2E Server] Build failed with exit code ${code}`);
    process.exit(code ?? 1);
  }
  console.log('[E2E Server] Starting preview server on port 4173...');
  const previewProcess = spawn(npxCmd, ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_E2E: '1' }
  });

  previewProcess.on('close', (previewCode) => {
    process.exit(previewCode ?? 0);
  });
});
