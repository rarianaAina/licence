/**
 * Clé publique de l'éditeur, en SPKI base64.
 *
 * Versionnée sans crainte : elle ne permet que de VÉRIFIER une signature,
 * jamais d'en produire une. La clé privée correspondante ne se trouve dans
 * aucun dépôt de code, et c'est toute la sécurité du dispositif.
 *
 * LA MÊME POUR TOUS LES LOGICIELS. Une clé par produit n'aurait rien protégé de
 * plus : elles vivraient toutes dans le même trousseau, sur la même machine.
 * Ce qui sépare les produits est écrit dans la charge signée — c'est le champ
 * `p`, et c'est lui que chaque application vérifie.
 *
 * La remplacer invaliderait d'un coup toutes les licences déjà émises, chez
 * tous les clients. Elle ne bouge donc jamais.
 *
 * Une seule exception, le 28 octobre 2026 : la phrase de passe du premier
 * trousseau a été perdue, et aucune licence n'était encore en service. La clé
 * a été réengendrée ; l'ancienne ne survit que dans `tests/cle-reelle.test.ts`.
 */
export const LICENCE_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEC13AWEULsoRVAKSeFNEEuIe7bm3EItia/wsRN3IfQgXtOKeJ30lVmPiHy2phqOmyxT6ldp6mAAA4XGBFWt/Zeg==';
