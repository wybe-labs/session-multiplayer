import { lesEnv } from './env.ts';
import { koble } from './db/client.ts';
import { migrer } from './db/migrate.ts';
import { byggApp } from './app.ts';
import { sikreVinduer } from './tjenester/drift.ts';

const env = lesEnv();
const tilkobling = await koble(env.DATABASE_URL);

const nye = await migrer(tilkobling);
if (nye.length) console.log(`Migrasjoner kjørt: ${nye.join(', ')}`);

// Sesongvinduene må finnes før noen kan booke.
const ar = new Date().getUTCFullYear();
await sikreVinduer(tilkobling.db, ar);
await sikreVinduer(tilkobling.db, ar + 1);

const app = await byggApp({ env, tilkobling });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await tilkobling.lukk();
    process.exit(0);
  });
}

await app.listen({ port: env.PORT, host: env.HOST });
