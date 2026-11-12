import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TILLEGG, VILKAR, type TilleggId } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad, Skille } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { useAuth } from '../../src/auth.tsx';
import { useHentet, useMittAbonnement } from '../../src/bruk.ts';
import { api, ApiFeil } from '../../src/api.ts';
import { aksentNa, datoMedAr, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';

export default function Meg() {
  const router = useRouter();
  const { bruker, loggUt } = useAuth();
  const { data, last } = useMittAbonnement();
  const oppsigelse = useHentet(
    async () => (data ? api.oppsigelse(data.abonnement.id) : null),
    [data?.abonnement.id],
  );
  const aksent = aksentNa();
  const [navn, settNavn] = useState(bruker?.navn ?? '');
  const [lagrer, settLagrer] = useState(false);
  const [melding, settMelding] = useState<string | null>(null);

  const harFelg = (data?.abonnement.tillegg ?? []).includes('felg_pluss');

  const vekslFelg = async () => {
    if (!data) return;
    const nye: TilleggId[] = harFelg
      ? (data.abonnement.tillegg as TilleggId[]).filter((t2) => t2 !== 'felg_pluss')
      : ([...(data.abonnement.tillegg as TilleggId[]), 'felg_pluss']);
    await api.endreTillegg(data.abonnement.id, nye);
    await last();
  };

  const lagreNavn = async () => {
    settLagrer(true);
    try {
      await api.oppdaterProfil({ navn: navn.trim() });
      settMelding('Lagret.');
    } catch (e) {
      settMelding(e instanceof ApiFeil ? e.message : 'Fikk ikke lagret.');
    } finally {
      settLagrer(false);
    }
  };

  const siOpp = async () => {
    if (!data) return;
    const utkjop = oppsigelse.data?.utkjopOre ?? 0;
    const tekst = utkjop > 0
      ? `Du er i bindingstiden. Du kjøper ut restverdien av dekkene vi har kjøpt til deg: ${formatterKr(utkjop)}.`
      : 'Abonnementet avsluttes ved neste månedsskifte. Vi henter settet som står på lager.';

    const bekreft = async () => {
      try {
        await api.sigOpp(data.abonnement.id);
        await last();
        settMelding('Abonnementet er sagt opp. Vi tar kontakt om settene.');
      } catch (e) {
        settMelding(e instanceof ApiFeil ? e.message : 'Fikk ikke sagt opp.');
      }
    };

    if (Platform.OS === 'web') {
      // Alert har ingen knapper på web.
      if (globalThis.confirm?.(`${tekst}\n\nSi opp abonnementet?`)) await bekreft();
      return;
    }
    Alert.alert('Si opp abonnementet', tekst, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Si opp', style: 'destructive', onPress: () => void bekreft() },
    ]);
  };

  return (
    <Skjerm tittel="Meg" undertittel={bruker?.telefon ?? undefined}>
      <Kort tittel="Navn">
        <Felt value={navn} onChangeText={settNavn} placeholder="Fornavn Etternavn" />
        <Knapp tittel="Lagre" variant="sekundar" laster={lagrer} onPress={lagreNavn} />
        {melding ? <Text style={t.liten}>{melding}</Text> : null}
      </Kort>

      {data ? (
        <>
          <Kort tittel="Abonnementet">
            <Rad venstre={data.abonnement.pakkenavn} hoyre={`${formatterKr(data.abonnement.manedsprisOre)}/mnd`} />
            <Rad venstre="Startet" hoyre={datoMedAr(data.abonnement.startet)} dempet />
            <Rad venstre="Binding til" hoyre={datoMedAr(data.abonnement.bindingSlutt)} dempet />
            <Rad venstre="Inkludert kjøring" hoyre={`${data.abonnement.kmPerAr.toLocaleString('nb-NO')} km/år`} dempet />
          </Kort>

          <Kort tittel="Tillegg">
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: harFelg }}
              onPress={() => void vekslFelg()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spor.sm }}
            >
              <View
                style={{
                  width: 46, height: 28, borderRadius: radius.pille, padding: 3,
                  backgroundColor: harFelg ? aksent : farge.kant,
                  alignItems: harFelg ? 'flex-end' : 'flex-start',
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: farge.bakgrunn }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: skrift.brodtekstHalvfet }}>
                  {TILLEGG.felg_pluss.navn} · {formatterKr(TILLEGG.felg_pluss.pris)}/mnd
                </Text>
                <Text style={t.liten}>{TILLEGG.felg_pluss.beskrivelse}</Text>
              </View>
            </Pressable>
          </Kort>

          <Kort tittel="Dekket av abonnementet">
            <Rad venstre="Punktering som kan repareres" hoyre="Inkludert" />
            <Rad venstre={`Ødelagt dekk, ${VILKAR.inkluderteSkadedekkPerBinding} per ${VILKAR.bindingManeder} mnd`} hoyre="Inkludert" />
            <Rad venstre="Ødelagt dekk utover det" hoyre={`${formatterKr(VILKAR.skadeEgenandel)} egenandel`} dempet />
            <Rad venstre="Bøyd eller sprukket felg" hoyre={harFelg ? 'Felg+' : 'Ikke dekket'} dempet />
            <Rad venstre="Kollisjon og hærverk" hoyre="Bilforsikringen" dempet />
          </Kort>

          <Knapp tittel="Meld punktering eller skade" variant="sekundar" onPress={() => router.push('/kunde/skade')} />

          <Kort tittel="Oppsigelse">
            {oppsigelse.data?.iBinding ? (
              <>
                <Rad venstre="I bindingstid til" hoyre={datoMedAr(oppsigelse.data.bindingSlutt)} />
                <Rad venstre="Utkjøp av dekk nå" hoyre={formatterKr(oppsigelse.data.utkjopOre)} />
                <Text style={t.liten}>
                  Du kjøper bare ut dekk vi har kjøpt til deg, og bare den delen av levetiden som er igjen.
                </Text>
              </>
            ) : (
              <Text style={t.brod}>Du er ute av bindingstiden og kan si opp uten utkjøp.</Text>
            )}
            <Skille />
            <Knapp tittel="Si opp abonnementet" variant="fare" onPress={() => void siOpp()} />
          </Kort>
        </>
      ) : null}

      <Knapp tittel="Logg ut" variant="tekst" onPress={() => void loggUt()} />
    </Skjerm>
  );
}
