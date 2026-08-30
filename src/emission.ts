import { LICENCE_VERSION, encodeLicence, prefixePour, type LicencePayload } from './licence.js';
import { fonctionsDe, fonctionsDeFormule, noyauDe, quotasDeFormule } from './produit.js';
import type { Produit } from './produit.js';
import type { RegistreEntry } from './trousseau.js';

/**
 * Émission d'une clé d'activation : les règles, sans aucune entrée-sortie.
 *
 * POURQUOI C'EST ICI ET PAS DANS L'OUTIL. Plusieurs chemins émettent des
 * licences — l'application de bureau, la ligne de commande, et les épreuves.
 * Faire vivre trois fois la même validation et le même calcul d'échéance, c'est
 * se garantir qu'un jour l'un sera corrigé et pas les autres, et qu'une clé
 * émise par le mauvais chemin sera mal formée sans que personne le sache avant
 * le client qui l'a payée.
 *
 * Ce fichier ne touche ni au disque ni à la clé privée : il construit la charge
 * et la valide. La signature demande une `CryptoKey`, que l'appelant a obtenue
 * du trousseau ; elle n'apparaît jamais ici.
 */

/** Refus attendu — se montre à l'éditeur, ne mérite pas de pile d'appels. */
export class EmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmissionError';
  }
}

export interface EmissionRequest {
  /** Code d'installation dicté par le client. */
  code: string;
  nom: string;
  /** Formule vendue. `segment` est accepté comme ancien nom. */
  formule?: string;
  /** @deprecated Ancien nom de `formule`, conservé pour l'outil existant. */
  segment?: string;
  mois: number | string;
  /** Fonctions choisies à la main. À défaut, celles de la formule. */
  fonctions?: readonly string[] | null;
  /** Plafonds choisis à la main. À défaut, ceux de la formule. */
  quotas?: Record<string, number | string> | null;
  note?: string | null;
}

/**
 * Ajoute des mois à une date, en BORNANT au dernier jour du mois d'arrivée.
 *
 * `setMonth` ne borne pas, il déborde : le 31 janvier + 1 mois lui donne un
 * « 31 février », qu'il reporte au 3 mars. Une licence d'un mois vendue le 31
 * janvier vaudrait alors jusqu'au 3 mars, et le 29 février + 12 mois tomberait
 * au 1er mars suivant. Ce sont des jours donnés par accident — peu, mais donnés
 * sans qu'on l'ait décidé, et impossibles à expliquer au client qui compare deux
 * factures.
 */
export function addMonths(depart: Date, mois: number): Date {
  const quantieme = depart.getUTCDate();
  const arrivee = new Date(depart);
  // On passe par le 1er : sans cela, le seul changement de mois pourrait déjà
  // déborder avant qu'on ait rétabli le quantième.
  arrivee.setUTCDate(1);
  arrivee.setUTCMonth(arrivee.getUTCMonth() + mois);

  const dernierJour = new Date(
    Date.UTC(arrivee.getUTCFullYear(), arrivee.getUTCMonth() + 1, 0),
  ).getUTCDate();
  arrivee.setUTCDate(Math.min(quantieme, dernierJour));
  return arrivee;
}

const entierPositif = (
  valeur: number | string | null | undefined,
  defaut: number,
  max: number,
  etiquette: string,
): number => {
  const n = valeur === undefined || valeur === null || valeur === '' ? defaut : Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new EmissionError(`${etiquette} doit être un entier entre 1 et ${max}.`);
  }
  return n;
};

/**
 * Valide une demande et en tire la charge de la licence.
 *
 * Pure : c'est elle qui porte toutes les règles, et c'est elle que les épreuves
 * éprouvent. Une charge mal formée n'est découverte qu'au moment où le
 * commerçant, qui a déjà payé, tente d'activer son poste.
 */
export function buildPayload(
  produit: Produit,
  demande: EmissionRequest,
  maintenant: Date,
): LicencePayload {
  const code = String(demande.code ?? '')
    .toUpperCase()
    .trim();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)) {
    throw new EmissionError(
      'Code d’installation mal formé. Attendu douze signes hexadécimaux en trois groupes, ex. A1B2-C3D4-E5F6',
    );
  }

  const nom = String(demande.nom ?? '').trim();
  if (nom === '') throw new EmissionError('Le nom du commerce est obligatoire.');

  const formule = String(demande.formule ?? demande.segment ?? '');
  const demandees = demande.fonctions ?? null;
  const connues = fonctionsDe(produit);

  let fonctions: string[];
  if (demandees && demandees.length > 0) {
    for (const fonction of demandees) {
      if (!connues.includes(fonction)) {
        throw new EmissionError(
          `Fonction inconnue pour ${produit.nom} : ${fonction}. Connues : ${connues.join(', ')}`,
        );
      }
    }
    // Le noyau s'ajoute d'office : une caisse sans la vente, une boutique sans
    // le comptoir, ce serait un logiciel vendu fermé.
    const retenues = new Set([...noyauDe(produit), ...demandees]);
    fonctions = connues.filter((cle) => retenues.has(cle));
  } else {
    const parFormule = fonctionsDeFormule(produit, formule);
    if (!parFormule) {
      throw new EmissionError(
        `Formule inconnue pour ${produit.nom} : ${formule || '(vide)'}. Connues : ${Object.keys(
          produit.formules,
        ).join(', ')}`,
      );
    }
    fonctions = parFormule;
  }

  const mois = Number(demande.mois);
  if (!Number.isInteger(mois) || mois < 1 || mois > 120) {
    throw new EmissionError('La durée doit être un entier entre 1 et 120 mois.');
  }

  const proposes = quotasDeFormule(produit, formule);
  const saisis = demande.quotas ?? {};
  for (const cle of Object.keys(saisis)) {
    if (!produit.quotas.some((plafond) => plafond.cle === cle)) {
      throw new EmissionError(
        `Plafond inconnu pour ${produit.nom} : ${cle}. Connus : ${produit.quotas
          .map((plafond) => plafond.cle)
          .join(', ')}`,
      );
    }
  }
  const quotas: Record<string, number> = {};
  for (const plafond of produit.quotas) {
    quotas[plafond.cle] = entierPositif(
      saisis[plafond.cle],
      proposes[plafond.cle] ?? plafond.defaut,
      plafond.max,
      plafond.libelle,
    );
  }

  const jour = (date: Date): string => date.toISOString().slice(0, 10);

  return {
    v: LICENCE_VERSION,
    p: produit.code,
    c: code,
    n: nom,
    s: formule,
    f: fonctions,
    q: quotas,
    i: jour(maintenant),
    e: jour(addMonths(maintenant, mois)),
  };
}

/** Signe une charge et rend la clé transmissible au commerçant. */
export async function signPayload(
  payload: LicencePayload,
  produit: Produit,
  privee: CryptoKey,
): Promise<string> {
  // Les octets signés sont EXACTEMENT ceux qui voyageront dans la clé : une
  // seconde sérialisation pourrait ordonner les champs autrement, et la
  // signature ne vaudrait plus rien.
  const octets = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privee, octets),
  );
  return encodeLicence(payload, signature, prefixePour(produit));
}

export interface Emission {
  payload: LicencePayload;
  cle: string;
  entree: RegistreEntry;
}

/** Émet une clé et prépare son inscription au registre. */
export async function emitLicence(
  produit: Produit,
  demande: EmissionRequest,
  privee: CryptoKey,
  maintenant: Date,
): Promise<Emission> {
  const payload = buildPayload(produit, demande, maintenant);
  const cle = await signPayload(payload, produit, privee);

  return {
    payload,
    cle,
    entree: {
      emiseLe: maintenant.toISOString(),
      produit: produit.code,
      code: payload.c,
      nom: payload.n,
      formule: payload.s,
      fonctions: [...payload.f],
      quotas: { ...payload.q },
      expireLe: payload.e,
      note: String(demande.note ?? ''),
      // La clé figure au registre, et ce n'est pas un secret : c'est ce que le
      // client a reçu, et c'est ce qu'on lui renverra s'il la perd.
      cle,
    },
  };
}
