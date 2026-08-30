import { describe, expect, it } from 'vitest';
import {
  BOUTIQUE,
  CAISSE,
  LICENCE_PUBLIC_KEY,
  decodeLicence,
  installationCode,
  licenceState,
  quota,
  verifyLicence,
} from '../src/index.js';

/**
 * La clé RÉELLEMENT vendue à LOVELEC le 20 août 2026.
 *
 * Elle est reproduite ici parce qu'aucune épreuve fabriquée ne peut prouver ce
 * qui compte : que le nouveau format lit encore, avec la vraie clé publique de
 * l'éditeur, une clé déjà entre les mains d'un client. Une régression sur ce
 * point ne se découvrirait qu'au téléphone, un samedi.
 *
 * Elle n'est pas un secret : elle est déjà chez son propriétaire, elle ne vaut
 * que pour son installation, et la lire ne permet pas d'en fabriquer d'autres.
 *
 * L'identifiant d'entreprise correspondant, lui, est chez le client et
 * n'appartient pas à ce dépôt. On ne peut donc pas éprouver ici le cas
 * « valide » de bout en bout — mais on éprouve mieux : que la SIGNATURE est
 * reconnue authentique, puisque le refus porte alors sur l'entreprise et non
 * sur la signature.
 */
const CLE_LOVELEC =
  'CAISSE-1.eyJ2IjoxLCJjIjoiNTg4OS1GRjA4LTU0REEiLCJuIjoiTE9WRUxFQyIsInMiOiJxdWluY2FpbGxlcmllIiwiZiI6WyJzYWxlIiwicHVyY2hhc2luZyIsImN1c3RvbWVycyJdLCJyIjozLCJiIjoxLCJpIjoiMjAyNi0wOC0yMCIsImUiOiIyMDI3LTA4LTIwIn0.wYxdRMpszjR8sye9jtOTHt8RXe8OkjTWHXcX8J2YZwzWpUJhjB_xpzDIGOHab8ejCOhMXL8ANgxig9sJSNTxrA';

const CODE_LOVELEC = '5889-FF08-54DA';

describe('clé réellement vendue, format de version 1', () => {
  it('se décode encore', () => {
    const decodee = decodeLicence(CLE_LOVELEC);
    expect(decodee).not.toBeNull();
    expect(decodee?.prefixe).toBe('CAISSE-1');
    expect(decodee?.payload.n).toBe('LOVELEC');
    expect(decodee?.payload.c).toBe(CODE_LOVELEC);
  });

  it('est lue comme une clé de caisse, avec ses plafonds nommés', () => {
    const charge = decodeLicence(CLE_LOVELEC)!.payload;
    expect(charge.p).toBe('caisse');
    expect(charge.v).toBe(1);
    expect(charge.f).toEqual(['sale', 'purchasing', 'customers']);
    expect(quota(charge, 'caisses')).toBe(3);
    expect(quota(charge, 'boutiques')).toBe(1);
  });

  it('porte une signature authentique de l’éditeur', async () => {
    // Vérifiée contre la VRAIE clé publique embarquée dans les applications.
    // Le refus porte sur l'entreprise, PAS sur la signature : la charge a donc
    // été authentifiée avant d'en arriver là. Si la vérification cassait, on
    // lirait « invalide » ici.
    const statut = await verifyLicence(CLE_LOVELEC, {
      publicKeySpki: LICENCE_PUBLIC_KEY,
      produit: CAISSE,
      companyId: 'une-entreprise-qui-n-est-pas-la-sienne',
      now: Date.parse('2026-09-01T12:00:00.000Z'),
    });
    expect(statut.state).toBe('autre-entreprise');
    expect(statut.payload?.n).toBe('LOVELEC');
    expect(statut.reason).toContain(CODE_LOVELEC);
  });

  it('N’OUVRE PAS la boutique', async () => {
    // Le défaut que la version 2 vient corriger : sans champ produit, cette
    // clé aurait ouvert le deuxième logiciel sans que personne l'ait vendu.
    // Le refus tombe avant même la question de l'entreprise.
    const statut = await verifyLicence(CLE_LOVELEC, {
      publicKeySpki: LICENCE_PUBLIC_KEY,
      produit: BOUTIQUE,
      companyId: 'peu-importe',
      now: Date.parse('2027-01-15T12:00:00.000Z'),
    });
    expect(statut.state).toBe('autre-produit');
    expect(statut.reason).toContain(BOUTIQUE.nom);
  });

  it('conserve son échéance au jour près', () => {
    const charge = decodeLicence(CLE_LOVELEC)!.payload;
    expect(charge.e).toBe('2027-08-20');

    // L'identifiant du client n'appartient pas à ce dépôt : on rejoue sa
    // charge sous une entreprise connue pour éprouver la seule règle qui reste,
    // l'échéance.
    const sienne = { ...charge, c: installationCode('lovelec') };
    const juger = (quand: string) =>
      licenceState(sienne, CAISSE, 'lovelec', Date.parse(quand)).state;

    // Le dernier jour compte encore ; le lendemain passe en grâce, jamais
    // directement à l'arrêt.
    expect(juger('2027-08-20T23:00:00.000Z')).toBe('valide');
    expect(juger('2027-08-21T08:00:00.000Z')).toBe('grace');
    expect(juger('2027-09-30T08:00:00.000Z')).toBe('expiree');
  });

  it('reste refusée si un caractère a sauté à la recopie', async () => {
    const tronquee = CLE_LOVELEC.slice(0, -1);
    const statut = await verifyLicence(tronquee, {
      publicKeySpki: LICENCE_PUBLIC_KEY,
      produit: CAISSE,
      companyId: 'peu-importe',
    });
    expect(statut.state).toBe('invalide');
  });
});
