// docker-entrypoint.js — espera a MySQL (TCP) y arranca el API.
// Evita dependencias de shell (CRLF-proof): solo Node.
const net = require('net');
const { spawn } = require('child_process');

const host = process.env.DB_HOST || 'mysql';
const port = Number(process.env.DB_PORT || '3306');
const timeoutSec = Number(process.env.DB_WAIT_TIMEOUT || '300');
const started = Date.now();

function attempt() {
  const socket = net.connect({ host, port });
  socket.on('connect', () => {
    socket.end();
    console.log(`[entrypoint] mysql ${host}:${port} disponible, arrancando API…`);
    const child = spawn('node', ['dist/index.js'], { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code ?? 0));
  });
  socket.on('error', () => {
    socket.destroy();
    if ((Date.now() - started) / 1000 > timeoutSec) {
      console.error(`[entrypoint] timeout esperando ${host}:${port}`);
      process.exit(1);
    }
    setTimeout(attempt, 1000);
  });
}

attempt();
