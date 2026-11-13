/**
 * Betaling. Depositum ved forhåndsbestilling, så månedlig abonnement.
 * Stripe i drift. Mock i test, med samme grensesnitt, slik at hele
 * påmeldingen kan kjøres uten nøkler.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Ore } from '@skodd/core';

export interface DepositumKrav {
  abonnementId: string;
  belop: Ore;
  telefon: string;
  epost?: string;
  beskrivelse: string;
}

export interface Betalingsresultat {
  ref: string;
  /** URL kunden sendes til for å fullføre betalingen. */
  betalingsUrl?: string;
  status: 'krever_handling' | 'betalt' | 'feilet';
}

export interface AbonnementKrav {
  abonnementId: string;
  kundeRef: string;
  manedsprisOre: Ore;
  /** Gratismåneder fra kampanjekode. */
  gratisManeder?: number;
  startDato: Date;
}

export interface Betaling {
  krevDepositum(krav: DepositumKrav): Promise<Betalingsresultat>;
  startAbonnement(krav: AbonnementKrav): Promise<{ ref: string }>;
  avsluttAbonnement(ref: string, nar: Date): Promise<void>;
  /** Engangsbeløp: egenandel, utkjøp av restverdi, vask. */
  krevEngangsbelop(kundeRef: string, belop: Ore, beskrivelse: string): Promise<Betalingsresultat>;
  /** Verifiserer at en webhook faktisk kommer fra betalingsleverandøren. */
  verifiserWebhook(kropp: string, signatur: string | undefined): Webhookhendelse | null;
}

export interface Webhookhendelse {
  type: 'depositum.betalt' | 'abonnement.betalt' | 'abonnement.feilet' | 'ukjent';
  ref: string;
  abonnementId?: string;
}

export class MockBetaling implements Betaling {
  readonly kall: { metode: string; data: unknown }[] = [];
  private teller = 0;

  private neste(prefiks: string): string {
    this.teller += 1;
    return `${prefiks}_${String(this.teller).padStart(6, '0')}`;
  }

  async krevDepositum(krav: DepositumKrav): Promise<Betalingsresultat> {
    this.kall.push({ metode: 'krevDepositum', data: krav });
    const ref = this.neste('dep');
    return { ref, betalingsUrl: `https://betaling.test/skodd/${ref}`, status: 'krever_handling' };
  }

  async startAbonnement(krav: AbonnementKrav): Promise<{ ref: string }> {
    this.kall.push({ metode: 'startAbonnement', data: krav });
    return { ref: this.neste('sub') };
  }

  async avsluttAbonnement(ref: string, nar: Date): Promise<void> {
    this.kall.push({ metode: 'avsluttAbonnement', data: { ref, nar } });
  }

  async krevEngangsbelop(kundeRef: string, belop: Ore, beskrivelse: string): Promise<Betalingsresultat> {
    this.kall.push({ metode: 'krevEngangsbelop', data: { kundeRef, belop, beskrivelse } });
    return { ref: this.neste('eng'), status: 'betalt' };
  }

  verifiserWebhook(kropp: string): Webhookhendelse | null {
    try {
      const data = JSON.parse(kropp) as { type?: string; ref?: string; abonnementId?: string };
      if (!data.type || !data.ref) return null;
      const type = (['depositum.betalt', 'abonnement.betalt', 'abonnement.feilet'] as const).find(
        (t) => t === data.type,
      );
      return { type: type ?? 'ukjent', ref: data.ref, ...(data.abonnementId ? { abonnementId: data.abonnementId } : {}) };
    } catch {
      return null;
    }
  }
}

/**
 * Stripe. Implementeres mot Checkout for depositum og Subscriptions for
 * månedsprisen. Kalles bare når STRIPE_SECRET_KEY er satt.
 */
export class StripeBetaling implements Betaling {
  constructor(
    private readonly hemmelighet: string,
    private readonly webhookHemmelighet: string,
    private readonly base = 'https://api.stripe.com/v1',
  ) {}

  private async post(sti: string, felt: Record<string, string>): Promise<Record<string, unknown>> {
    const svar = await fetch(`${this.base}${sti}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.hemmelighet}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(felt).toString(),
    });
    if (!svar.ok) throw new Error(`Stripe ${sti}: ${svar.status} ${await svar.text()}`);
    return (await svar.json()) as Record<string, unknown>;
  }

  async krevDepositum(krav: DepositumKrav): Promise<Betalingsresultat> {
    const sesjon = await this.post('/checkout/sessions', {
      mode: 'payment',
      'line_items[0][price_data][currency]': 'nok',
      'line_items[0][price_data][unit_amount]': String(krav.belop),
      'line_items[0][price_data][product_data][name]': krav.beskrivelse,
      'line_items[0][quantity]': '1',
      'metadata[abonnement_id]': krav.abonnementId,
      success_url: 'https://skodd.no/takk?sesjon={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://skodd.no/avbrutt',
    });
    return {
      ref: String(sesjon.id),
      betalingsUrl: String(sesjon.url),
      status: 'krever_handling',
    };
  }

  async startAbonnement(krav: AbonnementKrav): Promise<{ ref: string }> {
    const abo = await this.post('/subscriptions', {
      customer: krav.kundeRef,
      'items[0][price_data][currency]': 'nok',
      'items[0][price_data][unit_amount]': String(krav.manedsprisOre),
      'items[0][price_data][recurring][interval]': 'month',
      'items[0][price_data][product_data][name]': 'Skodd abonnement',
      ...(krav.gratisManeder
        ? { trial_end: String(Math.floor(krav.startDato.getTime() / 1000) + krav.gratisManeder * 2_592_000) }
        : {}),
      'metadata[abonnement_id]': krav.abonnementId,
    });
    return { ref: String(abo.id) };
  }

  async avsluttAbonnement(ref: string): Promise<void> {
    await this.post(`/subscriptions/${ref}`, { cancel_at_period_end: 'true' });
  }

  async krevEngangsbelop(kundeRef: string, belop: number, beskrivelse: string): Promise<Betalingsresultat> {
    const faktura = await this.post('/invoiceitems', {
      customer: kundeRef,
      currency: 'nok',
      amount: String(belop),
      description: beskrivelse,
    });
    return { ref: String(faktura.id), status: 'krever_handling' };
  }

  verifiserWebhook(kropp: string, signatur: string | undefined): Webhookhendelse | null {
    if (!signatur || !this.webhookHemmelighet) return null;
    // Stripes signatur verifiseres med HMAC-SHA256 over «tidspunkt.kropp».
    const deler = Object.fromEntries(
      signatur.split(',').map((d) => d.split('=') as [string, string]),
    );
    const t = deler.t;
    const v1 = deler.v1;
    if (!t || !v1) return null;
    const ventet = createHmac('sha256', this.webhookHemmelighet).update(`${t}.${kropp}`).digest('hex');
    if (ventet.length !== v1.length || !timingSafeEqual(Buffer.from(ventet), Buffer.from(v1))) return null;
    const h = JSON.parse(kropp) as { type: string; data: { object: Record<string, any> } };
    const obj = h.data.object;
    const abonnementId = obj.metadata?.abonnement_id as string | undefined;
    const type: Webhookhendelse['type'] =
      h.type === 'checkout.session.completed'
        ? 'depositum.betalt'
        : h.type === 'invoice.paid'
          ? 'abonnement.betalt'
          : h.type === 'invoice.payment_failed'
            ? 'abonnement.feilet'
            : 'ukjent';
    return { type, ref: String(obj.id), ...(abonnementId ? { abonnementId } : {}) };
  }
}
