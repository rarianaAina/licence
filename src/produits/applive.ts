import type { Produit } from '../produit.js';

/**
 * La boutique en ligne des produits présentés en live : catalogue public,
 * réservation, confirmation par WhatsApp ou Messenger, livraisons regroupées.
 *
 * UNE SEULE FONCTION, ET AUCUN PLAFOND. APPLIVE se vend à la durée, tout
 * compris : la licence ne dit qu'une chose, jusqu'à quand la boutique reste
 * ouverte. Découper plus tard reste possible sans toucher aux clés déjà
 * vendues — il suffira d'ajouter des fonctions ; `boutique-en-ligne`, elle,
 * restera le noyau et ne changera jamais de nom.
 *
 * Contrairement à la caisse et à MOBI STOCK, APPLIVE est un service en ligne :
 * la clé est vérifiée par le serveur, qui garde l'échéance de chaque boutique.
 * Le code d'installation est celui de la boutique, dérivé de son identifiant.
 */
export const APPLIVE = {
  code: 'applive',
  nom: 'APPLIVE',
  prefixe: 'APPLIVE',

  fonctions: [
    {
      cle: 'boutique-en-ligne',
      libelle: 'Boutique en ligne',
      description:
        'Catalogue public, réservation de 15 minutes, paiement à la livraison ou Mobile Money, administration. C’est le logiciel : toujours ouvert.',
      noyau: true,
    },
  ],

  quotas: [],

  formules: {
    standard: {
      libelle: 'Standard — tout compris',
      fonctions: ['boutique-en-ligne'],
    },
    essai: {
      libelle: 'Essai — tout ouvert',
      fonctions: ['boutique-en-ligne'],
    },
  },

  essaiJours: 30,
  graceJours: 15,
} as const satisfies Produit;

/** Clés des fonctions de ce produit, comme type. */
export type FonctionApplive = (typeof APPLIVE)['fonctions'][number]['cle'];
