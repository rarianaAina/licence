# Licences

Clés d'activation signées, communes à tous les logiciels de l'éditeur.

Une clé est une **charge signée**, vérifiée **hors ligne**. L'éditeur détient la
clé privée, chaque application embarque la publique. Aucune connexion n'est
nécessaire, ni à l'installation, ni jamais — c'est la condition pour qu'une
caisse coupée du réseau ouvre, vende et encaisse.

## Ce que ce dépôt contient

| Fichier               | Rôle                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `src/licence.ts`      | Format des clés, décodage, vérification, états, essai, cliquet d'horloge |
| `src/produit.ts`      | Descripteur d'un logiciel vendu : fonctions, plafonds, formules          |
| `src/produits/`       | Un descripteur par logiciel                                              |
| `src/catalogue.ts`    | La liste des logiciels, pour l'outil d'émission                          |
| `src/emission.ts`     | Construction et signature d'une clé                                      |
| `src/trousseau.ts`    | Clé privée et registre des ventes, chiffrés ensemble                     |
| `src/cle-publique.ts` | Clé publique de l'éditeur, embarquée dans les applications               |

## Vérifier une licence dans une application

```ts
import { BOUTIQUE, LICENCE_PUBLIC_KEY, verifyLicence, licenceAllows } from '@licence/noyau';

const statut = await verifyLicence(cleSaisie, {
  publicKeySpki: LICENCE_PUBLIC_KEY,
  produit: BOUTIQUE,
  companyId: identifiantEntreprise,
});

if (licenceAllows(statut, 'achats')) {
  // ouvrir le module des achats
}
```

`statut.state` vaut `valide`, `grace`, `expiree`, `absente`, `invalide`,
`autre-entreprise` ou `autre-produit`. `licenceBlocks(statut)` dit si
l'application doit se fermer.

## Ajouter un logiciel

1. Écrire son descripteur dans `src/produits/`.
2. L'ajouter à `PRODUITS` dans `src/catalogue.ts`.
3. Lui faire vérifier sa licence avec ce descripteur.

Rien d'autre. Le format des clés ne bouge pas, la clé publique ne bouge pas,
les licences déjà émises ne bougent pas. Les épreuves de `tests/produits.test.ts`
refuseront un descripteur mal formé — un code produit avec une majuscule, un
préfixe contenant un tiret, une formule qui ouvre une fonction inexistante.

Deux règles ne se négocient pas :

- **le code produit est écrit dans chaque clé émise** — il ne change plus jamais ;
- **la clé d'une fonction ou d'un plafond déjà vendu** ne change plus non plus,
  sous peine de fermer une porte que le client a payée.

Le libellé, la description, l'ordre et les formules se remanient librement :
aucune clé ne les référence.

## Le format des clés

```
BOUTIQUE-2.eyJ2IjoyLCJwIjoiYm91dGlxdWUiLC4uLn0.wYxdRMpszjR8sye9jtOTHt8R...
└─ produit  └─ charge JSON, base64url        └─ signature ECDSA P-256
   et version
```

La charge :

| Champ     | Sens                                           |
| --------- | ---------------------------------------------- |
| `v`       | Version du format                              |
| `p`       | Code du produit visé                           |
| `c`       | Code d'installation de l'entreprise            |
| `n`       | Nom du commerce, affiché — jamais vérifié      |
| `s`       | Formule vendue, informative                    |
| `f`       | Fonctions ouvertes                             |
| `q`       | Plafonds nommés, `{ postes: 3, boutiques: 1 }` |
| `i` · `e` | Émise le · expire le, AAAA-MM-JJ inclus        |

Les noms sont courts parce que la charge voyage dans ce que le commerçant doit
recopier.

L'en-tête est **décoratif** : il dit au téléphone ce qu'on a entre les mains,
mais ce qui engage est la charge signée, et elle seule nomme le produit. Une clé
dont l'en-tête a été mal recopié reste valable.

## Pourquoi une version 2

La version 1 ne disait pas **pour quel logiciel** la clé avait été émise. Tant
qu'un seul produit existait, cela ne se voyait pas ; au deuxième, une clé de
caisse ouvrait la boutique — le client paie une fois, reçoit tout.

Les clés v1 déjà chez les clients restent valides : elles sont lues comme des
clés de caisse, ce qu'elles étaient, et leurs plafonds `r` et `b` retrouvent
leurs noms `caisses` et `boutiques`. `tests/cle-reelle.test.ts` le vérifie sur
la clé réellement vendue à LOVELEC, contre la vraie clé publique.

## Le trousseau

La clé privée signe toutes les licences, de tous les logiciels. Qui la détient
peut en émettre à votre place — et **une clé privée perdue ne se révoque pas** :
la clé publique est gravée dans chaque poste installé. Le seul remède serait de
republier tous les logiciels et de réémettre toutes les licences en circulation.

Elle voyage donc chiffrée, avec le registre des ventes dans le même fichier :
PBKDF2-SHA-256 à 600 000 tours, AES-GCM. La phrase de passe doit compter au
moins douze signes — personne ne peut limiter les tentatives sur un fichier
volé.

Un seul trousseau pour tous les logiciels : une clé privée par produit
multiplierait ce qu'il y a à protéger sans rien protéger de plus. Ce qui sépare
les produits est écrit **dans** la charge signée, pas dans la clé qui signe.

## Développer

```bash
pnpm install
pnpm test        # 117 épreuves
pnpm typecheck
pnpm build       # dist/ en ESM, CJS et types
```

Voir [MIGRATION.md](MIGRATION.md) pour brancher une application existante.

## Pourquoi `dist/` est versionné

Ce paquet s'installe depuis Git, sans registre npm. pnpm refuse alors
d'exécuter le script de construction d'une dépendance distante — à raison :
un `prepare` téléchargé exécute du code chez qui installe.

Le résultat de la construction est donc livré avec les sources. Il n'a pas le
droit de dériver : `pnpm verifier-dist` reconstruit et échoue si le contenu
diffère, et la CI l'exécute à chaque poussée. Un `dist/` en retard d'une
correction de sécurité serait pire que pas de `dist/` du tout.
