import type { Produit } from '../produit.js';

/**
 * La caisse : le premier logiciel vendu, et le seul que connaissaient les
 * clés de version 1.
 *
 * Les clés de fonctions sont celles de l'origine — `sale`, `restaurant`,
 * `purchasing`… — et le resteront : elles sont écrites dans chaque clé déjà
 * chez un client. Les renommer en français aurait fermé, du jour au lendemain,
 * des fonctions que ces clients ont payées.
 *
 * De même, les plafonds s'appellent `caisses` et `boutiques` : ce sont les noms
 * sous lesquels les anciens champs `r` et `b` sont relus.
 */
export const CAISSE = {
  code: 'caisse',
  nom: 'Caisse',
  prefixe: 'CAISSE',

  fonctions: [
    {
      cle: 'sale',
      libelle: 'Vente et encaissement',
      description: 'Vendre, encaisser, imprimer. C’est le logiciel : toujours ouvert.',
      noyau: true,
    },
    {
      cle: 'restaurant',
      libelle: 'Salle et cuisine',
      description: 'Tables, envois en cuisine, téléphones des serveurs.',
    },
    {
      cle: 'purchasing',
      libelle: 'Achats',
      description: 'Fournisseurs, réceptions, réapprovisionnement.',
    },
    { cle: 'customers', libelle: 'Clients', description: 'Fiches clients et ardoise.' },
    {
      cle: 'multistore',
      libelle: 'Multi-boutique',
      description: 'Plus d’une boutique dans la même entreprise.',
    },
    {
      cle: 'backoffice',
      libelle: 'Tableau de bord web',
      description: 'Consultation consolidée depuis un navigateur.',
    },
    {
      cle: 'promotions',
      libelle: 'Promotions',
      description: 'Opérations commerciales automatiques.',
    },
    {
      cle: 'balance',
      libelle: 'Balance',
      description: 'Lecture des étiquettes de balance du rayon frais.',
    },
  ],

  quotas: [
    { cle: 'caisses', libelle: 'Caisses rattachées', defaut: 1, max: 999 },
    { cle: 'boutiques', libelle: 'Boutiques', defaut: 1, max: 999 },
  ],

  formules: {
    restaurant: {
      libelle: 'Restaurant',
      fonctions: ['sale', 'restaurant', 'customers', 'purchasing'],
    },
    quincaillerie: {
      libelle: 'Quincaillerie',
      fonctions: ['sale', 'purchasing', 'customers'],
    },
    'grande-surface': {
      libelle: 'Grande surface',
      fonctions: [
        'sale',
        'purchasing',
        'customers',
        'multistore',
        'backoffice',
        'promotions',
        'balance',
      ],
      quotas: { caisses: 3, boutiques: 1 },
    },
    /** Tout ouvert, pour une période d'essai ou une démonstration. */
    essai: {
      libelle: 'Essai — tout ouvert',
      fonctions: [
        'sale',
        'restaurant',
        'purchasing',
        'customers',
        'multistore',
        'backoffice',
        'promotions',
        'balance',
      ],
    },
  },

  essaiJours: 30,
  graceJours: 15,
} as const satisfies Produit;

/**
 * Clés des fonctions de ce produit, comme type.
 *
 * L'application les emploie plutôt que `string` : demander une fonction qui
 * n'existe pas devient une erreur de compilation, et non un module qui reste
 * fermé sans que personne comprenne pourquoi.
 */
export type FonctionCaisse = (typeof CAISSE)['fonctions'][number]['cle'];
