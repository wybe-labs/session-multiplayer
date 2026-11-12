/**
 * Databasetilkobling. Postgres i drift, PGlite i test og lokal utvikling,
 * samme SQL i begge, så migrasjonene er bevist før de treffer produksjon.
 */
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { skjema } from './schema.ts';

export type Db = NodePgDatabase<typeof skjema> | PgliteDatabase<typeof skjema>;

export interface Tilkobling {
  db: Db;
  /** Kjører rå SQL. Brukes av migratoren. */
  exec(sql: string): Promise<void>;
  lukk(): Promise<void>;
}

export async function koble(url: string): Promise<Tilkobling> {
  if (url === 'memory' || url.startsWith('pglite')) {
    const katalog = url.startsWith('pglite:') ? url.slice('pglite:'.length) : undefined;
    const klient = katalog ? new PGlite(katalog) : new PGlite();
    await klient.waitReady;
    return {
      db: drizzlePglite(klient, { schema: skjema }),
      exec: async (sql) => void (await klient.exec(sql)),
      lukk: () => klient.close(),
    };
  }
  const pool = new Pool({ connectionString: url, max: 10 });
  return {
    db: drizzlePg(pool, { schema: skjema }),
    exec: async (sql) => void (await pool.query(sql)),
    lukk: () => pool.end(),
  };
}
