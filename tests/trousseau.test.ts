import { describe, expect, it } from 'vitest';
import {
  TROUSSEAU_MAGIC,
  TROUSSEAU_MAGIC_V1,
  TrousseauError,
  importSigningKey,
  normaliserEntree,
  openTrousseau,
  passphraseProblem,
  sealTrousseau,
  type RegistreEntry,
  type TrousseauContent,
} from '../src/index.js';

/** PBKDF2 à 600 000 tours coûte une seconde par appel : les épreuves en font peu. */
const TOURS = 1_000;
const PHRASE = 'une phrase de passe honnête';

async function contenuDeTest(): Promise<TrousseauContent> {
  const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', paire.publicKey));
  let binaire = '';
  for (const octet of spki) binaire += String.fromCharCode(octet);

  return {
    clePrivee: await crypto.subtle.exportKey('jwk', paire.privateKey),
    clePublique: btoa(binaire),
    registre: [entree()],
  };
}

function entree(modifications: Partial<RegistreEntry> = {}): RegistreEntry {
  return {
    emiseLe: '2026-08-20T12:38:18.591Z',
    produit: 'caisse',
    code: '5889-FF08-54DA',
    nom: 'LOVELEC',
    formule: 'quincaillerie',
    fonctions: ['sale', 'purchasing', 'customers'],
    quotas: { caisses: 3, boutiques: 1 },
    expireLe: '2027-08-20',
    note: '',
    cle: 'CAISSE-1.xxx.yyy',
    ...modifications,
  };
}

describe('phrase de passe', () => {
  it('exige douze signes', () => {
    // C'est le seul rempart si le trousseau est égaré, et personne ne peut
    // limiter les tentatives : l'attaquant a le fichier et tout son temps.
    expect(passphraseProblem('court')).not.toBeNull();
    expect(passphraseProblem('123456789012')).toBeNull();
  });

  it('refuse de sceller sans elle', async () => {
    await expect(sealTrousseau(await contenuDeTest(), 'trop court', TOURS)).rejects.toThrow(
      TrousseauError,
    );
  });
});

describe('aller-retour', () => {
  it('rend exactement ce qu’on y a mis', async () => {
    const contenu = await contenuDeTest();
    const relu = await openTrousseau(await sealTrousseau(contenu, PHRASE, TOURS), PHRASE);
    expect(relu.clePublique).toBe(contenu.clePublique);
    expect(relu.registre).toEqual(contenu.registre);
  });

  it('rend une clé privée utilisable, mais non réexportable', async () => {
    const contenu = await contenuDeTest();
    const relu = await openTrousseau(await sealTrousseau(contenu, PHRASE, TOURS), PHRASE);
    const privee = await importSigningKey(relu.clePrivee);
    expect(privee.extractable).toBe(false);
    // Elle signe : c'est tout ce qu'on lui demande.
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privee,
      new TextEncoder().encode('essai'),
    );
    expect(signature.byteLength).toBeGreaterThan(0);
  });

  it('écrit un sel et un vecteur neufs à chaque scellement', async () => {
    // Réutiliser un IV avec AES-GCM et la même clé casse la confidentialité
    // des deux messages.
    const contenu = await contenuDeTest();
    const un = JSON.parse(await sealTrousseau(contenu, PHRASE, TOURS));
    const deux = JSON.parse(await sealTrousseau(contenu, PHRASE, TOURS));
    expect(un.cipher.iv).not.toBe(deux.cipher.iv);
    expect(un.kdf.salt).not.toBe(deux.kdf.salt);
    expect(un.data).not.toBe(deux.data);
  });

  it('relit un trousseau écrit avec un autre nombre de tours', async () => {
    // Le nombre d'itérations est LU DANS LE FICHIER : un trousseau écrit hier
    // doit rester ouvrable après que la recommandation aura changé.
    const contenu = await contenuDeTest();
    const scelle = await sealTrousseau(contenu, PHRASE, 2_000);
    expect(JSON.parse(scelle).kdf.iterations).toBe(2_000);
    await expect(openTrousseau(scelle, PHRASE)).resolves.toBeTruthy();
  });
});

describe('refus', () => {
  it('ne distingue pas mauvaise phrase et fichier altéré', async () => {
    // AES-GCM authentifie : rien ne permet de les distinguer, et on ne
    // prétend pas le savoir.
    const scelle = await sealTrousseau(await contenuDeTest(), PHRASE, TOURS);
    await expect(openTrousseau(scelle, 'une autre phrase de passe')).rejects.toThrow(
      /Aucun moyen de distinguer/,
    );
  });

  it('détecte une altération du texte chiffré', async () => {
    const scelle = JSON.parse(await sealTrousseau(await contenuDeTest(), PHRASE, TOURS));
    // Remplacer par un signe DIFFÉRENT : un « A » sur un « A » ne changerait rien.
    scelle.data = `${scelle.data.startsWith('A') ? 'B' : 'A'}${scelle.data.slice(1)}`;
    await expect(openTrousseau(JSON.stringify(scelle), PHRASE)).rejects.toThrow(TrousseauError);
  });

  it('refuse un fichier qui n’est pas un trousseau', async () => {
    await expect(openTrousseau('bonjour', PHRASE)).rejects.toThrow(/n’est pas un trousseau/);
    await expect(openTrousseau('{"magic":"AUTRE"}', PHRASE)).rejects.toThrow(/pas un trousseau/);
  });

  it('refuse un trousseau tronqué', async () => {
    const scelle = JSON.parse(await sealTrousseau(await contenuDeTest(), PHRASE, TOURS));
    delete scelle.cipher;
    await expect(openTrousseau(JSON.stringify(scelle), PHRASE)).rejects.toThrow(/tronqué/);
  });

  it('refuse un nombre de tours absurde', async () => {
    const scelle = JSON.parse(await sealTrousseau(await contenuDeTest(), PHRASE, TOURS));
    scelle.kdf.iterations = 1;
    await expect(openTrousseau(JSON.stringify(scelle), PHRASE)).rejects.toThrow(
      /dérivation invalides/,
    );
  });
});

describe('registre de version 1', () => {
  /** Entrée telle qu'elle était écrite quand un seul logiciel existait. */
  const v1 = {
    emiseLe: '2026-08-20T12:38:18.591Z',
    code: '5889-FF08-54DA',
    nom: 'LOVELEC',
    segment: 'quincaillerie',
    fonctions: ['sale', 'purchasing', 'customers'],
    caisses: 3,
    boutiques: 1,
    expireLe: '2027-08-20',
    note: '',
    cle: 'CAISSE-1.xxx.yyy',
  };

  it('devient une entrée de caisse, sans rien perdre', () => {
    expect(normaliserEntree(v1)).toEqual(entree());
  });

  it('laisse intacte une entrée déjà à jour', () => {
    expect(normaliserEntree(entree({ produit: 'boutique' }))).toEqual(
      entree({ produit: 'boutique' }),
    );
  });

  it('s’ouvre encore sous son ancien en-tête', async () => {
    // Le trousseau de l'éditeur est un fichier unique, souvent le seul
    // exemplaire : refuser de l'ouvrir lui ferait perdre son registre entier.
    const contenu = await contenuDeTest();
    const scelle = JSON.parse(await sealTrousseau({ ...contenu, registre: [] }, PHRASE, TOURS));
    scelle.magic = TROUSSEAU_MAGIC_V1;
    await expect(openTrousseau(JSON.stringify(scelle), PHRASE)).resolves.toBeTruthy();
  });

  it('est ramenée à la forme courante à l’ouverture', async () => {
    const contenu = await contenuDeTest();
    const scelle = await sealTrousseau(
      { ...contenu, registre: [v1 as unknown as RegistreEntry] },
      PHRASE,
      TOURS,
    );
    const relu = await openTrousseau(scelle, PHRASE);
    expect(relu.registre[0]?.produit).toBe('caisse');
    expect(relu.registre[0]?.quotas).toEqual({ caisses: 3, boutiques: 1 });
  });

  it('repasse en version 2 à la prochaine écriture', async () => {
    const contenu = await contenuDeTest();
    expect(JSON.parse(await sealTrousseau(contenu, PHRASE, TOURS)).magic).toBe(TROUSSEAU_MAGIC);
  });
});

describe('registre multi-produits', () => {
  it('garde côte à côte les ventes de deux logiciels au même client', async () => {
    const contenu = await contenuDeTest();
    const registre = [entree(), entree({ produit: 'boutique', formule: 'standard' })];
    const relu = await openTrousseau(
      await sealTrousseau({ ...contenu, registre }, PHRASE, TOURS),
      PHRASE,
    );
    expect(relu.registre.map((ligne) => ligne.produit)).toEqual(['caisse', 'boutique']);
  });
});
