import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { useHentet, useMittAbonnement } from '../../src/bruk.ts';
import { api, ApiFeil } from '../../src/api.ts';
import { aksentNa, datoMedAr, datoTekst, farge, radius, skrift, spor, t } from '../../src/tema.ts';

export default function Skift() {
  const { data } = useMittAbonnement();
  const vinduer = useHentet(() => api.vinduer(), []);
  const mine = useHentet(() => api.mineJobber(), []);
  const aksent = aksentNa();
  const [valgt, settValgt] = useState<string | null>(null);
  const [vask, settVask] = useState(false);
  const [lagrer, settLagrer] = useState(false);
  const [melding, settMelding] = useState<string | null>(null);
  const [feil, settFeil] = useState<string | null>(null);

  const book = async () => {
    if (!data || !valgt) return;
    settFeil(null);
    settLagrer(true);
    try {
      const svar = await api.bookSkift({
        abonnementId: data.abonnement.id,
        vinduId: valgt,
        ...(data.abonnement.stedstype === 'borettslag' ? {} : {}),
        tilleggVask: vask,
      });
      settMelding(svar.flyttet ? 'Skiftet er flyttet. Vi sender ny bekreftelse.' : 'Skiftet er satt opp. Du får SMS dagen før.');
      await mine.last();
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke booket. Prøv igjen.');
    } finally {
      settLagrer(false);
    }
  };

  if (!vinduer.data) {
    return (
      <Skjerm rull={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={aksent} />
      </Skjerm>
    );
  }

  const kommende = vinduer.data.vinduer.filter((v) => new Date(v.slutt) >= new Date());

  return (
    <Skjerm
      tittel="Skift"
      undertittel="Velg vinduet som passer. Vi kommer dit bilen står."
      bunn={
        <>
          {melding ? <Text style={[t.liten, { color: farge.ok }]}>{melding}</Text> : null}
          {feil ? <Text style={[t.liten, { color: farge.varsel }]}>{feil}</Text> : null}
          <Knapp tittel="Sett opp skiftet" aksent={aksent} av={!valgt} laster={lagrer} onPress={book} />
        </>
      }
    >
      {kommende.map((v) => {
        const er = valgt === v.id;
        return (
          <Pressable
            key={v.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: er }}
            onPress={() => settValgt(v.id)}
            style={{
              borderWidth: 1, borderColor: er ? aksent : farge.kant,
              backgroundColor: er ? farge.flate : 'transparent',
              borderRadius: radius.md, padding: spor.md, gap: 4,
            }}
          >
            <Text style={{ fontFamily: skrift.overskriftMedium, fontSize: 18 }}>
              {v.monterer === 'sommer' ? 'Sommerdekk på' : 'Vinterdekk på'} · {v.ar}
            </Text>
            <Text style={t.brodDempet}>
              {datoTekst(v.start)} – {datoMedAr(v.slutt)}
            </Text>
            {v.lovpalagtFrist ? (
              <Text style={t.liten}>
                {v.monterer === 'sommer'
                  ? `Piggdekk er lov til ${datoTekst(v.lovpalagtFrist)}`
                  : `Piggdekk er lov fra ${datoTekst(v.lovpalagtFrist)}`}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      <Kort tittel="Legg til ved dette skiftet">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: vask }}
          onPress={() => settVask(!vask)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spor.sm }}
        >
          <View
            style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
              borderColor: vask ? aksent : farge.grus,
              backgroundColor: vask ? aksent : 'transparent',
            }}
          />
          <Text style={t.brod}>Vask, 99 kr</Text>
        </Pressable>
      </Kort>

      {mine.data && mine.data.jobber.length ? (
        <Kort tittel="Skiftene dine">
          {mine.data.jobber.map((j) => (
            <Rad
              key={j.id}
              venstre={`${j.monterer === 'sommer' ? 'Sommerdekk' : 'Vinterdekk'} på`}
              hoyre={j.planlagtDato ? datoMedAr(j.planlagtDato) : jobbstatus(j.status)}
            />
          ))}
        </Kort>
      ) : null}

      <Text style={t.liten}>
        Vinduene er seks uker lange. Jo tidligere i vinduet du slipper oss til, jo billigere blir ruten, og det er
        derfor vi gir rabatt for tidlig skift.
      </Text>
    </Skjerm>
  );
}

const jobbstatus = (status: string): string =>
  ({ planlagt: 'Satt opp', tildelt: 'Montør tildelt', utfort: 'Utført', avlyst: 'Avlyst' })[status] ?? status;
