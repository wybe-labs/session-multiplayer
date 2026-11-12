import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { api, ApiFeil } from '../../src/api.ts';
import { useAuth } from '../../src/auth.tsx';
import { aksentNa, t } from '../../src/tema.ts';

const FORKLARING: Record<string, string> = {
  feil_kode: 'Koden stemmer ikke. Prøv igjen.',
  utlopt: 'Koden er for gammel. Be om en ny.',
  ingen_kode: 'Vi finner ingen kode. Be om en ny.',
  for_mange_forsok: 'For mange forsøk. Be om en ny kode.',
};

export default function KodeSkjerm() {
  const router = useRouter();
  const { loggInn } = useAuth();
  const { telefon, retur } = useLocalSearchParams<{ telefon: string; retur?: string }>();
  const [kode, settKode] = useState('');
  const [laster, settLaster] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const aksent = aksentNa();

  const bekreft = async () => {
    settFeil(null);
    settLaster(true);
    try {
      const rolle = await loggInn(telefon, kode);
      if (retur === 'bekreft') router.replace('/start/bekreft');
      else router.replace(rolle === 'montor' ? '/montor/dagen' : '/kunde/hjem');
    } catch (e) {
      settFeil(e instanceof ApiFeil ? (FORKLARING[e.message] ?? e.message) : 'Noe gikk galt. Prøv igjen.');
    } finally {
      settLaster(false);
    }
  };

  const sendNy = async () => {
    settFeil(null);
    try {
      await api.sendKode(telefon);
    } catch {
      settFeil('Vi fikk ikke sendt ny kode.');
    }
  };

  return (
    <Skjerm
      tittel="Koden"
      undertittel={`Sendt til ${telefon}. Den varer i fem minutter.`}
      bunn={
        <>
          <Knapp tittel="Logg inn" aksent={aksent} av={kode.length !== 6} laster={laster} onPress={bekreft} />
          <Knapp tittel="Send ny kode" variant="tekst" onPress={sendNy} />
        </>
      }
    >
      <Felt
        stor
        etikett="Seks siffer"
        value={kode}
        onChangeText={(v) => { settKode(v.replace(/\D/g, '').slice(0, 6)); settFeil(null); }}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        feil={feil}
      />
      <Text style={t.liten}>Får du ingen kode, sjekk at nummeret er riktig.</Text>
    </Skjerm>
  );
}
