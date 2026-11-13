import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { sesongFor, visRegnr } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { Merke, Dekkprofil } from '../../src/komponenter/Merke.tsx';
import { useMittAbonnement } from '../../src/bruk.ts';
import { aksentNa, datoTekst, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';

export default function Hjem() {
  const router = useRouter();
  const { data, laster, feil, ingenAbonnement, last } = useMittAbonnement();
  const aksent = aksentNa();

  if (laster && !data) {
    return (
      <Skjerm rull={false} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={aksent} />
      </Skjerm>
    );
  }

  if (ingenAbonnement) {
    return (
      <Skjerm
        tittel="Ingen bil ennå"
        undertittel="Legg inn registreringsnummeret, så ser du prisen med en gang."
        bunn={<Knapp tittel="Se prisen for bilen din" aksent={aksent} onPress={() => router.push('/start/regnr')} />}
      >
        <Merke storrelse={32} aksent={aksent} />
      </Skjerm>
    );
  }

  if (feil || !data) {
    return (
      <Skjerm tittel="Vi fikk ikke kontakt" undertittel={feil ?? undefined}
        bunn={<Knapp tittel="Prøv igjen" aksent={aksent} onPress={() => void last()} />}>
        <View />
      </Skjerm>
    );
  }

  const { abonnement, kjoretoy, monster, nesteVindu, sett } = data;
  const aktiv = abonnement.status === 'aktiv';
  const sesong = sesongFor(new Date());
  const paBil = sett.find((s) => s.status === 'pa_bil');

  return (
    <Skjerm>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Merke storrelse={24} aksent={aksent} />
        <Text style={t.etikett}>{kjoretoy ? visRegnr(kjoretoy.regnr) : ''}</Text>
      </View>

      <View style={{ gap: spor.xs, paddingTop: spor.lg, paddingBottom: spor.md }}>
        <Text style={t.h1}>{aktiv ? 'Du er skodd.' : 'Nesten i gang.'}</Text>
        <Text style={t.brodDempet}>
          {aktiv
            ? `${paBil ? (paBil.sesong === 'vinter' ? 'Vinterdekk' : 'Sommerdekk') : `${sesong === 'vinter' ? 'Vinterdekk' : 'Sommerdekk'}`} på bilen. Neste skift ${datoTekst(nesteVindu.start)}.`
            : 'Vi venter på depositumet. Da er du i gang.'}
        </Text>
      </View>

      {monster ? (
        <Kort tittel="Mønster på bilen nå">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spor.md }}>
            <View
              style={{
                width: 56, height: 56, borderRadius: radius.md, backgroundColor: farge.bakgrunn,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Dekkprofil bredde={22} hoyde={30} farge={aksent} tett={4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: skrift.overskrift, fontSize: 28, color: farge.tekst }}>
                {monster.naMm.toFixed(1).replace('.', ',')} mm
              </Text>
              <Text style={t.liten}>{monster.tekst}</Text>
            </View>
          </View>
        </Kort>
      ) : (
        <Kort tittel="Mønster">
          <Text style={t.brod}>Vi måler mønsteret ved første skift, og sender tallene på SMS.</Text>
        </Kort>
      )}

      <Kort tittel="Neste skift" hoyre={<Text style={[t.liten, { color: aksent }]}>{nesteVindu.monterer === 'vinter' ? 'Vinter' : 'Sommer'}</Text>}>
        <Rad venstre="Vindu" hoyre={`${datoTekst(nesteVindu.start)} – ${datoTekst(nesteVindu.slutt)}`} />
        <Rad venstre="Sted" hoyre={stedTekst(abonnement.stedstype)} dempet />
        <Knapp
          tittel="Velg tid og sted"
          variant="sekundar"
          style={{ marginTop: spor.xs }}
          onPress={() => router.push('/kunde/skift')}
        />
      </Kort>

      <Kort tittel="Abonnementet">
        <Rad venstre={abonnement.pakkenavn} hoyre={`${formatterKr(abonnement.manedsprisOre)}/mnd`} />
        <Rad venstre="Bil" hoyre={kjoretoy ? `${kjoretoy.merke} ${kjoretoy.modell}` : '–'} dempet />
        <Rad venstre="Status" hoyre={statusTekst(abonnement.status)} dempet />
      </Kort>

      <Knapp
        tittel="Meld punktering eller skade"
        variant="sekundar"
        onPress={() => router.push('/kunde/skade')}
      />
    </Skjerm>
  );
}

const stedTekst = (type: string): string =>
  ({ borettslag: 'I borettslaget', arbeidsplass: 'På jobben', hjemme: 'Hjemme', garasjeanlegg: 'I garasjeanlegget' })[type] ?? type;

const statusTekst = (status: string): string =>
  ({
    aktiv: 'Aktivt', venter_betaling: 'Venter på depositum', reservert: 'Reservert',
    pause: 'På pause', oppsagt: 'Sagt opp', avsluttet: 'Avsluttet',
  })[status] ?? status;
