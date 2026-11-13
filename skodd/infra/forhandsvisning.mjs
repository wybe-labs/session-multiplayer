// Forhåndsvisning på én port: web-bygget av appen, med /v1 sendt videre til
// API-et. Da kan appen åpnes i en nettleser uten at den trenger å nå API-et
// på en egen adresse.
//
//   node infra/forhandsvisning.mjs <mappe med web-bygg> [port] [api-port]
import { createServer, request } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const rot = resolve(process.argv[2] ?? 'apps/mobile/dist');
const port = Number(process.argv[3] ?? 8070);
const apiPort = Number(process.argv[4] ?? 8080);

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const sti = (req.url ?? '/').split('?')[0];

  if (sti.startsWith('/v1')) {
    const videre = request(
      { host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: req.headers },
      (svar) => { res.writeHead(svar.statusCode ?? 502, svar.headers); svar.pipe(res); },
    );
    videre.on('error', () => { res.writeHead(502); res.end('API-et svarer ikke'); });
    req.pipe(videre);
    return;
  }

  // Filer serveres som de er. Alt annet er en rute i appen og får index.html.
  const fil = normalize(join(rot, decodeURIComponent(sti)));
  const finnes = fil.startsWith(rot) && (await stat(fil).then((s) => s.isFile(), () => false));
  const valgt = finnes ? fil : join(rot, 'index.html');
  try {
    const innhold = await readFile(valgt);
    res.writeHead(200, {
      'content-type': TYPER[extname(valgt)] ?? 'application/octet-stream',
      'cache-control': finnes && sti.includes('/_expo/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(innhold);
  } catch {
    res.writeHead(404); res.end('Fant ikke web-bygget. Kjør expo export først.');
  }
}).listen(port, '0.0.0.0', () => console.log(`Skodd forhåndsvisning på http://localhost:${port}`));
