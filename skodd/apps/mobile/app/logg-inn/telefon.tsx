import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { api, ApiFeil, ER_DEMO } from '../../src/api.ts';
import { Kort } from '../../src/komponenter/Kort.tsx';
import { aksentNa, t } from '../../src/tema.ts';

export default function TelefonSkjerm() {
  const router = useRouter();
  const { retur } = useLocalSearchParams<{ retur?: string }>();
  const [telefon, settTelefon] = useState('');
  const [laster, settLaster] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const aksent = aksentNa();

  const rent = telefon.replace(/\s/g, '');
  const gyldig = /^[49]\d{7}$/.test(rent) || /^\+47[49]\d{7}$/.test(rent);

  const send = async () => {
    settFeil(null);
    settLaster(true);
    try {
      await api.sendKode(rent);
      router.push({ pathname: '/logg-inn/kode', params: { telefon: rent, ...(retur ? { retur } : {}) } });
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke sendt koden. Prøv igjen.');
    } finally {
      settLaster(false);
    }
  };

  return (
    <Skjerm
      tittel="Mobilnummer"
      undertittel="Vi sender en kode på SMS. Det er alt vi trenger."
      bunn={<Knapp tittel="Send kode" aksent={aksent} av={!gyldig} laster={laster} onPress={send} />}
    >
      <Felt
        stor
        etikett="Nummer"
        value={telefon}
        onChangeText={(v) => { settTelefon(v); settFeil(null); }}
        placeholder="912 34 567"
        keyboardType="phone-pad"
        maxLength={14}
        feil={feil}
      />
      <Text style={t.liten}>
        Nummeret brukes til innlogging og til meldinger om skift. Vi sender ikke reklame.
      </Text>
      {ER_DEMO ? (
        <Kort tittel="Demo">
          <Text style={t.liten}>Velg en ferdig bruker, eller skriv et eget nummer for å starte som ny kunde.</Text>
          <Knapp tittel="Kunde med målinger" undertekst="910 00 001" variant="sekundar" onPress={() => settTelefon('910 00 001')} />
          <Knapp tittel="Montør med dagens rute" undertekst="900 00 002" variant="sekundar" onPress={() => settTelefon('900 00 002')} />
        </Kort>
      ) : null}
    </Skjerm>
  );
}
