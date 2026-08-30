# Brancher une application sur ce dépôt

## 1. Ajouter la dépendance

```bash
pnpm add "@licence/noyau@git+https://github.com/rarianaAina/licence.git#main"
```

Le paquet se construit tout seul après le clonage (`prepare`). Pour travailler
en local sur les deux dépôts à la fois :

```bash
pnpm add "@licence/noyau@link:../licence"
```

## 2. Migrer la caisse

Le module vivait dans `packages/shared/src/licence/`. Les noms de fonctions
n'ont pas changé ; leurs signatures prennent désormais le produit.

### Ce qui change

| Avant                                             | Après                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `verifyLicence(cle, clePublique, companyId, now)` | `verifyLicence(cle, { publicKeySpki, produit: CAISSE, companyId, now })` |
| `licenceState(payload, companyId, now)`           | `licenceState(payload, CAISSE, companyId, now)`                          |
| `trialStatus(installedAt, now)`                   | `trialStatus(installedAt, CAISSE, now)`                                  |
| `licenceAllows(status, 'sale')`                   | inchangé                                                                 |
| `payload.r` · `payload.b`                         | `quota(payload, 'caisses')` · `quota(payload, 'boutiques')`              |
| `LICENCE_FEATURES`                                | `fonctionsDe(CAISSE)`                                                    |
| `LICENCE_SEGMENTS`                                | `CAISSE.formules`                                                        |
| `buildPayload(demande, maintenant)`               | `buildPayload(CAISSE, demande, maintenant)`                              |
| `emitLicence(demande, privee, maintenant)`        | `emitLicence(CAISSE, demande, privee, maintenant)`                       |
| `signPayload(payload, privee)`                    | `signPayload(payload, CAISSE, privee)`                                   |
| `RegistreEntry.segment`                           | `.formule`                                                               |
| `RegistreEntry.caisses` · `.boutiques`            | `.quotas.caisses` · `.quotas.boutiques`                                  |
| `LICENCE_GRACE_DAYS` · `LICENCE_TRIAL_DAYS`       | `CAISSE.graceJours` · `CAISSE.essaiJours`                                |

`installationCode`, `judgeClock`, `decodeLicence`, `sealTrousseau`,
`openTrousseau`, `importSigningKey`, `passphraseProblem` et `addMonths` ne
changent pas.

Le champ `segment` reste accepté à l'émission comme ancien nom de `formule`,
pour que l'outil existant continue de fonctionner pendant la bascule.

### Ce qui ne change PAS

- **La clé publique** — la remplacer invaliderait toutes les licences émises.
- **Le code d'installation** — calculé au bit près comme avant : chaque clé en
  circulation porte le code calculé le jour de la vente.
- **Les clés de fonctions de la caisse** (`sale`, `restaurant`, `purchasing`…)
  — elles sont écrites dans les clés déjà vendues.
- **Les clés déjà émises** — lues comme des clés de caisse.
- **Le trousseau existant** — ouvert sous son ancien en-tête
  `CAISSE-TROUSSEAU-1`, ses entrées ramenées à la forme courante à la lecture.
  Le fichier ne passe en version 2 qu'à la prochaine écriture, c'est-à-dire à la
  prochaine clé émise.

### Marche à suivre

1. Supprimer `packages/shared/src/licence/` et son export dans `index.ts`.
2. Ajouter la dépendance dans `packages/shared` et réexporter, pour que les
   applications n'aient rien d'autre à changer que ce tableau :
   ```ts
   export * from '@licence/noyau';
   ```
3. Corriger les appels selon le tableau ci-dessus. Le compilateur les trouve
   tous : chaque signature a changé d'arité.
4. Dans `apps/licences`, ajouter le choix du produit avant celui de la formule,
   et lire les fonctions et plafonds dans `produitPar(code)` au lieu des
   constantes. `PRODUITS` donne la liste à afficher.
5. **Sauvegarder le trousseau avant la première émission** en version 2 :
   `~/caisse-licence/trousseau.json`. C'est le seul exemplaire de la clé privée.

## 3. Brancher la boutique

Elle n'a aucune licence aujourd'hui. Il lui faut :

1. **Un identifiant d'entreprise stable**, créé à l'installation et jamais
   modifié — c'est de lui que dérive le code d'installation. La table
   `shop` porte déjà un identifiant ; le prendre plutôt que d'en créer un
   nouveau évite qu'un même commerce change de code après réinstallation.
2. **Deux valeurs à conserver** dans les réglages : la clé saisie, et le cliquet
   d'horloge (`judgeClock`).
3. **Un écran de licence** : le code d'installation à dicter, le champ de
   saisie, l'état, l'échéance, et les fonctions ouvertes.
4. **Les gardes** aux endroits vendus. `BOUTIQUE.fonctions` en donne la liste :
   `achats`, `clients`, `multiboutique`, `synchronisation`, `rapports`,
   `import`. `vente` est le noyau : toujours ouvert.

Le rapprochement avec les permissions existantes est direct — une fonction non
vendue se traite comme une page dont le rôle n'a pas l'accès, à ceci près que le
message doit dire « non compris dans votre licence » et non « votre rôle ne
permet pas ».

## 4. Vérifier la bascule

Avant de publier quoi que ce soit :

```bash
cd licence && pnpm test        # 117 épreuves, dont la clé réellement vendue
```

Puis, dans la caisse, vérifier **avec la clé LOVELEC réelle** que l'écran de
licence l'accepte encore. C'est le seul contrôle qui compte : le reste se
rattrape, une clé refusée chez un client qui a payé ne se rattrape pas.
