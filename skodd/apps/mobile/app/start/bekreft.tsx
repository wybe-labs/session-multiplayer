import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { TILLEGG, VILKAR } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad, Skille } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { api, ApiFeil } from '../../src/api.ts';
import { useAuth } from '../../src/auth.tsx';
import { usePamelding } from '../../src/pamelding.tsx';
import { aksentNa, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';

export default function BekreftSkjerm() {
  const router = useRouter();
  const { bruker } = useAuth();
  const { utkast, sett, nullstill } = usePamelding();
  const aksent = aksentNa();
  const [godtar, settGodtar] = useState(false);
  const [kode, settKode] = useState(utkast.kampanjekode ?? '');
  const [laster, settLaster] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);

  if (!utkast.tilbud || !utkast.pakke || !utkast.stedstype) return <Redirect href="/start/regnr" />;

  const manedlige = utkast.tillegg.filter((id) => TILLEGG[id].type === 'mnd');
  const total = utkast.tilbud.tilbud.manedspris + manedlige.reduce((s, id) => s + TILLEGG[id].pris, 0);

  const bestill = async () => {
    // Uten innlogging må kunden identifisere seg først. Utkastet blir liggende.
    if (!bruker) {
      sett({ kampanjekode: kode.trim() || undefined });
      router.push('/logg-inn/telefon?retur=bekreft');
      return;
    }
    settFeil(null);
    settLaster(true);
    try {
      const svar = await api.meldPa({
        regnr: utkast.regnr,
        pakke: utkast.pakke!,
        tillegg: utkast.tillegg,
        kmPerAr: utkast.kmPerAr,
        stedstype: utkast.stedstype!,
        ...(utkast.stedId ? { stedId: utkast.stedId } : {}),
        ...(utkast.adresse ? { adresse: utkast.adresse } : {}),
        ...(kode.trim() ? { kampanjekode: kode.trim().toUpperCase() } : {}),
        godtarVilkar: true,
        egneDekk: utkast.egneDekk,
      });
      if (svar.betalingsUrl) await Linking.openURL(svar.betalingsUrl).catch(() => {});
      nullstill();
      router.replace('/kunde/hjem');
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke fullført bestillingen. Prøv igjen.');
    } finally {
      settLaster(false);
    }
  };

  return (
    <Skjerm
      tittel="Bekreft"
      undertittel="Depositumet trekkes nå. Månedsprisen starter ved første skift."
      bunn={
        <>
          {feil ? <Text style={[t.liten, { color: farge.varsel }]}>{feil}</Text> : null}
          <Knapp
            tittel={bruker ? 'Bestill og betal depositum' : 'Fortsett med mobilnummer'}
            undertekst={bruker ? `${formatterKr(utkast.tilbud.tilbud.depositum)} nå, så ${formatterKr(total)}/mnd` : undefined}
            aksent={aksent}
            av={!godtar}
            laster={laster}
            onPress={bestill}
          />
        </>
      }
    >
      <Kort tittel="Bestillingen">
        <Rad venstre={utkast.tilbud.tilbud.pakke.navn} hoyre={formatterKr(utkast.tilbud.tilbud.pakke.pris)} />
        {manedlige.map((id) => (
          <Rad key={id} venstre={TILLEGG[id].navn} hoyre={formatterKr(TILLEGG[id].pris)} />
        ))}
        <Skille />
        <Rad venstre="Per måned" hoyre={formatterKr(total)} />
        <Rad venstre="Depositum nå" hoyre={formatterKr(utkast.tilbud.tilbud.depositum)} />
        <Skille />
        <Rad venstre="Bil" hoyre={`${utkast.tilbud.kjoretoy.merke} ${utkast.tilbud.kjoretoy.modell}`} dempet />
        <Rad venstre="Sted" hoyre={utkast.adresse?.gate ?? '–'} dempet />
      </Kort>

      <Felt
        etikett="Kode fra nabo eller borettslag"
        value={kode}
        onChangeText={(v) => settKode(v.toUpperCase())}
        placeholder="SOLBAKKEN"
        autoCapitalize="characters"
        hjelp="Har du en kode, får du én måned gratis."
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: godtar }}
        onPress={() => settGodtar(!godtar)}
        style={{
          flexDirection: 'row', gap: spor.sm, alignItems: 'flex-start',
          borderWidth: 1, borderColor: godtar ? aksent : farge.kant,
          borderRadius: radius.md, padding: spor.md,
        }}
      >
        <View
          style={{
            width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginTop: 2,
            borderColor: godtar ? aksent : farge.grus,
            backgroundColor: godtar ? aksent : 'transparent',
          }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: skrift.brodtekstHalvfet }}>Jeg godtar vilkårene</Text>
          <Text style={t.liten}>
            {VILKAR.bindingManeder} måneders binding. Går jeg ut tidligere, kjøper jeg ut restverdien av dekk Skodd
            har kjøpt til meg. {VILKAR.angrefristDager} dagers angrerett fra bestilling, så lenge første skift ikke er
            utført.
          </Text>
        </View>
      </Pressable>
    </Skjerm>
  );
}
