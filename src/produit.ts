/**
 * Descripteur d'un logiciel vendu.
 *
 * POURQUOI IL EXISTE. La version 1 gravait dans le format les fonctions et les
 * plafonds d'un seul logiciel : `sale`, `restaurant`, `balance`, un nombre de
 * caisses, un nombre de boutiques. Ajouter un deuxième produit aurait signifié
 * ajouter ses fonctions à la même liste, et laisser chaque application décider
 * lesquelles la concernent — c'est-à-dire ne rien décider du tout.
 *
 * Chaque produit décrit donc lui-même ce qu'il vend. Le format de clé, lui,
 * ne connaît que des chaînes et des nombres : il ne changera plus au prochain
 * logiciel.
 *
 * CE QUI NE DOIT JAMAIS CHANGER dans un descripteur déjà exploité :
 *   — `code`, qui est écrit dans chaque clé émise ;
 *   — la clé d'une fonction ou d'un plafond déjà vendu, sous peine de fermer
 *     une porte que le client a payée.
 * Le libellé, la description, l'ordre et les formules se remanient librement :
 * aucune clé ne les référence.
 */

/** Une fonction vendable, telle qu'elle se présente à l'éditeur. */
export interface Fonction {
  /** Identifiant écrit dans la clé. Immuable une fois vendu. */
  cle: string;
  libelle: string;
  /** Ce que le client obtient. Sert l'outil d'émission, pas le logiciel. */
  description: string;
  /**
   * Fonction indispensable, toujours incluse.
   *
   * Vendre un logiciel de caisse sans la vente n'a pas de sens : le noyau est
   * ajouté d'office à toute formule, et l'outil d'émission ne permet pas de le
   * retirer.
   */
  noyau?: boolean;
}

/** Un plafond nommé : postes, boutiques, utilisateurs… */
export interface Quota {
  cle: string;
  libelle: string;
  /** Valeur retenue quand la clé n'en dit rien. Prudente par construction. */
  defaut: number;
  /** Borne haute acceptée à l'émission, pour attraper une faute de frappe. */
  max: number;
}

/**
 * Raccourci d'émission : un nom commercial et ce qu'il ouvre.
 *
 * La clé transporte la LISTE de fonctions, jamais le nom de la formule.
 * Remanier une formule n'invalide donc aucune clé déjà émise, et un client
 * peut recevoir une combinaison qui ne porte aucun nom.
 */
export interface Formule {
  libelle: string;
  fonctions: string[];
  /** Plafonds proposés d'office. L'éditeur les corrige à la vente. */
  quotas?: Record<string, number>;
}

export interface Produit {
  /** Écrit dans chaque clé. Immuable. */
  code: string;
  /** Nom commercial, affiché partout. */
  nom: string;
  /** En-tête des clés : `CAISSE`, `BOUTIQUE`… Majuscules et chiffres. */
  prefixe: string;
  fonctions: Fonction[];
  quotas: Quota[];
  formules: Record<string, Formule>;
  /** Durée de la période d'essai, en jours. */
  essaiJours: number;
  /** Délai de grâce après l'échéance, en jours. */
  graceJours: number;
}

/** Clés des fonctions du produit. */
export function fonctionsDe(produit: Produit): string[] {
  return produit.fonctions.map((fonction) => fonction.cle);
}

/** Fonctions toujours incluses, quelle que soit la formule. */
export function noyauDe(produit: Produit): string[] {
  return produit.fonctions.filter((fonction) => fonction.noyau).map((fonction) => fonction.cle);
}

/**
 * Fonctions d'une formule, noyau compris et doublons écartés.
 *
 * L'ordre suit celui du descripteur et non celui de la formule : deux clés
 * portant les mêmes fonctions doivent se ressembler, sans quoi les comparer à
 * l'œil au téléphone devient un exercice.
 */
export function fonctionsDeFormule(produit: Produit, formule: string): string[] | null {
  const trouvee = produit.formules[formule];
  if (!trouvee) return null;
  const retenues = new Set([...noyauDe(produit), ...trouvee.fonctions]);
  return fonctionsDe(produit).filter((cle) => retenues.has(cle));
}

/** Plafonds par défaut d'un produit, ou ceux que la formule propose. */
export function quotasDeFormule(produit: Produit, formule: string): Record<string, number> {
  const proposes = produit.formules[formule]?.quotas ?? {};
  return Object.fromEntries(
    produit.quotas.map((plafond) => [plafond.cle, proposes[plafond.cle] ?? plafond.defaut]),
  );
}

/**
 * Ce qui rend un descripteur inutilisable.
 *
 * Vérifié par les épreuves plutôt qu'au démarrage : un descripteur est du code,
 * pas une saisie. Le fauter se voit à l'intégration, jamais chez le client.
 */
export function problemeDescripteur(produit: Produit): string | null {
  if (!/^[a-z0-9-]+$/.test(produit.code)) {
    return `Code produit invalide : ${produit.code}. Minuscules, chiffres et tirets.`;
  }
  if (!/^[A-Z0-9]+$/.test(produit.prefixe)) {
    return `Préfixe invalide : ${produit.prefixe}. Majuscules et chiffres, sans tiret — le tiret sépare le préfixe du numéro de version.`;
  }
  if (produit.fonctions.length === 0) return `${produit.nom} ne vend aucune fonction.`;

  const vues = new Set<string>();
  for (const fonction of produit.fonctions) {
    if (!/^[a-z0-9-]+$/.test(fonction.cle)) {
      return `Fonction invalide : ${fonction.cle}. Minuscules, chiffres et tirets.`;
    }
    if (vues.has(fonction.cle)) return `Fonction en double : ${fonction.cle}.`;
    vues.add(fonction.cle);
  }

  const plafonds = new Set<string>();
  for (const plafond of produit.quotas) {
    if (plafonds.has(plafond.cle)) return `Plafond en double : ${plafond.cle}.`;
    if (plafond.defaut < 1 || plafond.defaut > plafond.max) {
      return `Plafond ${plafond.cle} : le défaut doit tenir entre 1 et ${plafond.max}.`;
    }
    plafonds.add(plafond.cle);
  }

  for (const [nom, formule] of Object.entries(produit.formules)) {
    for (const cle of formule.fonctions) {
      if (!vues.has(cle)) return `La formule ${nom} ouvre une fonction inconnue : ${cle}.`;
    }
    for (const cle of Object.keys(formule.quotas ?? {})) {
      if (!plafonds.has(cle)) return `La formule ${nom} fixe un plafond inconnu : ${cle}.`;
    }
  }

  if (produit.essaiJours < 0) return `${produit.nom} : durée d’essai négative.`;
  if (produit.graceJours < 0) return `${produit.nom} : délai de grâce négatif.`;
  return null;
}
