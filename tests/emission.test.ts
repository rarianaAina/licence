import { describe, expect, it } from 'vitest';
import {
  APPLIVE,
  BOUTIQUE,
  CAISSE,
  EmissionError,
  addMonths,
  buildPayload,
  decodeLicence,
  emitLicence,
  installationCode,
  licenceState,
  verifyLicence,
} from '../src/index.js';
import { paireDeTest } from './helpers/signature.js';

const LE_JOUR = new Date('2026-08-20T09:00:00.000Z');
const CODE = 'A1B2-C3D4-E5F6';

const demande = (modifications: Record<string, unknown> = {}) => ({
  code: CODE,
  nom: 'LOVELEC',
  formule: 'quincaillerie',
  mois: 12,
  ...modifications,
});

describe('durée vendue', () => {
  /**
   * `setMonth` ne borne pas, il déborde. Sans ces bornes, une licence d'un mois
   * vendue le 31 janvier vaudrait jusqu'au 3 mars : des jours donnés par
   * accident, et impossibles à expliquer au client qui compare deux factures.
   */
  it('borne au dernier jour du mois d’arrivée', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
      '2026-02-28',
    );
    expect(addMonths(new Date('2024-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
      '2024-02-29',
    );
  });

  it('garde le quantième quand il existe', () => {
    expect(addMonths(new Date('2026-03-15T00:00:00Z'), 6).toISOString().slice(0, 10)).toBe(
      '2026-09-15',
    );
  });

  it('traverse les années', () => {
    expect(addMonths(new Date('2026-08-20T00:00:00Z'), 24).toISOString().slice(0, 10)).toBe(
      '2028-08-20',
    );
  });

  it('refuse une durée qui n’est pas un nombre entier de mois', () => {
    expect(() => buildPayload(CAISSE, demande({ mois: 0 }), LE_JOUR)).toThrow(EmissionError);
    expect(() => buildPayload(CAISSE, demande({ mois: 1.5 }), LE_JOUR)).toThrow(EmissionError);
    expect(() => buildPayload(CAISSE, demande({ mois: 121 }), LE_JOUR)).toThrow(EmissionError);
  });
});

describe('charge émise', () => {
  it('nomme le produit vendu', () => {
    expect(buildPayload(CAISSE, demande(), LE_JOUR).p).toBe('caisse');
    expect(buildPayload(BOUTIQUE, demande({ formule: 'standard' }), LE_JOUR).p).toBe('boutique');
  });

  it('inscrit les fonctions de la formule, dans l’ordre du descripteur', () => {
    // Deux clés portant les mêmes fonctions doivent se ressembler : les
    // comparer à l'œil au téléphone ne doit pas dépendre d'un ordre de saisie.
    const charge = buildPayload(CAISSE, demande(), LE_JOUR);
    expect(charge.f).toEqual(['sale', 'purchasing', 'customers']);
  });

  it('ajoute d’office la fonction de noyau', () => {
    // Une caisse sans la vente, ce serait un logiciel vendu fermé.
    const charge = buildPayload(CAISSE, demande({ fonctions: ['purchasing'] }), LE_JOUR);
    expect(charge.f).toContain('sale');
  });

  it('accepte des fonctions choisies à la main', () => {
    const charge = buildPayload(CAISSE, demande({ fonctions: ['restaurant', 'balance'] }), LE_JOUR);
    expect(charge.f).toEqual(['sale', 'restaurant', 'balance']);
  });

  it('normalise le code d’installation', () => {
    expect(buildPayload(CAISSE, demande({ code: ' a1b2-c3d4-e5f6 ' }), LE_JOUR).c).toBe(CODE);
  });

  it('refuse un code mal formé plutôt que de le corriger', () => {
    for (const mauvais of ['', 'A1B2C3D4E5F6', 'A1B2-C3D4', 'Z1B2-C3D4-E5F6']) {
      expect(() => buildPayload(CAISSE, demande({ code: mauvais }), LE_JOUR)).toThrow(
        EmissionError,
      );
    }
  });

  it('refuse un nom de commerce vide', () => {
    expect(() => buildPayload(CAISSE, demande({ nom: '  ' }), LE_JOUR)).toThrow(EmissionError);
  });
});

describe('cloisonnement à l’émission', () => {
  it('refuse une fonction qui n’appartient pas au produit', () => {
    // « restaurant » est une fonction de la caisse ; la vendre sur une clé de
    // boutique ouvrirait une porte qui n'existe pas.
    expect(() =>
      buildPayload(BOUTIQUE, demande({ formule: 'standard', fonctions: ['restaurant'] }), LE_JOUR),
    ).toThrow(/Fonction inconnue pour Gestion de boutique/);
  });

  it('refuse une formule qui n’appartient pas au produit', () => {
    expect(() => buildPayload(BOUTIQUE, demande({ formule: 'quincaillerie' }), LE_JOUR)).toThrow(
      /Formule inconnue/,
    );
  });

  it('refuse un plafond qui n’appartient pas au produit', () => {
    expect(() => buildPayload(CAISSE, demande({ quotas: { utilisateurs: 5 } }), LE_JOUR)).toThrow(
      /Plafond inconnu/,
    );
  });

  it('nomme les possibilités dans le message de refus', () => {
    // L'éditeur émet une clé qu'un client attend au téléphone : le refus doit
    // porter sa correction.
    expect(() => buildPayload(BOUTIQUE, demande({ formule: 'inconnue' }), LE_JOUR)).toThrow(
      /solo, standard, reseau, essai/,
    );
  });
});

describe('plafonds', () => {
  it('reprend ceux de la formule quand rien n’est saisi', () => {
    expect(buildPayload(BOUTIQUE, demande({ formule: 'reseau' }), LE_JOUR).q).toEqual({
      postes: 6,
      boutiques: 3,
      utilisateurs: 20,
    });
  });

  it('reprend ceux du produit quand la formule n’en propose pas', () => {
    expect(buildPayload(CAISSE, demande({ formule: 'quincaillerie' }), LE_JOUR).q).toEqual({
      caisses: 1,
      boutiques: 1,
    });
  });

  it('accepte une valeur saisie à la vente', () => {
    const charge = buildPayload(CAISSE, demande({ quotas: { caisses: 4 } }), LE_JOUR);
    expect(charge.q['caisses']).toBe(4);
    expect(charge.q['boutiques']).toBe(1);
  });

  it('refuse une valeur absurde', () => {
    for (const mauvais of [0, -1, 1000, 2.5]) {
      expect(() =>
        buildPayload(CAISSE, demande({ quotas: { caisses: mauvais } }), LE_JOUR),
      ).toThrow(EmissionError);
    }
  });

  it('écrit TOUS les plafonds du produit, jamais un sous-ensemble', () => {
    // Un plafond absent serait relu comme « un seul » : l'oublier reviendrait
    // à vendre moins que ce qui a été payé.
    const charge = buildPayload(BOUTIQUE, demande({ formule: 'solo' }), LE_JOUR);
    expect(Object.keys(charge.q).sort()).toEqual(['boutiques', 'postes', 'utilisateurs']);
  });
});

describe('clé signée', () => {
  it('porte l’en-tête du produit', async () => {
    const { privee } = await paireDeTest();
    const caisse = await emitLicence(CAISSE, demande(), privee, LE_JOUR);
    const boutique = await emitLicence(BOUTIQUE, demande({ formule: 'standard' }), privee, LE_JOUR);
    expect(caisse.cle.startsWith('CAISSE-2.')).toBe(true);
    expect(boutique.cle.startsWith('BOUTIQUE-2.')).toBe(true);
  });

  it('se vérifie de bout en bout dans son produit', async () => {
    const { privee, publique } = await paireDeTest();
    const emission = await emitLicence(
      BOUTIQUE,
      demande({ formule: 'reseau', code: installationCode('lovelec') }),
      privee,
      LE_JOUR,
    );
    const statut = await verifyLicence(emission.cle, {
      publicKeySpki: publique,
      produit: BOUTIQUE,
      companyId: 'lovelec',
      now: Date.parse('2026-12-01T00:00:00Z'),
    });
    expect(statut.state).toBe('valide');
    expect(statut.payload?.q['boutiques']).toBe(3);
  });

  it('est refusée par l’autre produit', async () => {
    const { privee, publique } = await paireDeTest();
    const emission = await emitLicence(
      BOUTIQUE,
      demande({ formule: 'standard', code: installationCode('lovelec') }),
      privee,
      LE_JOUR,
    );
    const statut = await verifyLicence(emission.cle, {
      publicKeySpki: publique,
      produit: CAISSE,
      companyId: 'lovelec',
      now: Date.parse('2026-12-01T00:00:00Z'),
    });
    expect(statut.state).toBe('autre-produit');
  });

  it('ouvre une boutique APPLIVE, liée à son identifiant, sans aucun plafond', async () => {
    // APPLIVE se vend à la durée : la charge ne porte ni plafond ni fonction
    // optionnelle, et le code d'installation vient de l'identifiant de la boutique.
    const { privee, publique } = await paireDeTest();
    const boutique = '7d4e2a10-3b1c-4f5e-9a8b-1c2d3e4f5a6b';
    const emission = await emitLicence(
      APPLIVE,
      demande({ formule: 'standard', code: installationCode(boutique) }),
      privee,
      LE_JOUR,
    );
    expect(emission.cle.startsWith('APPLIVE-2.')).toBe(true);
    expect(emission.payload.q).toEqual({});
    expect(emission.payload.f).toEqual(['boutique-en-ligne']);

    const options = {
      publicKeySpki: publique,
      companyId: boutique,
      now: Date.parse('2026-12-01T00:00:00Z'),
    };
    expect((await verifyLicence(emission.cle, { ...options, produit: APPLIVE })).state).toBe(
      'valide',
    );
    expect((await verifyLicence(emission.cle, { ...options, produit: BOUTIQUE })).state).toBe(
      'autre-produit',
    );
    expect(
      (
        await verifyLicence(emission.cle, {
          ...options,
          produit: APPLIVE,
          companyId: 'une-autre-boutique',
        })
      ).state,
    ).toBe('autre-entreprise');
  });

  it('reste valable si l’en-tête a été mal recopié', async () => {
    // L'en-tête est décoratif : ce qui engage, c'est la charge signée. Refuser
    // dessus donnerait un message trompeur à qui a mal collé le début.
    const { privee, publique } = await paireDeTest();
    const emission = await emitLicence(
      CAISSE,
      demande({ code: installationCode('lovelec') }),
      privee,
      LE_JOUR,
    );
    const [, charge, signature] = emission.cle.split('.');
    const statut = await verifyLicence(`CAISSE-9.${charge}.${signature}`, {
      publicKeySpki: publique,
      produit: CAISSE,
      companyId: 'lovelec',
      now: Date.parse('2026-12-01T00:00:00Z'),
    });
    expect(statut.state).toBe('valide');
  });
});

describe('inscription au registre', () => {
  it('conserve ce qui a été vendu, et à qui', async () => {
    const { privee } = await paireDeTest();
    const emission = await emitLicence(
      BOUTIQUE,
      demande({ formule: 'standard', note: 'payé d’avance' }),
      privee,
      LE_JOUR,
    );
    expect(emission.entree).toMatchObject({
      produit: 'boutique',
      code: CODE,
      nom: 'LOVELEC',
      formule: 'standard',
      note: 'payé d’avance',
    });
    expect(emission.entree.expireLe).toBe('2027-08-20');
  });

  it('y range la clé elle-même, pour la renvoyer au client qui l’a perdue', async () => {
    const { privee } = await paireDeTest();
    const emission = await emitLicence(CAISSE, demande(), privee, LE_JOUR);
    expect(emission.entree.cle).toBe(emission.cle);
    expect(decodeLicence(emission.entree.cle)?.payload.n).toBe('LOVELEC');
  });

  it('sépare deux ventes du même client sur deux logiciels', async () => {
    const { privee } = await paireDeTest();
    const caisse = await emitLicence(CAISSE, demande(), privee, LE_JOUR);
    const boutique = await emitLicence(BOUTIQUE, demande({ formule: 'standard' }), privee, LE_JOUR);
    expect(caisse.entree.produit).not.toBe(boutique.entree.produit);
    expect(caisse.cle).not.toBe(boutique.cle);
    // Même code d'installation, deux clés distinctes : chacune n'ouvre que son
    // logiciel.
    expect(caisse.entree.code).toBe(boutique.entree.code);
  });
});

describe('ancien nom de la formule', () => {
  it('accepte encore « segment », le temps que l’outil existant migre', () => {
    const charge = buildPayload(
      CAISSE,
      { code: CODE, nom: 'LOVELEC', segment: 'restaurant', mois: 12 },
      LE_JOUR,
    );
    expect(charge.s).toBe('restaurant');
    expect(charge.f).toContain('restaurant');
  });

  it('donne la priorité à « formule » si les deux sont là', () => {
    const charge = buildPayload(
      CAISSE,
      { code: CODE, nom: 'LOVELEC', formule: 'restaurant', segment: 'quincaillerie', mois: 12 },
      LE_JOUR,
    );
    expect(charge.s).toBe('restaurant');
  });
});

describe('l’émission et la vérification s’accordent', () => {
  it('une clé émise aujourd’hui pour un mois expire dans un mois, pas avant', async () => {
    const { privee, publique } = await paireDeTest();
    const emission = await emitLicence(
      CAISSE,
      demande({ mois: 1, code: installationCode('lovelec') }),
      privee,
      LE_JOUR,
    );
    const juger = (quand: string) =>
      verifyLicence(emission.cle, {
        publicKeySpki: publique,
        produit: CAISSE,
        companyId: 'lovelec',
        now: Date.parse(quand),
      });

    expect((await juger('2026-09-20T23:00:00Z')).state).toBe('valide');
    expect((await juger('2026-09-21T08:00:00Z')).state).toBe('grace');
  });

  it('la charge signée est exactement celle qu’on relit', async () => {
    const { privee } = await paireDeTest();
    const emission = await emitLicence(CAISSE, demande(), privee, LE_JOUR);
    expect(decodeLicence(emission.cle)?.payload).toEqual(emission.payload);
  });

  it('une clé de démonstration ouvre tout son produit et rien d’un autre', () => {
    const charge = buildPayload(BOUTIQUE, demande({ formule: 'essai' }), LE_JOUR);
    expect(charge.f).toEqual(BOUTIQUE.fonctions.map((fonction) => fonction.cle));
    expect(
      licenceState(charge, CAISSE, 'peu-importe', Date.parse('2026-09-01T00:00:00Z')).state,
    ).toBe('autre-produit');
  });
});
