import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

/** After the bundle lands in dist/, rewrite dist/sw.js with hashed asset URLs. */
function generateServiceWorker(): Plugin {
  return {
    name: 'generate-service-worker',
    apply: 'build',
    closeBundle() {
      const script = join(root, 'tools/generate-sw.mjs');
      const r = spawnSync(process.execPath, [script, '--out', 'dist'], {
        cwd: root,
        encoding: 'utf8',
      });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.status !== 0) {
        throw new Error('generate-sw.mjs failed with status ' + r.status);
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), generateServiceWorker()],
});
