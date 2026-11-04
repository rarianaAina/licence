import type { Produit } from '../produit.js';

/**
 * Bureo : le bureau d'un indépendant ou d'une PME sur Windows — factures et pro
 * forma, agenda, notes et rappels, mails, coffre à mots de passe.
 *
 * UNE SEULE FONCTION, ET AUCUN PLAFOND : Bureo se vend tout compris.
 *
 * BUREO S'ACHÈTE UNE FOIS, ET L'ÉCHÉANCE N'A PAS LE MÊME SENS QU'AILLEURS.
 * Pour la caisse ou APPLIVE, `e` est le dernier jour où le logiciel s'ouvre.
 * Pour Bureo, `e` est le dernier jour des MISES À JOUR COMPRISES : la clé reste
 * valable à vie pour toute version publiée jusqu'à cette date, et Bureo ne
 * propose plus les versions publiées après. Le client garde ce qu'il a payé ;
 * il rachète, s'il le veut, une nouvelle année de nouveautés. `--mois 12` à
 * l'émission donne donc « à vie, mises à jour pendant un an ».
 *
 * D'où `graceJours: 0` : il n'y a pas de blocage à adoucir.
 *
 * Bureo n'est pas écrit en TypeScript : il vérifie les clés en Python
 * (`bureo/licence.py`), avec la même clé publique, le même code d'installation
 * au bit près, et refuse ce qui ne nomme pas `bureo`.
 */
export const BUREO = {
  code: 'bureo',
  nom: 'Bureo',
  prefixe: 'BUREO',

  fonctions: [
    {
      cle: 'bureau',
      libelle: 'Bureau complet',
      description:
        'Factures et pro forma, clients, agenda, notes et rappels, mails, coffre à mots de passe. C’est le logiciel : toujours ouvert.',
      noyau: true,
    },
  ],

  quotas: [],

  formules: {
    standard: {
      libelle: 'Standard — à vie, mises à jour comprises pendant la durée choisie',
      fonctions: ['bureau'],
    },
    essai: {
      libelle: 'Essai — tout ouvert',
      fonctions: ['bureau'],
    },
  },

  essaiJours: 14,
  graceJours: 0,
} as const satisfies Produit;

/** Clés des fonctions de ce produit, comme type. */
export type FonctionBureo = (typeof BUREO)['fonctions'][number]['cle'];
