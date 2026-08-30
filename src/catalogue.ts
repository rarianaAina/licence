import type { Produit } from './produit.js';
import { CAISSE } from './produits/caisse.js';
import { BOUTIQUE } from './produits/boutique.js';

/**
 * Les logiciels de l'éditeur.
 *
 * POURQUOI UN CATALOGUE COMMUN plutôt qu'un descripteur par dépôt. L'outil
 * d'émission doit pouvoir vendre n'importe lequel des logiciels sans qu'on
 * l'installe à côté de chacun d'eux ; il lui faut donc la liste entière, avec
 * les fonctions et les plafonds de chaque produit. Une application, elle,
 * n'importe que le sien — le catalogue ne pèse rien, ce ne sont que des noms.
 *
 * AJOUTER UN LOGICIEL : écrire son descripteur dans `produits/`, l'ajouter
 * ici, et lui faire vérifier sa licence avec ce descripteur. Rien d'autre. Le
 * format des clés ne bouge pas, la clé publique ne bouge pas, les licences
 * déjà émises ne bougent pas.
 */
export const PRODUITS: readonly Produit[] = [CAISSE, BOUTIQUE];

export const CATALOGUE: Record<string, Produit> = Object.fromEntries(
  PRODUITS.map((produit) => [produit.code, produit]),
);

/** Descripteur d'un code produit, ou `null` s'il est inconnu. */
export function produitPar(code: string): Produit | null {
  return CATALOGUE[code] ?? null;
}

/**
 * Nom présentable d'un code produit.
 *
 * Un code inconnu se rend tel quel plutôt que remplacé par « inconnu » : quand
 * un client lit sa clé au téléphone, le code brut nous dit s'il s'est trompé de
 * logiciel ou s'il a une clé plus récente que notre outil.
 */
export function nomDuProduit(code: string): string {
  return produitPar(code)?.nom ?? code;
}

export { CAISSE, BOUTIQUE };

/**
 * Les clés de fonctions de chaque produit, comme types.
 *
 * Une application les emploie plutôt que `string` : demander une fonction qui
 * n'existe pas devient une erreur de compilation, et non un module qui reste
 * fermé sans que personne comprenne pourquoi.
 */
export type { FonctionCaisse } from './produits/caisse.js';
export type { FonctionBoutique } from './produits/boutique.js';
