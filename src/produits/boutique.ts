import type { Produit } from '../produit.js';

/**
 * La gestion de boutique : smartphones, accessoires, matériel informatique.
 *
 * Ses fonctions portent des noms FRANÇAIS, contrairement à celles de la
 * caisse. Ce n'est pas une inconséquence : celles de la caisse sont figées par
 * les clés déjà vendues, celles-ci ne le sont pas encore. Le jour où un
 * troisième logiciel arrive, il nommera les siennes en français lui aussi.
 *
 * Le découpage suit les modules réellement séparables. Une fonction qui ne
 * correspond à rien qu'on puisse fermer proprement n'a pas sa place ici : une
 * licence qui promet une porte inexistante se retourne contre l'éditeur le jour
 * où le client demande à la voir.
 */
export const BOUTIQUE: Produit = {
  code: 'boutique',
  nom: 'Gestion de boutique',
  prefixe: 'BOUTIQUE',

  fonctions: [
    {
      cle: 'vente',
      libelle: 'Vente et stock',
      description:
        'Comptoir, tickets, factures, catalogue, suivi des appareils par IMEI. C’est le logiciel : toujours ouvert.',
      noyau: true,
    },
    {
      cle: 'apres-vente',
      libelle: 'Remboursements et échanges',
      description: 'Retours, avoirs, échanges d’appareils.',
    },
    {
      cle: 'achats',
      libelle: 'Achats',
      description:
        'Fournisseurs, commandes, réceptions, répartition des frais sur le coût de revient.',
    },
    { cle: 'clients', libelle: 'Clients', description: 'Fiches clients et historique d’achat.' },
    {
      cle: 'multiboutique',
      libelle: 'Multi-boutique',
      description: 'Plusieurs boutiques dans la même entreprise, et transferts entre elles.',
    },
    {
      cle: 'synchronisation',
      libelle: 'Synchronisation',
      description: 'Échange des ventes, du stock et des appareils entre boutiques distantes.',
    },
    {
      cle: 'rapports',
      libelle: 'Rapports',
      description: 'Ventes, marges, évolution des prix d’achat et de vente.',
    },
    {
      cle: 'import',
      libelle: 'Import Excel',
      description: 'Reprise du catalogue et du stock depuis des classeurs.',
    },
  ],

  quotas: [
    { cle: 'postes', libelle: 'Postes rattachés', defaut: 1, max: 999 },
    { cle: 'boutiques', libelle: 'Boutiques', defaut: 1, max: 999 },
    { cle: 'utilisateurs', libelle: 'Comptes utilisateurs', defaut: 3, max: 999 },
  ],

  formules: {
    solo: {
      libelle: 'Boutique seule',
      fonctions: ['vente', 'apres-vente', 'clients', 'import'],
      quotas: { postes: 1, boutiques: 1, utilisateurs: 3 },
    },
    standard: {
      libelle: 'Standard',
      fonctions: ['vente', 'apres-vente', 'achats', 'clients', 'rapports', 'import'],
      quotas: { postes: 2, boutiques: 1, utilisateurs: 6 },
    },
    reseau: {
      libelle: 'Réseau de boutiques',
      fonctions: [
        'vente',
        'apres-vente',
        'achats',
        'clients',
        'multiboutique',
        'synchronisation',
        'rapports',
        'import',
      ],
      quotas: { postes: 6, boutiques: 3, utilisateurs: 20 },
    },
    essai: {
      libelle: 'Essai — tout ouvert',
      fonctions: [
        'vente',
        'apres-vente',
        'achats',
        'clients',
        'multiboutique',
        'synchronisation',
        'rapports',
        'import',
      ],
    },
  },

  essaiJours: 30,
  graceJours: 15,
};
