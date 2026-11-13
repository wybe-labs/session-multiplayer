/** Migrator. Leser migrations/*.sql i rekkefølge og holder styr på hva som er kjørt. */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { koble, type Tilkobling } from './client.ts';

const MIGRASJONER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

export async function migrer(t: Tilkobling, katalog = MIGRASJONER): Promise<string[]> {
  await t.exec(`CREATE TABLE IF NOT EXISTS _migrasjoner (
    navn text PRIMARY KEY,
    kjort timestamptz NOT NULL DEFAULT now()
  );`);

  const kjort = new Set<string>();
  const res = await t.db.execute<{ navn: string }>('SELECT navn FROM _migrasjoner');
  for (const rad of (res as unknown as { rows: { navn: string }[] }).rows ?? []) kjort.add(rad.navn);

  const filer = (await readdir(katalog)).filter((f) => f.endsWith('.sql')).sort();
  const nye: string[] = [];
  for (const fil of filer) {
    if (kjort.has(fil)) continue;
    const sql = await readFile(join(katalog, fil), 'utf8');
    await t.exec(sql);
    await t.exec(`INSERT INTO _migrasjoner (navn) VALUES ('${fil.replace(/'/g, "''")}')`);
    nye.push(fil);
  }
  return nye;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL ?? 'memory';
  const t = await koble(url);
  const nye = await migrer(t);
  console.log(nye.length ? `Kjørte: ${nye.join(', ')}` : 'Ingen nye migrasjoner.');
  await t.lukk();
}
