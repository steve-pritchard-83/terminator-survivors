import { execSync, spawn } from 'child_process';

process.env.VITE_E2E = '1';

console.log('[E2E Server] Building bundle with VITE_E2E=1...');
execSync('npm run build', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_E2E: '1' }
});

console.log('[E2E Server] Starting preview server on port 4173...');
const previewProcess = spawn('npx vite preview --port 4173 --strictPort', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_E2E: '1' }
});

previewProcess.on('close', (previewCode) => {
  process.exit(previewCode ?? 0);
});
