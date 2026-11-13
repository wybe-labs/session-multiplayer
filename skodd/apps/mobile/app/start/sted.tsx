import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import type { Stedstype } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Kort } from '../../src/komponenter/Kort.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { usePamelding } from '../../src/pamelding.tsx';
import { aksentNa, farge, radius, skrift, spor, t } from '../../src/tema.ts';

const STEDER: { id: Stedstype; navn: string; forklaring: string }[] = [
  { id: 'borettslag', navn: 'I borettslaget', forklaring: 'Vi tar hele garasjen på én dag. Billigst for oss, og raskest for deg.' },
  { id: 'arbeidsplass', navn: 'På jobben', forklaring: 'Vi kommer i arbeidstiden. Bilen står i ro likevel.' },
  { id: 'hjemme', navn: 'Hjemme', forklaring: 'Vi kommer til adressen din i et seks ukers vindu.' },
  { id: 'garasjeanlegg', navn: 'I et garasjeanlegg', forklaring: 'Oppgi anlegget, så avtaler vi med driften der.' },
];

const DEKK: { id: 'begge_sett' | 'ett_sett' | 'ingen'; navn: string; forklaring: string }[] = [
  { id: 'begge_sett', navn: 'Jeg har begge sett', forklaring: 'Vi tar dem inn på lager og bytter dem når de er slitt.' },
  { id: 'ett_sett', navn: 'Jeg har ett sett', forklaring: 'Vi skaffer det settet du mangler til innkjøpspris pluss 10 %.' },
  { id: 'ingen', navn: 'Jeg har ingen dekk', forklaring: 'Vi skaffer begge sett til innkjøpspris pluss 10 %.' },
];

export default function StedSkjerm() {
  const router = useRouter();
  const { utkast, sett } = usePamelding();
  const aksent = aksentNa();
  const [type, settType] = useState<Stedstype | null>(utkast.stedstype);
  const [gate, settGate] = useState(utkast.adresse?.gate ?? '');
  const [postnummer, settPostnummer] = useState(utkast.adresse?.postnummer ?? '');
  const [poststed, settPoststed] = useState(utkast.adresse?.poststed ?? '');
  const [merknad, settMerknad] = useState(utkast.adresse?.merknad ?? '');
  const [egneDekk, settEgneDekk] = useState(utkast.egneDekk);

  if (!utkast.tilbud) return <Redirect href="/start/regnr" />;

  const adresseKlar = gate.trim().length > 3 && /^\d{4}$/.test(postnummer) && poststed.trim().length > 1;
  const klar = !!type && adresseKlar;

  const videre = () => {
    sett({
      stedstype: type!,
      adresse: {
        gate: gate.trim(),
        postnummer,
        poststed: poststed.trim(),
        ...(merknad.trim() ? { merknad: merknad.trim() } : {}),
      },
      egneDekk,
    });
    router.push('/start/bekreft');
  };

  return (
    <Skjerm
      tittel="Hvor står bilen?"
      undertittel="Vi kommer dit bilen er. Står mange biler samlet, går det raskere for alle."
      bunn={<Knapp tittel="Videre" aksent={aksent} av={!klar} onPress={videre} />}
    >
      <View style={{ gap: spor.sm }}>
        {STEDER.map((s) => (
          <Valg
            key={s.id}
            navn={s.navn}
            forklaring={s.forklaring}
            valgt={type === s.id}
            aksent={aksent}
            onPress={() => settType(s.id)}
          />
        ))}
      </View>

      <Kort tittel="Adresse">
        <Felt etikett="Gate og nummer" value={gate} onChangeText={settGate} placeholder="Solbakkveien 12" />
        <View style={{ flexDirection: 'row', gap: spor.sm }}>
          <View style={{ width: 110 }}>
            <Felt etikett="Postnr." value={postnummer} onChangeText={settPostnummer} keyboardType="number-pad" maxLength={4} placeholder="0588" />
          </View>
          <View style={{ flex: 1 }}>
            <Felt etikett="Poststed" value={poststed} onChangeText={settPoststed} placeholder="Oslo" />
          </View>
        </View>
        <Felt
          etikett="Noe vi bør vite"
          value={merknad}
          onChangeText={settMerknad}
          placeholder="Plass 42, nøkkelboks ved porten"
          multiline
        />
      </Kort>

      <Text style={t.h3}>Dekkene du har i dag</Text>
      <View style={{ gap: spor.sm }}>
        {DEKK.map((d) => (
          <Valg
            key={d.id}
            navn={d.navn}
            forklaring={d.forklaring}
            valgt={egneDekk === d.id}
            aksent={aksent}
            onPress={() => settEgneDekk(d.id)}
          />
        ))}
      </View>
    </Skjerm>
  );
}

function Valg({ navn, forklaring, valgt, aksent, onPress }: {
  navn: string; forklaring: string; valgt: boolean; aksent: string; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: valgt }}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: valgt ? aksent : farge.kant,
        backgroundColor: valgt ? farge.flate : 'transparent',
        borderRadius: radius.md,
        padding: spor.md,
        gap: 2,
      }}
    >
      <Text style={{ fontFamily: skrift.brodtekstHalvfet, fontSize: 16 }}>{navn}</Text>
      <Text style={t.liten}>{forklaring}</Text>
    </Pressable>
  );
}
