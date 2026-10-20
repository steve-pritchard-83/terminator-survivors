import { execSync, spawn } from 'child_process';

// Build the e2e bundle (with the debug API) into dist-e2e so it can never
// overwrite the production dist/ folder.
const env = { ...process.env, VITE_E2E: '1', BUILD_OUT_DIR: 'dist-e2e' };

console.log('[E2E Server] Building bundle with VITE_E2E=1 into dist-e2e...');
execSync('npm run build', { stdio: 'inherit', shell: true, env });

console.log('[E2E Server] Starting preview server on port 4173...');
const previewProcess = spawn('npx vite preview --outDir dist-e2e --port 4173 --strictPort', {
  stdio: 'inherit',
  shell: true,
  env
});

previewProcess.on('close', (previewCode) => {
  process.exit(previewCode ?? 0);
});
