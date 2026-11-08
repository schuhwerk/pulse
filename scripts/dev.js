// Static dev server reachable from the local network, with a QR code for the phone.
// Usage: bun run dev [port]
import { networkInterfaces } from 'node:os';
import { join, normalize } from 'node:path';
import qrcode from 'qrcode-terminal';

const root = join(import.meta.dir, '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = Bun.file(join(root, normalize(path)));
    if (!(await file.exists())) return new Response('Not found', { status: 404 });
    // No caching, so a reload on the phone always gets the current file.
    return new Response(file, { headers: { 'Cache-Control': 'no-store' } });
  },
});

const lan = Object.values(networkInterfaces()).flat()
  .filter(a => a && a.family === 'IPv4' && !a.internal)
  .map(a => `http://${a.address}:${port}/`);

console.log(`Local:   http://localhost:${port}/`);
for (const url of lan) {
  console.log(`\nNetwork: ${url}`);
  qrcode.generate(url, { small: true });
}
if (!lan.length) console.log('No LAN interface found.');
