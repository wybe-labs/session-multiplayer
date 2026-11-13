import { ActivityIndicator, View } from 'react-native';
import { HJUL, LOVLIG_MIN_MM, SKODD_GRENSE_MM, type HjulMaling } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad, Skille } from '../../src/komponenter/Kort.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { Monsterring } from '../../src/komponenter/Monsterring.tsx';
import { Hjulkort } from '../../src/komponenter/Hjulkort.tsx';
import { useHentet, useMittAbonnement } from '../../src/bruk.ts';
import { api } from '../../src/api.ts';
import { aksentNa, datoMedAr, farge, spor, t } from '../../src/tema.ts';

export default function Dekkene() {
  const { data, laster } = useMittAbonnement();
  const aksent = aksentNa();
  const abonnementId = data?.abonnement.id;
  const historikk = useHentet(
    async () => (abonnementId ? api.malinger(abonnementId) : { malinger: [] }),
    [abonnementId],
  );

  if (laster && !data) {
    return (
      <Skjerm rull={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={aksent} />
      </Skjerm>
    );
  }

  if (!data) {
    return (
      <Skjerm tittel="Dekkene" undertittel="Her ser du mønsteret når du har et abonnement.">
        <View />
      </Skjerm>
    );
  }

  const { monster, sett, sesongNa } = data;
  const siste = historikk.data?.malinger[0];
  const paBil = sett.find((s) => s.status === 'pa_bil');
  const paLager = sett.filter((s) => s.status === 'pa_lager');
  const sesong = paBil?.sesong ?? sesongNa;

  return (
    <Skjerm tittel="Dekkene" undertittel="Målt av montøren, på fire hjul og tre punkter per dekk.">
      {monster ? (
        <View style={{ alignItems: 'center', paddingVertical: spor.md, gap: spor.md }}>
          <Monsterring mm={monster.naMm} brukt={monster.brukt} aksent={aksent} />
          <Text style={[t.brod, { textAlign: 'center' }]}>{monster.tekst}</Text>
        </View>
      ) : (
        <Kort tittel="Ingen måling ennå">
          <Text style={t.brod}>
            Vi måler mønsteret ved første skift. Da får du tallene her og på SMS.
          </Text>
        </Kort>
      )}

      {siste ? (
        <>
          <Text style={t.h3}>Hjul for hjul</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spor.sm }}>
            {HJUL.map((pos) => {
              const h = siste.hjul.find((x: HjulMaling) => x.posisjon === pos);
              return h ? <Hjulkort key={pos} hjul={h} sesong={siste.sesong} aksent={aksent} /> : null;
            })}
          </View>
          <Text style={t.liten}>
            Målt {datoMedAr(siste.maltDato)} ved {siste.kmStand.toLocaleString('nb-NO')} km.
            Lovkravet er {LOVLIG_MIN_MM[sesong].toString().replace('.', ',')} mm.
            Vi bytter ved {SKODD_GRENSE_MM[sesong].toString().replace('.', ',')} mm.
          </Text>
        </>
      ) : null}

      {monster ? (
        <Kort tittel="Prognose">
          <Rad venstre="Sesonger igjen på settet" hoyre={`${monster.sesongerIgjen}`} />
          <Rad venstre="Anslått bytte" hoyre={datoMedAr(monster.byttesAnslag)} />
          <Text style={t.liten}>
            Regnet ut fra din egen slitasje per 1000 km. Nye dekk er inkludert i prisen.
          </Text>
        </Kort>
      ) : null}

      <Kort tittel="Settene dine">
        {paBil ? (
          <Rad venstre={`${paBil.sesong === 'vinter' ? 'Vinterdekk' : 'Sommerdekk'}`} hoyre="På bilen" />
        ) : null}
        {paLager.map((s) => (
          <Rad
            key={s.id}
            venstre={s.sesong === 'vinter' ? 'Vinterdekk' : 'Sommerdekk'}
            hoyre={s.lagerplass ? `Lager ${s.lagerplass}` : 'På lager'}
            dempet
          />
        ))}
        <Skille />
        {sett.map((s) => (
          <Rad
            key={`eier-${s.id}`}
            venstre={`${s.sesong === 'vinter' ? 'Vinter' : 'Sommer'}: ${s.viKjopte ? 'kjøpt av Skodd' : 'dine egne'}`}
            hoyre={`${s.brukteSesonger} av ${s.levetidSesonger} sesonger brukt`}
            dempet
          />
        ))}
      </Kort>

      {historikk.data && historikk.data.malinger.length > 1 ? (
        <Kort tittel="Historikk">
          {historikk.data.malinger.map((m) => (
            <Rad
              key={m.id}
              venstre={`${datoMedAr(m.maltDato)} · ${m.sesong === 'vinter' ? 'vinter' : 'sommer'}`}
              hoyre={`${m.minMm.toFixed(1).replace('.', ',')} mm`}
              dempet
            />
          ))}
        </Kort>
      ) : null}

      <Text style={[t.liten, { color: farge.grus }]}>
        Bildene montøren tar av mønsteret ligger sammen med målingene, som dokumentasjon begge veier.
      </Text>
    </Skjerm>
  );
}
