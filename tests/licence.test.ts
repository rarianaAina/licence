import { describe, expect, it } from 'vitest';
import {
  BOUTIQUE,
  CAISSE,
  LICENCE_PUBLIC_KEY,
  LICENCE_VERSION,
  decodeLicence,
  installationCode,
  judgeClock,
  licenceAllows,
  licenceBlocks,
  licenceQuota,
  licenceState,
  normaliserCharge,
  quota,
  trialStatus,
  verifyLicence,
  type LicencePayload,
} from '../src/index.js';
import { emettreDeTest, paireDeTest } from './helpers/signature.js';

const JOUR = 86_400_000;
const LE = (iso: string) => Date.parse(`${iso}T12:00:00.000Z`);

/** Charge minimale, valable, qu'on déforme test par test. */
function charge(modifications: Partial<LicencePayload> = {}): LicencePayload {
  return {
    v: LICENCE_VERSION,
    p: 'caisse',
    c: installationCode('entreprise-1'),
    n: 'LOVELEC',
    s: 'quincaillerie',
    f: ['sale', 'purchasing'],
    q: { caisses: 3, boutiques: 1 },
    i: '2026-01-01',
    e: '2027-01-01',
    ...modifications,
  };
}

describe('code d’installation', () => {
  it('est stable, court et lisible au téléphone', () => {
    const code = installationCode('11111111-2222-3333-4444-555555555555');
    expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(installationCode('11111111-2222-3333-4444-555555555555')).toBe(code);
  });

  it('ne dépend pas de la casse', () => {
    expect(installationCode('ABC-DEF')).toBe(installationCode('abc-def'));
  });

  it('sépare deux entreprises', () => {
    const codes = new Set(
      Array.from({ length: 500 }, (_, index) => installationCode(`entreprise-${index}`)),
    );
    expect(codes.size).toBe(500);
  });
});

describe('état d’une licence authentifiée', () => {
  it('accepte une clé en cours de validité', () => {
    const statut = licenceState(charge(), CAISSE, 'entreprise-1', LE('2026-06-01'));
    expect(statut.state).toBe('valide');
    expect(statut.daysLeft).toBeGreaterThan(0);
  });

  it('compte le dernier jour comme valide', () => {
    // Une clé qui expire le 31 vaut TOUT le 31 : la couper à midi ferait
    // fermer un commerce en pleine journée.
    const statut = licenceState(
      charge({ e: '2026-06-01' }),
      CAISSE,
      'entreprise-1',
      LE('2026-06-01'),
    );
    expect(statut.state).toBe('valide');
    expect(statut.daysLeft).toBe(1);
  });

  it('passe en grâce le lendemain de l’échéance', () => {
    const statut = licenceState(
      charge({ e: '2026-06-01' }),
      CAISSE,
      'entreprise-1',
      LE('2026-06-02'),
    );
    expect(statut.state).toBe('grace');
    // Le premier jour de grâce n'en consomme aucun : le commerçant dispose
    // bien des quinze jours annoncés, pas de quatorze.
    expect(statut.daysLeft).toBe(0);
    expect(statut.graceLeft).toBe(CAISSE.graceJours);
  });

  it('expire une fois la grâce écoulée', () => {
    const apres = new Date(LE('2026-06-01') + (CAISSE.graceJours + 1) * JOUR).getTime();
    expect(licenceState(charge({ e: '2026-06-01' }), CAISSE, 'entreprise-1', apres).state).toBe(
      'expiree',
    );
  });

  it('refuse la clé d’une autre entreprise, en nommant l’installation attendue', () => {
    const statut = licenceState(charge(), CAISSE, 'entreprise-2', LE('2026-06-01'));
    expect(statut.state).toBe('autre-entreprise');
    // Sans ce détail, le commerçant ne peut pas comprendre qu'il a collé la
    // clé de son voisin.
    expect(statut.reason).toContain(installationCode('entreprise-1'));
  });

  it('refuse une date illisible plutôt que de la deviner', () => {
    const statut = licenceState(charge({ e: 'bientôt' }), CAISSE, 'entreprise-1', LE('2026-06-01'));
    expect(statut.state).toBe('invalide');
  });
});

describe('cloisonnement entre logiciels', () => {
  /**
   * C'est LA raison d'être de la version 2. En version 1, la charge ne disait
   * pas pour quel logiciel elle avait été émise : au deuxième produit, une clé
   * de caisse ouvrait la boutique.
   */
  it('refuse dans la boutique une clé émise pour la caisse', () => {
    const statut = licenceState(charge(), BOUTIQUE, 'entreprise-1', LE('2026-06-01'));
    expect(statut.state).toBe('autre-produit');
    expect(licenceBlocks(statut)).toBe(true);
  });

  it('nomme le logiciel attendu et celui de la clé', () => {
    const statut = licenceState(charge(), BOUTIQUE, 'entreprise-1', LE('2026-06-01'));
    expect(statut.reason).toContain('caisse');
    expect(statut.reason).toContain(BOUTIQUE.nom);
  });

  it('juge le produit AVANT l’entreprise et l’échéance', () => {
    // À qui a collé la clé d'un autre logiciel, on ne parle pas d'une date
    // d'expiration qui ne le concerne pas.
    const vieille = charge({ e: '2020-01-01' });
    const statut = licenceState(vieille, BOUTIQUE, 'autre-entreprise', LE('2026-06-01'));
    expect(statut.state).toBe('autre-produit');
  });

  it('accepte dans la boutique une clé émise pour la boutique', () => {
    const statut = licenceState(
      charge({ p: 'boutique', f: ['vente'], q: { postes: 2 } }),
      BOUTIQUE,
      'entreprise-1',
      LE('2026-06-01'),
    );
    expect(statut.state).toBe('valide');
  });
});

describe('clés de version 1', () => {
  /**
   * Une clé déjà chez un client ne doit jamais cesser de fonctionner à cause
   * d'un changement de format décidé chez l'éditeur.
   */
  const v1 = {
    v: 1 as const,
    c: installationCode('entreprise-1'),
    n: 'LOVELEC',
    s: 'quincaillerie',
    f: ['sale', 'purchasing', 'customers'],
    r: 3,
    b: 1,
    i: '2026-08-20',
    e: '2027-08-20',
  };

  it('les lit comme des clés de caisse', () => {
    const normalisee = normaliserCharge(v1);
    expect(normalisee.p).toBe('caisse');
    expect(normalisee.v).toBe(1);
  });

  it('rend leurs plafonds sous leurs vrais noms', () => {
    const normalisee = normaliserCharge(v1);
    expect(normalisee.q).toEqual({ caisses: 3, boutiques: 1 });
    expect(quota(normalisee, 'caisses')).toBe(3);
  });

  it('les accepte encore dans la caisse', () => {
    expect(licenceState(normaliserCharge(v1), CAISSE, 'entreprise-1', LE('2027-01-01')).state).toBe(
      'valide',
    );
  });

  it('les refuse dans la boutique', () => {
    expect(
      licenceState(normaliserCharge(v1), BOUTIQUE, 'entreprise-1', LE('2027-01-01')).state,
    ).toBe('autre-produit');
  });
});

describe('plafonds', () => {
  it('lit un plafond nommé', () => {
    expect(quota(charge(), 'caisses')).toBe(3);
  });

  it('retient « un seul » quand la clé se tait', () => {
    // Le silence se lit toujours dans le sens le plus prudent : une clé muette
    // sur les postes ne doit pas en ouvrir mille.
    expect(quota(charge({ q: {} }), 'postes')).toBe(1);
    expect(quota(null, 'postes')).toBe(1);
  });

  it('ignore une valeur absurde', () => {
    expect(quota(charge({ q: { caisses: 0 } }), 'caisses')).toBe(1);
    expect(quota(charge({ q: { caisses: Number.NaN } }), 'caisses')).toBe(1);
  });

  it('rend le repli du produit quand la licence est bloquée', () => {
    const statut = licenceState(
      charge({ e: '2020-01-01' }),
      CAISSE,
      'entreprise-1',
      LE('2026-06-01'),
    );
    expect(statut.state).toBe('expiree');
    expect(licenceQuota(statut, 'caisses', 1)).toBe(1);
  });
});

describe('ce que la licence ouvre', () => {
  const valide = () => licenceState(charge(), CAISSE, 'entreprise-1', LE('2026-06-01'));

  it('ouvre les fonctions vendues, et elles seules', () => {
    expect(licenceAllows(valide(), 'sale')).toBe(true);
    expect(licenceAllows(valide(), 'restaurant')).toBe(false);
  });

  it('les laisse ouvertes pendant la grâce', () => {
    const statut = licenceState(
      charge({ e: '2026-06-01' }),
      CAISSE,
      'entreprise-1',
      LE('2026-06-02'),
    );
    expect(statut.state).toBe('grace');
    expect(licenceAllows(statut, 'sale')).toBe(true);
    expect(licenceBlocks(statut)).toBe(false);
  });

  it('ferme tout une fois expirée', () => {
    const apres = new Date(LE('2026-06-01') + 60 * JOUR).getTime();
    const statut = licenceState(charge({ e: '2026-06-01' }), CAISSE, 'entreprise-1', apres);
    expect(licenceAllows(statut, 'sale')).toBe(false);
    expect(licenceBlocks(statut)).toBe(true);
  });
});

describe('période d’essai', () => {
  it('ouvre TOUTES les fonctions du produit', () => {
    // On ne fait pas essayer un logiciel amputé.
    const statut = trialStatus('2026-06-01', BOUTIQUE, LE('2026-06-10'));
    expect(statut.state).toBe('valide');
    expect(statut.payload?.f).toEqual(BOUTIQUE.fonctions.map((fonction) => fonction.cle));
    expect(statut.payload?.p).toBe('boutique');
  });

  it('respecte la durée déclarée par le produit', () => {
    const statut = trialStatus('2026-06-01', CAISSE, LE('2026-06-10'));
    expect(statut.daysLeft).toBe(CAISSE.essaiJours - 9);
  });

  it('n’accorde aucune grâce à son terme', () => {
    // La grâce protège un client qui PAIE déjà et dont le renouvellement a
    // pris du retard, pas quelqu'un qui n'a rien acheté.
    const apres = new Date(LE('2026-06-01') + (CAISSE.essaiJours + 1) * JOUR).getTime();
    const statut = trialStatus('2026-06-01', CAISSE, apres);
    expect(statut.state).toBe('expiree');
    expect(statut.graceLeft).toBe(0);
  });

  it('ne prétend rien d’une date d’installation illisible', () => {
    expect(trialStatus('jamais', CAISSE, LE('2026-06-01')).state).toBe('absente');
  });
});

describe('horloge du poste', () => {
  const maintenant = LE('2026-06-01');

  it('fait confiance à une horloge qui avance normalement', () => {
    const verdict = judgeClock(maintenant, maintenant - 3 * JOUR);
    expect(verdict.effective).toBe(maintenant);
    expect(verdict.suspect).toBe(false);
  });

  it('ne croit pas une horloge qu’on recule', () => {
    // Sans cliquet, reculer la date du poste prolongerait une licence échue.
    const verdict = judgeClock(maintenant - 30 * JOUR, maintenant);
    expect(verdict.effective).toBe(maintenant);
    expect(verdict.ratchet).toBe(maintenant);
    expect(verdict.suspect).toBe(true);
  });

  it('n’empoisonne pas le cliquet avec un bond invraisemblable', () => {
    // Pile morte, BIOS à zéro, poste qui annonce 2038 : sans cette borne, le
    // cliquet retiendrait 2038 et bloquerait DÉFINITIVEMENT un commerçant en
    // règle, même après réparation.
    const verdict = judgeClock(maintenant + 3650 * JOUR, maintenant);
    expect(verdict.ratchet).toBe(maintenant);
    expect(verdict.effective).toBe(maintenant);
    expect(verdict.suspect).toBe(true);
  });

  it('part de l’horloge du poste au tout premier démarrage', () => {
    expect(judgeClock(maintenant, null).effective).toBe(maintenant);
    expect(judgeClock(maintenant, null).suspect).toBe(false);
  });
});

describe('décodage', () => {
  it('refuse ce qui n’a pas la forme d’une clé', () => {
    expect(decodeLicence('bonjour')).toBeNull();
    expect(decodeLicence('A.B')).toBeNull();
    expect(decodeLicence('caisse.eyJ9.xx')).toBeNull();
  });

  it('accepte une clé coupée en deux par un courriel', async () => {
    const { privee } = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, privee, { code: installationCode('entreprise-1') });
    const coupee = `${cle.slice(0, 40)}\n  ${cle.slice(40)}`;
    expect(decodeLicence(coupee)?.payload.n).toBe(decodeLicence(cle)?.payload.n);
  });

  it('conserve les octets signés tels qu’ils ont été lus', async () => {
    // Ré-sérialiser la charge pour vérifier la signature invaliderait des clés
    // parfaitement valides : deux moteurs JSON n'ordonnent pas les champs
    // pareil.
    const { privee } = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, privee, { code: installationCode('entreprise-1') });
    const decodee = decodeLicence(cle)!;
    const reserialisee = new TextEncoder().encode(JSON.stringify(decodee.payload));
    expect(decodee.signed.length).toBe(reserialisee.length);
  });
});

describe('vérification complète', () => {
  it('accepte une clé authentique', async () => {
    const { privee, publique } = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, privee, { code: installationCode('entreprise-1') });
    const statut = await verifyLicence(cle, {
      publicKeySpki: publique,
      produit: CAISSE,
      companyId: 'entreprise-1',
      now: LE('2026-06-01'),
    });
    expect(statut.state).toBe('valide');
  });

  it('refuse une clé signée par quelqu’un d’autre', async () => {
    const editeur = await paireDeTest();
    const faussaire = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, faussaire.privee, {
      code: installationCode('entreprise-1'),
    });
    const statut = await verifyLicence(cle, {
      publicKeySpki: editeur.publique,
      produit: CAISSE,
      companyId: 'entreprise-1',
      now: LE('2026-06-01'),
    });
    expect(statut.state).toBe('invalide');
    expect(statut.reason).toContain('émise par l’éditeur');
  });

  it('refuse une charge modifiée après signature', async () => {
    const { privee, publique } = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, privee, { code: installationCode('entreprise-1') });
    const [prefixe, , signature] = cle.split('.');
    const trafiquee = { ...decodeLicence(cle)!.payload, e: '2099-01-01' };
    const chargeFalsifiee = btoa(JSON.stringify(trafiquee))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const statut = await verifyLicence(`${prefixe}.${chargeFalsifiee}.${signature}`, {
      publicKeySpki: publique,
      produit: CAISSE,
      companyId: 'entreprise-1',
      now: LE('2026-06-01'),
    });
    expect(statut.state).toBe('invalide');
  });

  it('dit « absente » quand rien n’a été saisi', async () => {
    const statut = await verifyLicence('', {
      publicKeySpki: LICENCE_PUBLIC_KEY,
      produit: CAISSE,
      companyId: 'entreprise-1',
    });
    expect(statut.state).toBe('absente');
    expect(licenceBlocks(statut)).toBe(true);
  });

  it('ne se plaint pas d’une clé publique illisible autrement qu’en refusant', async () => {
    const { privee } = await paireDeTest();
    const cle = await emettreDeTest(CAISSE, privee, { code: installationCode('entreprise-1') });
    const statut = await verifyLicence(cle, {
      publicKeySpki: 'pas une clé',
      produit: CAISSE,
      companyId: 'entreprise-1',
    });
    expect(statut.state).toBe('invalide');
  });
});
