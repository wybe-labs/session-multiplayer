import { useState } from 'react';
import { useRouter } from 'expo-router';
import { erGyldigRegnr, normaliserRegnr } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { api, ApiFeil } from '../../src/api.ts';
import { usePamelding } from '../../src/pamelding.tsx';
import { aksentNa, t } from '../../src/tema.ts';

export default function RegnrSkjerm() {
  const router = useRouter();
  const { sett } = usePamelding();
  const [regnr, settRegnr] = useState('');
  const [feil, settFeil] = useState<string | null>(null);
  const [laster, settLaster] = useState(false);
  const aksent = aksentNa();

  const gyldig = erGyldigRegnr(regnr);

  const hentPris = async () => {
    settFeil(null);
    settLaster(true);
    try {
      const svar = await api.tilbud({ regnr: normaliserRegnr(regnr) });
      sett({ regnr: svar.kjoretoy.regnr, tilbud: svar, pakke: svar.tilbud.pakke.id });
      router.push('/start/tilbud');
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke kontakt. Prøv igjen.');
    } finally {
      settLaster(false);
    }
  };

  return (
    <Skjerm
      tittel="Hvilken bil?"
      undertittel="Vi henter dekkdimensjonen selv. Det tar ti sekunder."
      bunn={
        <Knapp
          tittel="Se prisen"
          aksent={aksent}
          av={!gyldig}
          laster={laster}
          onPress={hentPris}
        />
      }
    >
      <Felt
        stor
        etikett="Registreringsnummer"
        value={regnr}
        onChangeText={(v) => { settRegnr(v.toUpperCase()); settFeil(null); }}
        placeholder="AB 12345"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={9}
        feil={feil}
        hjelp="To bokstaver og fem siffer, slik det står på skiltet."
      />
      <Text style={t.liten}>
        Vi slår opp bilen i kjøretøyregisteret for å finne dekkstørrelsen. Ingenting bindes før du har bekreftet.
      </Text>
    </Skjerm>
  );
}
