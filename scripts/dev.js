const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function startProcess(label, args, cwd) {
  const child = spawn(pnpmCommand, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] exited with signal ${signal}`);
    } else {
      console.log(`[${label}] exited with code ${code}`);
    }
    if (!shuttingDown) {
      shuttingDown = true;
      stopAll();
      process.exit(code ?? 1);
    }
  });

  return child;
}

let shuttingDown = false;
const children = [
  startProcess('backend', ['run', 'dev'], path.join(rootDir, 'backend')),
  startProcess('app', ['start'], path.join(rootDir, 'app')),
];

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  process.exit(0);
});
