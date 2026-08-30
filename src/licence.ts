import type { Produit } from './produit.js';

/**
 * Clés d'activation, communes à tous les logiciels de l'éditeur.
 *
 * POURQUOI UNE SIGNATURE ET NON UN APPEL SERVEUR : ces logiciels sont
 * hors-ligne d'abord. Une licence qui devrait téléphoner pour être validée
 * trahirait tout le reste — une caisse coupée du réseau doit ouvrir, vendre et
 * encaisser. La clé est donc une charge SIGNÉE : l'éditeur détient la clé
 * privée, l'application embarque la publique, et la vérification est locale.
 * Aucune connexion n'est nécessaire, ni à l'installation, ni jamais.
 *
 * ECDSA P-256 plutôt qu'Ed25519 : WebCrypto le fournit à l'identique dans la
 * WebView Windows, dans WebKitGTK et dans Node ; Ed25519 n'y est pas encore
 * partout.
 *
 * CE QUI A CHANGÉ EN VERSION 2, ET POURQUOI C'ÉTAIT URGENT. La version 1 ne
 * disait pas POUR QUEL LOGICIEL la clé avait été émise. Tant qu'un seul
 * produit existait, cela ne se voyait pas ; au deuxième, une clé de caisse
 * ouvrait la boutique — le client paie une fois, reçoit tout. La charge nomme
 * donc son produit, et chaque application refuse ce qui ne la nomme pas.
 *
 * Les clés v1 déjà chez les clients restent valides : elles sont lues comme des
 * clés de caisse, ce qu'elles étaient. Aucune ne devient inutilisable.
 */

/* ─── La charge signée ─────────────────────────────────────────────────────*/

/** Version du format écrite dans les clés émises aujourd'hui. */
export const LICENCE_VERSION = 2;

/**
 * Contenu d'une clé.
 *
 * Les noms sont courts à dessein : la charge est encodée dans la clé
 * elle-même, et chaque caractère se retrouve dans ce que le commerçant doit
 * recopier ou dicter.
 */
export interface LicencePayload {
  /** Version du format. */
  v: number;
  /** Code du produit visé (`caisse`, `boutique`…). Absent en v1. */
  p: string;
  /** Code d'installation de l'entreprise (cf. `installationCode`). */
  c: string;
  /** Nom du commerce, pour l'afficher — jamais vérifié. */
  n: string;
  /** Formule vendue. Informatif : ce sont `f` et `q` qui font foi. */
  s: string;
  /** Fonctions ouvertes, propres au produit. */
  f: string[];
  /** Plafonds nommés : `{ caisses: 3, boutiques: 1 }`. */
  q: Record<string, number>;
  /** Date d'émission, AAAA-MM-JJ. */
  i: string;
  /** Dernier jour de validité, AAAA-MM-JJ inclus. */
  e: string;
}

/**
 * Charge de la version 1, telle qu'elle circule encore chez les clients.
 *
 * Conservée pour la LIRE, jamais pour en écrire. Ses deux plafonds étaient
 * ceux de la caisse, gravés dans le format ; c'est précisément ce qu'on ne
 * pouvait pas reconduire pour un logiciel qui compte des ateliers ou des
 * points de retrait.
 */
export interface LicencePayloadV1 {
  v: 1;
  c: string;
  n: string;
  s: string;
  f: string[];
  /** Nombre maximum de caisses. */
  r: number;
  /** Nombre maximum de boutiques. */
  b: number;
  i: string;
  e: string;
}

/** Produit auquel appartiennent les clés v1, qui n'en nommaient aucun. */
export const PRODUIT_HISTORIQUE = 'caisse';

/**
 * Ramène une charge lue à la forme courante.
 *
 * Le reste du code ne connaît donc qu'un seul format. Une v1 devient une clé
 * de caisse dont les plafonds reprennent leurs noms — `r` et `b` n'avaient de
 * sens que pour qui savait déjà de quel logiciel on parlait.
 */
export function normaliserCharge(brute: LicencePayload | LicencePayloadV1): LicencePayload {
  if (typeof (brute as LicencePayload).p === 'string' && (brute as LicencePayload).p !== '') {
    const charge = brute as LicencePayload;
    return { ...charge, f: [...(charge.f ?? [])], q: { ...(charge.q ?? {}) } };
  }
  const v1 = brute as LicencePayloadV1;
  return {
    v: 1,
    p: PRODUIT_HISTORIQUE,
    c: v1.c,
    n: v1.n,
    s: v1.s,
    f: [...(v1.f ?? [])],
    q: { caisses: Number(v1.r) || 1, boutiques: Number(v1.b) || 1 },
    i: v1.i,
    e: v1.e,
  };
}

/**
 * Plafond nommé, ou une valeur de repli.
 *
 * Un plafond ABSENT vaut « une seule » et non « illimité » : une clé muette
 * sur les postes ne doit pas en ouvrir mille. Le silence se lit toujours dans
 * le sens le plus prudent.
 */
export function quota(payload: LicencePayload | null, cle: string, defaut = 1): number {
  const valeur = payload?.q?.[cle];
  return Number.isFinite(valeur) && (valeur as number) > 0 ? (valeur as number) : defaut;
}

/* ─── Délais ───────────────────────────────────────────────────────────────*/

/**
 * Délai de grâce après l'échéance, par défaut.
 *
 * Pendant ces jours, tout fonctionne mais l'écran le dit sans ménagement.
 * Ce n'est pas de la générosité : une clé qui expire un samedi midi, sans
 * préavis et sans recours, coûte un client et sa recommandation.
 *
 * Chaque produit peut l'allonger — un logiciel qu'on n'ouvre qu'une fois par
 * semaine a besoin de plus de marge qu'une caisse ouverte tous les jours.
 */
export const LICENCE_GRACE_DAYS = 15;

/** À partir de ce nombre de jours restants, on commence à prévenir. */
export const LICENCE_WARN_DAYS = 30;

/**
 * Période d'essai, à compter de la création du commerce sur le poste.
 *
 * POURQUOI ELLE EXISTE : sans elle, une installation neuve serait bloquée
 * AVANT d'avoir pu créer son entreprise — donc avant même de connaître son
 * code d'installation, qu'il faut pourtant fournir pour obtenir une clé. Le
 * commerçant serait enfermé dehors par la porte qu'on lui demande d'ouvrir.
 *
 * Toutes les fonctions y sont ouvertes : on ne fait pas essayer un logiciel
 * amputé.
 */
export const LICENCE_TRIAL_DAYS = 30;

/* ─── Code d'installation ──────────────────────────────────────────────────*/

const HEX = '0123456789ABCDEF';

/**
 * Code court et lisible dérivé de l'identifiant d'entreprise.
 *
 * C'est ce que le commerçant lit au téléphone pour obtenir sa clé. On ne lui
 * fait pas épeler un UUID de 36 caractères : douze signes en trois groupes se
 * dictent sans erreur.
 *
 * Dérivé par un mélange simple et NON cryptographique : il n'a rien à protéger,
 * il doit seulement être stable, court, et différent d'une entreprise à
 * l'autre. Le secret est dans la signature, pas ici.
 *
 * IL RESTE IDENTIQUE À CELUI DE LA VERSION 1, au bit près : le changer aurait
 * invalidé toutes les clés en circulation, puisque chacune porte le code
 * calculé le jour de la vente.
 */
export function installationCode(companyId: string): string {
  // FNV-1a sur 64 bits, replié en 48 bits : suffisant pour que deux entreprises
  // ne partagent pas un code, et reproductible partout sans dépendance.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of companyId.toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0;
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ((code << 3) | (h1 & 7)), 2246822519) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    const source = i < 6 ? h1 >>> (i * 4) : h2 >>> ((i - 6) * 4);
    out += HEX[source & 0xf];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

/* ─── Encodage ─────────────────────────────────────────────────────────────*/

const base64url = (bytes: Uint8Array): string => {
  let binaire = '';
  for (const octet of bytes) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64url = (texte: string): Uint8Array => {
  const complet = texte.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(complet.padEnd(Math.ceil(complet.length / 4) * 4, '='));
  return Uint8Array.from(binaire, (ch) => ch.charCodeAt(0));
};

/**
 * En-tête lisible d'une clé : `CAISSE-2`, `BOUTIQUE-2`…
 *
 * Il dit au commerçant, et à nous au téléphone, ce qu'il a entre les mains
 * avant même d'avoir décodé quoi que ce soit. Il ne remplace pas la
 * vérification du produit — un en-tête se retape à la main — il la rend
 * seulement lisible.
 */
export function prefixePour(produit: Produit, version: number = LICENCE_VERSION): string {
  return `${produit.prefixe}-${version}`;
}

export function encodeLicence(
  payload: LicencePayload,
  signature: Uint8Array,
  prefixe: string,
): string {
  const charge = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${prefixe}.${charge}.${base64url(signature)}`;
}

export interface DecodedLicence {
  payload: LicencePayload;
  /** En-tête lu dans la clé, tel quel. */
  prefixe: string;
  signature: Uint8Array;
  /** Octets exactement signés — à revérifier, jamais à reconstruire. */
  signed: Uint8Array;
}

/**
 * Découpe une clé sans rien vérifier.
 *
 * Les octets signés sont ceux LUS dans la clé, pas ceux qu'on obtiendrait en
 * ré-sérialisant l'objet : deux moteurs JSON n'ordonnent pas forcément les
 * clés pareil, et une signature valide deviendrait invalide au passage.
 *
 * L'en-tête n'est pas contrôlé ici. Il est décoratif : ce qui engage, c'est la
 * charge signée, et elle seule nomme le produit. Refuser sur l'en-tête
 * donnerait un message trompeur à qui a simplement mal recopié le début.
 */
export function decodeLicence(cle: string): DecodedLicence | null {
  // Les espaces et retours à la ligne sautent : la clé arrive collée depuis un
  // courriel ou un message, souvent coupée en deux.
  const propre = cle.replace(/\s+/g, '');
  const morceaux = propre.split('.');
  if (morceaux.length !== 3) return null;
  const prefixe = morceaux[0] ?? '';
  if (!/^[A-Z0-9]+-\d+$/.test(prefixe)) return null;

  try {
    const signed = fromBase64url(morceaux[1] ?? '');
    const brute = JSON.parse(new TextDecoder().decode(signed)) as LicencePayload;
    if (typeof brute !== 'object' || brute === null) return null;
    return {
      payload: normaliserCharge(brute),
      prefixe,
      signature: fromBase64url(morceaux[2] ?? ''),
      signed,
    };
  } catch {
    return null;
  }
}

/* ─── Vérification ─────────────────────────────────────────────────────────*/

export type LicenceState =
  | 'valide'
  /** Échue, mais dans le délai de grâce : tout fonctionne, l'écran alerte. */
  | 'grace'
  | 'expiree'
  /** Aucune clé saisie sur ce poste. */
  | 'absente'
  /** Format illisible, ou signature qui ne correspond pas. */
  | 'invalide'
  /** Clé authentique, mais émise pour une autre entreprise. */
  | 'autre-entreprise'
  /** Clé authentique, mais émise pour un autre logiciel de l'éditeur. */
  | 'autre-produit';

export interface LicenceStatus {
  state: LicenceState;
  payload: LicencePayload | null;
  /** Jours avant l'échéance ; négatif une fois échue. `null` sans clé lisible. */
  daysLeft: number | null;
  /** Jours restants avant le blocage, une fois en grâce. */
  graceLeft: number | null;
  /** Ce qui n'a pas été compris, pour l'afficher au commerçant. */
  reason?: string;
}

const jour = 86_400_000;

/** Minuit UTC du jour donné, pour comparer des dates sans heure. */
const auJour = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);

/**
 * État d'une licence déjà authentifiée.
 *
 * Séparé de la vérification de signature parce que celle-ci est asynchrone
 * (WebCrypto) et que ceci ne l'est pas : la règle métier reste éprouvable sans
 * clé ni cryptographie.
 *
 * L'ORDRE DES REFUS EST DÉLIBÉRÉ. Le produit d'abord, l'entreprise ensuite,
 * l'échéance en dernier : à qui a collé la clé d'un autre logiciel, on ne parle
 * pas d'une date d'expiration qui ne le concerne pas.
 */
export function licenceState(
  payload: LicencePayload,
  produit: Produit,
  companyId: string,
  now: number,
): LicenceStatus {
  if (payload.p !== produit.code) {
    return {
      state: 'autre-produit',
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: `Cette clé a été émise pour ${nommerProduit(payload.p)}, pas pour ${produit.nom}.`,
    };
  }

  if (payload.c !== installationCode(companyId)) {
    return {
      state: 'autre-entreprise',
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: `Cette clé a été émise pour l’installation ${payload.c}.`,
    };
  }

  const fin = auJour(payload.e);
  if (!Number.isFinite(fin)) {
    return {
      state: 'invalide',
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: 'Date illisible',
    };
  }

  // L'échéance est INCLUSE : une clé qui expire le 31 vaut tout le 31.
  const restants = Math.floor((fin + jour - auJour(new Date(now).toISOString())) / jour);
  if (restants > 0) return { state: 'valide', payload, daysLeft: restants, graceLeft: null };

  const graceLeft = (produit.graceJours ?? LICENCE_GRACE_DAYS) + restants;
  if (graceLeft > 0) return { state: 'grace', payload, daysLeft: restants, graceLeft };
  return { state: 'expiree', payload, daysLeft: restants, graceLeft: 0 };
}

/** Nom présentable d'un produit qu'on ne connaît pas forcément. */
function nommerProduit(code: string): string {
  return code && code.trim() !== '' ? `« ${code} »` : 'un autre logiciel';
}

export interface VerificationOptions {
  /** Clé publique de l'éditeur, en SPKI base64, embarquée dans l'application. */
  publicKeySpki: string;
  /** Produit qui vérifie. Une clé qui en nomme un autre est refusée. */
  produit: Produit;
  /** Identifiant d'entreprise de cette installation. */
  companyId: string;
  now?: number;
}

/**
 * Vérifie la signature, puis le produit, l'entreprise et l'échéance.
 *
 * La clé privée correspondante ne se trouve dans aucun dépôt de code — c'est
 * toute la sécurité du dispositif.
 */
export async function verifyLicence(
  cle: string | null,
  options: VerificationOptions,
): Promise<LicenceStatus> {
  const now = options.now ?? Date.now();
  if (!cle || cle.trim() === '') {
    return { state: 'absente', payload: null, daysLeft: null, graceLeft: null };
  }

  const decoded = decodeLicence(cle);
  if (!decoded) {
    return {
      state: 'invalide',
      payload: null,
      daysLeft: null,
      graceLeft: null,
      reason: 'Clé illisible : vérifiez qu’elle a été copiée en entier.',
    };
  }

  let authentique = false;
  try {
    const spki = fromBase64url(options.publicKeySpki.replace(/\+/g, '-').replace(/\//g, '_'));
    const key = await crypto.subtle.importKey(
      'spki',
      spki as unknown as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    authentique = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      decoded.signature as unknown as ArrayBuffer,
      decoded.signed as unknown as ArrayBuffer,
    );
  } catch {
    authentique = false;
  }

  if (!authentique) {
    return {
      state: 'invalide',
      payload: null,
      daysLeft: null,
      graceLeft: null,
      reason: 'Signature invalide : cette clé n’a pas été émise par l’éditeur.',
    };
  }

  return licenceState(decoded.payload, options.produit, options.companyId, now);
}

/**
 * État d'un poste sans clé, pendant sa période d'essai.
 *
 * `installedAt` est la date de création du commerce sur ce poste. Elle est
 * soumise au même cliquet d'horloge que le reste : reculer la date du poste ne
 * rallonge pas l'essai.
 */
export function trialStatus(installedAt: string, produit: Produit, now: number): LicenceStatus {
  const debut = auJour(installedAt);
  if (!Number.isFinite(debut)) {
    return { state: 'absente', payload: null, daysLeft: null, graceLeft: null };
  }

  const duree = produit.essaiJours ?? LICENCE_TRIAL_DAYS;
  const ecoules = Math.floor((auJour(new Date(now).toISOString()) - debut) / jour);
  const restants = duree - ecoules;

  const essai: LicencePayload = {
    v: LICENCE_VERSION,
    p: produit.code,
    c: '',
    n: 'Période d’essai',
    s: 'essai',
    f: produit.fonctions.map((fonction) => fonction.cle),
    q: Object.fromEntries(produit.quotas.map((plafond) => [plafond.cle, plafond.defaut])),
    i: installedAt.slice(0, 10),
    e: new Date(debut + duree * jour).toISOString().slice(0, 10),
  };

  if (restants > 0) return { state: 'valide', payload: essai, daysLeft: restants, graceLeft: null };
  // Pas de grâce après un essai : la grâce protège un client qui PAIE déjà et
  // dont le renouvellement a pris du retard, pas quelqu'un qui n'a rien acheté.
  return {
    state: 'expiree',
    payload: essai,
    daysLeft: restants,
    graceLeft: 0,
    reason: 'La période d’essai est terminée.',
  };
}

/* ─── Ce que la licence autorise ───────────────────────────────────────────*/

/** Les fonctions restent ouvertes tant qu'on n'est pas bloqué. */
export function licenceAllows(status: LicenceStatus, fonction: string): boolean {
  if (status.state !== 'valide' && status.state !== 'grace') return false;
  return status.payload?.f.includes(fonction) ?? false;
}

/** Plafond accordé par la licence en cours, ou le repli du produit. */
export function licenceQuota(status: LicenceStatus, cle: string, defaut = 1): number {
  if (status.state !== 'valide' && status.state !== 'grace') return defaut;
  return quota(status.payload, cle, defaut);
}

/** Vrai quand l'application doit se fermer aux usages autres que la vente. */
export function licenceBlocks(status: LicenceStatus): boolean {
  return (
    status.state === 'expiree' ||
    status.state === 'invalide' ||
    status.state === 'absente' ||
    status.state === 'autre-entreprise' ||
    status.state === 'autre-produit'
  );
}

/* ─── Horloge ──────────────────────────────────────────────────────────────*/

/**
 * Date de référence pour juger d'une échéance, à l'abri d'une horloge trafiquée.
 *
 * DEUX PIÈGES OPPOSÉS, et le second est le plus dangereux :
 *
 *  - reculer l'horloge prolongerait une licence échue. D'où le cliquet : on
 *    retient la date la plus avancée jamais vue, et on l'utilise si l'horloge
 *    revient en arrière ;
 *  - une horloge qui part en avant — pile morte, BIOS à zéro, poste qui
 *    annonce 2038 — empoisonnerait ce cliquet et BLOQUERAIT DÉFINITIVEMENT un
 *    commerçant parfaitement en règle, même après réparation. Le cliquet
 *    n'avance donc jamais d'un bond invraisemblable.
 */
export const RATCHET_MAX_JUMP_DAYS = 45;

export interface ClockVerdict {
  /** Date à employer pour juger la licence. */
  effective: number;
  /** Nouvelle valeur du cliquet à enregistrer. */
  ratchet: number;
  /** L'horloge du poste est suspecte : à signaler, sans rien bloquer. */
  suspect: boolean;
}

export function judgeClock(now: number, ratchet: number | null): ClockVerdict {
  if (ratchet === null || !Number.isFinite(ratchet)) {
    return { effective: now, ratchet: now, suspect: false };
  }
  if (now < ratchet) {
    // L'horloge a reculé : on ne la croit pas.
    return { effective: ratchet, ratchet, suspect: true };
  }
  if (now > ratchet + RATCHET_MAX_JUMP_DAYS * jour) {
    // Bond invraisemblable : on n'empoisonne pas le cliquet, et on juge sur
    // lui plutôt que sur une date manifestement fausse.
    return { effective: ratchet, ratchet, suspect: true };
  }
  return { effective: now, ratchet: now, suspect: false };
}
