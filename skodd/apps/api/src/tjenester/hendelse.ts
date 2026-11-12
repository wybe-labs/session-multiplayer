/** Hendelseslogg. Alt som skjer med en bil havner her, og blir datagrunnlaget. */
import type { Db } from '../db/client.ts';
import { hendelser } from '../db/schema.ts';
import { nyId } from '../ids.ts';

export async function logg(
  db: Db,
  type: string,
  felt: { abonnementId?: string; jobbId?: string; data?: Record<string, unknown> } = {},
): Promise<void> {
  await db.insert(hendelser).values({
    id: nyId(),
    type,
    abonnementId: felt.abonnementId ?? null,
    jobbId: felt.jobbId ?? null,
    data: felt.data ?? {},
  });
}
