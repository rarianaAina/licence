import { emitLicence, type EmissionRequest } from '../../src/emission.js';
import type { Produit } from '../../src/produit.js';

/**
 * Paire de clés jetable, pour éprouver la signature sans la clé de l'éditeur.
 *
 * La vraie clé privée ne se trouve dans aucun dépôt — c'est toute la sécurité
 * du dispositif. Les épreuves en fabriquent donc une à chaque fois.
 */
export async function paireDeTest(): Promise<{ privee: CryptoKey; publique: string }> {
  const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', paire.publicKey));
  let binaire = '';
  for (const octet of spki) binaire += String.fromCharCode(octet);
  return { privee: paire.privateKey, publique: btoa(binaire) };
}

/** Émet une clé de test, avec des valeurs par défaut raisonnables. */
export async function emettreDeTest(
  produit: Produit,
  privee: CryptoKey,
  demande: Partial<EmissionRequest> = {},
  maintenant = new Date('2026-01-01T00:00:00.000Z'),
): Promise<string> {
  const emission = await emitLicence(
    produit,
    {
      code: 'A1B2-C3D4-E5F6',
      nom: 'LOVELEC',
      formule: 'essai',
      mois: 12,
      ...demande,
    },
    privee,
    maintenant,
  );
  return emission.cle;
}
