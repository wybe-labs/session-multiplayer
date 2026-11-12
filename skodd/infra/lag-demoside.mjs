// Lager én selvstendig HTML-side av demobygget: appen, fontene og
// demodataene i samme fil, uten et eneste kall ut. Siden kan åpnes rett i en
// nettleser eller publiseres som den er.
//
//   cd apps/mobile && EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-demo
//   node infra/lag-demoside.mjs apps/mobile/dist-demo skodd-appen.html
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const her = dirname(fileURLToPath(import.meta.url));
const bygg = resolve(process.argv[2] ?? 'apps/mobile/dist-demo');
const ut = resolve(process.argv[3] ?? 'skodd-appen.html');
const fontrot = resolve(her, '../apps/mobile/node_modules/@expo-google-fonts');

const jsMappe = join(bygg, '_expo/static/js/web');
const filer = (await readdir(jsMappe)).filter((f) => f.endsWith('.js'));
if (filer.length !== 1) {
  throw new Error(`Ventet én bunt, fant ${filer.length}. Bygg med asyncRoutes av.`);
}
let js = await readFile(join(jsMappe, filer[0]), 'utf8');
// Bunten skal ligge inne i en script-tagg, så den kan ikke selv inneholde en avslutning.
js = js.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');

const FONTER = [
  ['Inter_400Regular', 'inter/400Regular'],
  ['Inter_500Medium', 'inter/500Medium'],
  ['Inter_600SemiBold', 'inter/600SemiBold'],
  ['SpaceGrotesk_500Medium', 'space-grotesk/500Medium'],
  ['SpaceGrotesk_700Bold', 'space-grotesk/700Bold'],
];
const fontCss = (await Promise.all(FONTER.map(async ([navn, sti]) => {
  const data = (await readFile(join(fontrot, sti, `${navn}.ttf`))).toString('base64');
  return `@font-face{font-family:"${navn}";src:url(data:font/ttf;base64,${data}) format("truetype");font-display:block}`;
}))).join('\n');

const side = `<title>Skodd-appen</title>
<style>
/* Én skjerm, som en telefon: appen fyller høyden, og på brede skjermer
   står den som en smal kolonne midt på asfalten. */
:root {
  --asfalt: #121314;
  --asfalt-kant: #2A2D30;
  --sno: #F3F1EC;
  --is: #8EC3E8;
  --tekst-font: "Inter_400Regular", system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: dark;
}
html, body { height: 100%; }
body {
  margin: 0;
  overflow: hidden;
  background: var(--asfalt);
  color: var(--sno);
  font-family: var(--tekst-font);
}
#root {
  display: flex;
  flex: 1;
  height: 100%;
  width: 100%;
  max-width: 460px;
  margin-inline: auto;
}
@media (min-width: 520px) {
  #root { border-inline: 1px solid var(--asfalt-kant); }
}
:focus-visible { outline: 2px solid var(--is); outline-offset: 2px; }
${fontCss}
</style>
<noscript>Appen trenger JavaScript for å kjøre.</noscript>
<div id="root"></div>
<script>
// Appen ruter på stien. Den skal alltid starte på forsiden, uansett hvor siden ligger.
try { history.replaceState(null, '', '/'); } catch (e) { /* stien kan ikke endres her */ }
</script>
<script>
${js}
</script>
`;

await writeFile(ut, side);
console.log(`${ut}: ${(side.length / 1024 / 1024).toFixed(2)} MB`);
