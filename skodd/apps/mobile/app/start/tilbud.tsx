import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Redirect } from 'expo-router';
import { TILLEGG, type TilleggId } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad, Skille } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { usePamelding } from '../../src/pamelding.tsx';
import { aksentNa, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';
import { Pressable } from 'react-native';

export default function TilbudSkjerm() {
  const router = useRouter();
  const { utkast, sett } = usePamelding();
  const aksent = aksentNa();
  const [valgte, settValgte] = useState<TilleggId[]>(utkast.tillegg);

  if (!utkast.tilbud) return <Redirect href="/start/regnr" />;

  const { kjoretoy, tilbud, sammenligning } = utkast.tilbud;
  const manedlige = (['felg_pluss'] as TilleggId[]);
  const ekstra = valgte.reduce((sum, id) => sum + (TILLEGG[id].type === 'mnd' ? TILLEGG[id].pris : 0), 0);
  const total = tilbud.manedspris + ekstra;

  return (
    <Skjerm
      tittel={tilbud.pakke.navn}
      undertittel={`${kjoretoy.merke} ${kjoretoy.modell} · ${kjoretoy.dimensjonFor.bredde}/${kjoretoy.dimensjonFor.profil}R${kjoretoy.dimensjonFor.tommer}`}
      bunn={
        <Knapp
          tittel="Dette vil jeg ha"
          undertekst={`${formatterKr(total)} per måned`}
          aksent={aksent}
          onPress={() => { sett({ tillegg: valgte }); router.push('/start/sted'); }}
        />
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: spor.md }}>
        <Text style={{ fontFamily: skrift.overskrift, fontSize: 64, color: farge.tekst, letterSpacing: -3 }}>
          {Math.round(total / 100)}
        </Text>
        <Text style={t.etikett}>kroner i måneden</Text>
      </View>

      <Kort tittel="Dette er med">
        {[
          'Sommersett og vintersett',
          'Lagring av settet som ikke står på bilen',
          'To skift i året, der bilen står',
          'Punktering reparert innen 48 timer',
          'Nye dekk når mønsteret er brukt opp',
        ].map((linje) => (
          <Rad key={linje} venstre={linje} hoyre="Inkludert" />
        ))}
      </Kort>

      <Kort tittel="Legg til">
        {manedlige.map((id) => {
          const valgt = valgte.includes(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: valgt }}
              onPress={() => settValgte(valgt ? valgte.filter((v) => v !== id) : [...valgte, id])}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spor.sm,
                borderWidth: 1, borderColor: valgt ? aksent : farge.kant,
                borderRadius: radius.md, padding: spor.sm,
              }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                  borderColor: valgt ? aksent : farge.grus,
                  backgroundColor: valgt ? aksent : 'transparent',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: skrift.brodtekstHalvfet }}>
                  {TILLEGG[id].navn} · {formatterKr(TILLEGG[id].pris)}/mnd
                </Text>
                <Text style={t.liten}>{TILLEGG[id].beskrivelse}</Text>
              </View>
            </Pressable>
          );
        })}
      </Kort>

      <Kort tittel="Mot å gjøre det selv">
        <Rad venstre="Dekkhotell med skift" hoyre={`${formatterKr(sammenligning.dekkhotellPerAr)}/år`} dempet />
        <Rad venstre="Nye dekk, fordelt per år" hoyre={`${formatterKr(sammenligning.dekkslitasjePerAr)}/år`} dempet />
        <Skille />
        <Rad venstre="I dag" hoyre={`${formatterKr(sammenligning.dagensKostnadPerAr)}/år`} />
        <Rad venstre="Med Skodd" hoyre={`${formatterKr(sammenligning.skoddPerAr)}/år`} />
        <Text style={[t.liten, { marginTop: spor.xs, color: sammenligning.skoddErBilligere ? farge.ok : farge.sol }]}>
          {sammenligning.skoddErBilligere
            ? `Du sparer rundt ${formatterKr(sammenligning.differanse)} i året, og slipper sjokkregningene.`
            : 'Litt dyrere enn å gjøre det selv, men uten jobben og uten sjokkregninger.'}
        </Text>
        <Text style={t.liten}>Anslag for en vanlig bil. Vi måler de faktiske tallene i piloten.</Text>
      </Kort>

      <Kort tittel="Vilkår">
        <Rad venstre="Binding" hoyre={`${tilbud.bindingManeder} måneder`} />
        <Rad venstre="Depositum ved bestilling" hoyre={formatterKr(tilbud.depositum)} />
        <Rad venstre="Inkludert kjørelengde" hoyre="15 000 km i året" />
        <Text style={t.liten}>
          Går du ut før bindingstiden er ute, kjøper du ut restverdien av de dekkene vi har kjøpt til deg.
          Kjører du mer enn 15 000 km, koster det 100 kr mer i måneden.
        </Text>
      </Kort>
    </Skjerm>
  );
}
