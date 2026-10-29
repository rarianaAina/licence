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
interface Fonction {
    /** Identifiant écrit dans la clé. Immuable une fois vendu. */
    readonly cle: string;
    readonly libelle: string;
    /** Ce que le client obtient. Sert l'outil d'émission, pas le logiciel. */
    readonly description: string;
    /**
     * Fonction indispensable, toujours incluse.
     *
     * Vendre un logiciel de caisse sans la vente n'a pas de sens : le noyau est
     * ajouté d'office à toute formule, et l'outil d'émission ne permet pas de le
     * retirer.
     */
    readonly noyau?: boolean;
}
/** Un plafond nommé : postes, boutiques, utilisateurs… */
interface Quota {
    readonly cle: string;
    readonly libelle: string;
    /** Valeur retenue quand la clé n'en dit rien. Prudente par construction. */
    readonly defaut: number;
    /** Borne haute acceptée à l'émission, pour attraper une faute de frappe. */
    readonly max: number;
}
/**
 * Raccourci d'émission : un nom commercial et ce qu'il ouvre.
 *
 * La clé transporte la LISTE de fonctions, jamais le nom de la formule.
 * Remanier une formule n'invalide donc aucune clé déjà émise, et un client
 * peut recevoir une combinaison qui ne porte aucun nom.
 */
interface Formule {
    readonly libelle: string;
    readonly fonctions: readonly string[];
    /** Plafonds proposés d'office. L'éditeur les corrige à la vente. */
    readonly quotas?: Readonly<Record<string, number>>;
}
/**
 * Un logiciel vendu.
 *
 * Tout y est en lecture seule, pour que chaque descripteur puisse être déclaré
 * `as const satisfies Produit` : les clés de ses fonctions redeviennent alors
 * des littéraux, et l'application qui l'utilise se fait reprendre à la
 * compilation si elle demande une fonction qui n'existe pas. Une faute de
 * frappe dans un nom de fonction ne se voit pas autrement — elle ferme
 * silencieusement un module que le client a payé.
 */
interface Produit {
    /** Écrit dans chaque clé. Immuable. */
    readonly code: string;
    /** Nom commercial, affiché partout. */
    readonly nom: string;
    /** En-tête des clés : `CAISSE`, `BOUTIQUE`… Majuscules et chiffres. */
    readonly prefixe: string;
    readonly fonctions: readonly Fonction[];
    readonly quotas: readonly Quota[];
    readonly formules: Readonly<Record<string, Formule>>;
    /** Durée de la période d'essai, en jours. */
    readonly essaiJours: number;
    /** Délai de grâce après l'échéance, en jours. */
    readonly graceJours: number;
}
/** Clés des fonctions du produit. */
declare function fonctionsDe(produit: Produit): string[];
/** Fonctions toujours incluses, quelle que soit la formule. */
declare function noyauDe(produit: Produit): string[];
/**
 * Fonctions d'une formule, noyau compris et doublons écartés.
 *
 * L'ordre suit celui du descripteur et non celui de la formule : deux clés
 * portant les mêmes fonctions doivent se ressembler, sans quoi les comparer à
 * l'œil au téléphone devient un exercice.
 */
declare function fonctionsDeFormule(produit: Produit, formule: string): string[] | null;
/** Plafonds par défaut d'un produit, ou ceux que la formule propose. */
declare function quotasDeFormule(produit: Produit, formule: string): Record<string, number>;
/**
 * Ce qui rend un descripteur inutilisable.
 *
 * Vérifié par les épreuves plutôt qu'au démarrage : un descripteur est du code,
 * pas une saisie. Le fauter se voit à l'intégration, jamais chez le client.
 */
declare function problemeDescripteur(produit: Produit): string | null;

/**
 * Clés d'activation, communes à tous les logiciels de l'éditeur.
 *
 * POURQUOI UNE SIGNATURE ET NON UN APPEL SERVEUR : ces logiciels sont
 * hors-ligne d'abord. Une licence qui devrait téléphoner pour être validée
 * trahirait tout le reste — une caisse coupée du réseau doit ouvrir, vendre et
 * encaisser. La clé est donc une charge SIGNÉE : l'éditeur détient la clé
 * privée, l'application embarque la publique, et la vérification est locale.
 * Aucune connexion n'est nécessaire, ni à l'installation, ni jamais.
 *
 * ECDSA P-256 plutôt qu'Ed25519 : WebCrypto le fournit à l'identique dans la
 * WebView Windows, dans WebKitGTK et dans Node ; Ed25519 n'y est pas encore
 * partout.
 *
 * CE QUI A CHANGÉ EN VERSION 2, ET POURQUOI C'ÉTAIT URGENT. La version 1 ne
 * disait pas POUR QUEL LOGICIEL la clé avait été émise. Tant qu'un seul
 * produit existait, cela ne se voyait pas ; au deuxième, une clé de caisse
 * ouvrait la boutique — le client paie une fois, reçoit tout. La charge nomme
 * donc son produit, et chaque application refuse ce qui ne la nomme pas.
 *
 * Les clés v1 déjà chez les clients restent valides : elles sont lues comme des
 * clés de caisse, ce qu'elles étaient. Aucune ne devient inutilisable.
 */
/** Version du format écrite dans les clés émises aujourd'hui. */
declare const LICENCE_VERSION = 2;
/**
 * Contenu d'une clé.
 *
 * Les noms sont courts à dessein : la charge est encodée dans la clé
 * elle-même, et chaque caractère se retrouve dans ce que le commerçant doit
 * recopier ou dicter.
 */
interface LicencePayload {
    /** Version du format. */
    v: number;
    /** Code du produit visé (`caisse`, `boutique`…). Absent en v1. */
    p: string;
    /** Code d'installation de l'entreprise (cf. `installationCode`). */
    c: string;
    /** Nom du commerce, pour l'afficher — jamais vérifié. */
    n: string;
    /** Formule vendue. Informatif : ce sont `f` et `q` qui font foi. */
    s: string;
    /** Fonctions ouvertes, propres au produit. */
    f: string[];
    /** Plafonds nommés : `{ caisses: 3, boutiques: 1 }`. */
    q: Record<string, number>;
    /** Date d'émission, AAAA-MM-JJ. */
    i: string;
    /** Dernier jour de validité, AAAA-MM-JJ inclus. */
    e: string;
}
/**
 * Charge de la version 1, telle qu'elle circule encore chez les clients.
 *
 * Conservée pour la LIRE, jamais pour en écrire. Ses deux plafonds étaient
 * ceux de la caisse, gravés dans le format ; c'est précisément ce qu'on ne
 * pouvait pas reconduire pour un logiciel qui compte des ateliers ou des
 * points de retrait.
 */
interface LicencePayloadV1 {
    v: 1;
    c: string;
    n: string;
    s: string;
    f: string[];
    /** Nombre maximum de caisses. */
    r: number;
    /** Nombre maximum de boutiques. */
    b: number;
    i: string;
    e: string;
}
/** Produit auquel appartiennent les clés v1, qui n'en nommaient aucun. */
declare const PRODUIT_HISTORIQUE = "caisse";
/**
 * Ramène une charge lue à la forme courante.
 *
 * Le reste du code ne connaît donc qu'un seul format. Une v1 devient une clé
 * de caisse dont les plafonds reprennent leurs noms — `r` et `b` n'avaient de
 * sens que pour qui savait déjà de quel logiciel on parlait.
 */
declare function normaliserCharge(brute: LicencePayload | LicencePayloadV1): LicencePayload;
/**
 * Plafond nommé, ou une valeur de repli.
 *
 * Un plafond ABSENT vaut « une seule » et non « illimité » : une clé muette
 * sur les postes ne doit pas en ouvrir mille. Le silence se lit toujours dans
 * le sens le plus prudent.
 */
declare function quota(payload: LicencePayload | null, cle: string, defaut?: number): number;
/**
 * Délai de grâce après l'échéance, par défaut.
 *
 * Pendant ces jours, tout fonctionne mais l'écran le dit sans ménagement.
 * Ce n'est pas de la générosité : une clé qui expire un samedi midi, sans
 * préavis et sans recours, coûte un client et sa recommandation.
 *
 * Chaque produit peut l'allonger — un logiciel qu'on n'ouvre qu'une fois par
 * semaine a besoin de plus de marge qu'une caisse ouverte tous les jours.
 */
declare const LICENCE_GRACE_DAYS = 15;
/** À partir de ce nombre de jours restants, on commence à prévenir. */
declare const LICENCE_WARN_DAYS = 30;
/**
 * Période d'essai, à compter de la création du commerce sur le poste.
 *
 * POURQUOI ELLE EXISTE : sans elle, une installation neuve serait bloquée
 * AVANT d'avoir pu créer son entreprise — donc avant même de connaître son
 * code d'installation, qu'il faut pourtant fournir pour obtenir une clé. Le
 * commerçant serait enfermé dehors par la porte qu'on lui demande d'ouvrir.
 *
 * Toutes les fonctions y sont ouvertes : on ne fait pas essayer un logiciel
 * amputé.
 */
declare const LICENCE_TRIAL_DAYS = 30;
/**
 * Code court et lisible dérivé de l'identifiant d'entreprise.
 *
 * C'est ce que le commerçant lit au téléphone pour obtenir sa clé. On ne lui
 * fait pas épeler un UUID de 36 caractères : douze signes en trois groupes se
 * dictent sans erreur.
 *
 * Dérivé par un mélange simple et NON cryptographique : il n'a rien à protéger,
 * il doit seulement être stable, court, et différent d'une entreprise à
 * l'autre. Le secret est dans la signature, pas ici.
 *
 * IL RESTE IDENTIQUE À CELUI DE LA VERSION 1, au bit près : le changer aurait
 * invalidé toutes les clés en circulation, puisque chacune porte le code
 * calculé le jour de la vente.
 */
declare function installationCode(companyId: string): string;
/**
 * En-tête lisible d'une clé : `CAISSE-2`, `BOUTIQUE-2`…
 *
 * Il dit au commerçant, et à nous au téléphone, ce qu'il a entre les mains
 * avant même d'avoir décodé quoi que ce soit. Il ne remplace pas la
 * vérification du produit — un en-tête se retape à la main — il la rend
 * seulement lisible.
 */
declare function prefixePour(produit: Produit, version?: number): string;
declare function encodeLicence(payload: LicencePayload, signature: Uint8Array, prefixe: string): string;
interface DecodedLicence {
    payload: LicencePayload;
    /** En-tête lu dans la clé, tel quel. */
    prefixe: string;
    signature: Uint8Array;
    /** Octets exactement signés — à revérifier, jamais à reconstruire. */
    signed: Uint8Array;
}
/**
 * Découpe une clé sans rien vérifier.
 *
 * Les octets signés sont ceux LUS dans la clé, pas ceux qu'on obtiendrait en
 * ré-sérialisant l'objet : deux moteurs JSON n'ordonnent pas forcément les
 * clés pareil, et une signature valide deviendrait invalide au passage.
 *
 * L'en-tête n'est pas contrôlé ici. Il est décoratif : ce qui engage, c'est la
 * charge signée, et elle seule nomme le produit. Refuser sur l'en-tête
 * donnerait un message trompeur à qui a simplement mal recopié le début.
 */
declare function decodeLicence(cle: string): DecodedLicence | null;
type LicenceState = 'valide'
/** Échue, mais dans le délai de grâce : tout fonctionne, l'écran alerte. */
 | 'grace' | 'expiree'
/** Aucune clé saisie sur ce poste. */
 | 'absente'
/** Format illisible, ou signature qui ne correspond pas. */
 | 'invalide'
/** Clé authentique, mais émise pour une autre entreprise. */
 | 'autre-entreprise'
/** Clé authentique, mais émise pour un autre logiciel de l'éditeur. */
 | 'autre-produit';
interface LicenceStatus {
    state: LicenceState;
    payload: LicencePayload | null;
    /** Jours avant l'échéance ; négatif une fois échue. `null` sans clé lisible. */
    daysLeft: number | null;
    /** Jours restants avant le blocage, une fois en grâce. */
    graceLeft: number | null;
    /** Ce qui n'a pas été compris, pour l'afficher au commerçant. */
    reason?: string;
}
/**
 * État d'une licence déjà authentifiée.
 *
 * Séparé de la vérification de signature parce que celle-ci est asynchrone
 * (WebCrypto) et que ceci ne l'est pas : la règle métier reste éprouvable sans
 * clé ni cryptographie.
 *
 * L'ORDRE DES REFUS EST DÉLIBÉRÉ. Le produit d'abord, l'entreprise ensuite,
 * l'échéance en dernier : à qui a collé la clé d'un autre logiciel, on ne parle
 * pas d'une date d'expiration qui ne le concerne pas.
 */
declare function licenceState(payload: LicencePayload, produit: Produit, companyId: string, now: number, options?: {
    codeInstallation?: string;
}): LicenceStatus;
interface VerificationOptions {
    /** Clé publique de l'éditeur, en SPKI base64, embarquée dans l'application. */
    publicKeySpki: string;
    /** Produit qui vérifie. Une clé qui en nomme un autre est refusée. */
    produit: Produit;
    /** Identifiant d'entreprise de cette installation. */
    companyId: string;
    /**
     * Code d'installation ADOPTÉ, quand ce poste est rattaché à un autre.
     *
     * POURQUOI CELA EXISTE. Une licence est vendue à une entreprise, pas à une
     * machine : le descripteur de produit déclare d'ailleurs un quota « postes
     * rattachés ». Mais chaque installation tire son propre identifiant, et son
     * code en dérive : un commerçant qui installe le logiciel sur une seconde
     * machine — un ordinateur de plus, une tablette — se voyait refuser la clé
     * qu'il a payée.
     *
     * Le code ne se déduit pas de l'identifiant en sens inverse : la dérivation
     * replie soixante-quatre bits en quarante-huit, et rien ne permet de
     * remonter. Le poste rattaché retient donc le code visé, et c'est LUI qu'on
     * compare.
     *
     * CE N'EST PAS UNE FAILLE, et la distinction compte : ce champ ne dit pas
     * « accepte n'importe quelle clé », il dit « ce poste se présente sous ce
     * code-là ». La signature reste vérifiée, le produit reste vérifié,
     * l'échéance reste vérifiée. Ce qu'il faut posséder pour rattacher un poste,
     * c'est la CLÉ — que seul le client détient.
     */
    codeInstallation?: string;
    now?: number;
}
/**
 * Vérifie la signature, puis le produit, l'entreprise et l'échéance.
 *
 * La clé privée correspondante ne se trouve dans aucun dépôt de code — c'est
 * toute la sécurité du dispositif.
 */
declare function verifyLicence(cle: string | null, options: VerificationOptions): Promise<LicenceStatus>;
/**
 * État d'un poste sans clé, pendant sa période d'essai.
 *
 * `installedAt` est la date de création du commerce sur ce poste. Elle est
 * soumise au même cliquet d'horloge que le reste : reculer la date du poste ne
 * rallonge pas l'essai.
 */
declare function trialStatus(installedAt: string, produit: Produit, now: number): LicenceStatus;
/** Les fonctions restent ouvertes tant qu'on n'est pas bloqué. */
declare function licenceAllows(status: LicenceStatus, fonction: string): boolean;
/** Plafond accordé par la licence en cours, ou le repli du produit. */
declare function licenceQuota(status: LicenceStatus, cle: string, defaut?: number): number;
/** Vrai quand l'application doit se fermer aux usages autres que la vente. */
declare function licenceBlocks(status: LicenceStatus): boolean;
/**
 * Date de référence pour juger d'une échéance, à l'abri d'une horloge trafiquée.
 *
 * DEUX PIÈGES OPPOSÉS, et le second est le plus dangereux :
 *
 *  - reculer l'horloge prolongerait une licence échue. D'où le cliquet : on
 *    retient la date la plus avancée jamais vue, et on l'utilise si l'horloge
 *    revient en arrière ;
 *  - une horloge qui part en avant — pile morte, BIOS à zéro, poste qui
 *    annonce 2038 — empoisonnerait ce cliquet et BLOQUERAIT DÉFINITIVEMENT un
 *    commerçant parfaitement en règle, même après réparation. Le cliquet
 *    n'avance donc jamais d'un bond invraisemblable.
 */
declare const RATCHET_MAX_JUMP_DAYS = 45;
interface ClockVerdict {
    /** Date à employer pour juger la licence. */
    effective: number;
    /** Nouvelle valeur du cliquet à enregistrer. */
    ratchet: number;
    /** L'horloge du poste est suspecte : à signaler, sans rien bloquer. */
    suspect: boolean;
}
declare function judgeClock(now: number, ratchet: number | null): ClockVerdict;

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
declare const CAISSE: {
    readonly code: "caisse";
    readonly nom: "Caisse";
    readonly prefixe: "CAISSE";
    readonly fonctions: readonly [{
        readonly cle: "sale";
        readonly libelle: "Vente et encaissement";
        readonly description: "Vendre, encaisser, imprimer. C’est le logiciel : toujours ouvert.";
        readonly noyau: true;
    }, {
        readonly cle: "restaurant";
        readonly libelle: "Salle et cuisine";
        readonly description: "Tables, envois en cuisine, téléphones des serveurs.";
    }, {
        readonly cle: "purchasing";
        readonly libelle: "Achats";
        readonly description: "Fournisseurs, réceptions, réapprovisionnement.";
    }, {
        readonly cle: "customers";
        readonly libelle: "Clients";
        readonly description: "Fiches clients et ardoise.";
    }, {
        readonly cle: "multistore";
        readonly libelle: "Multi-boutique";
        readonly description: "Plus d’une boutique dans la même entreprise.";
    }, {
        readonly cle: "backoffice";
        readonly libelle: "Tableau de bord web";
        readonly description: "Consultation consolidée depuis un navigateur.";
    }, {
        readonly cle: "promotions";
        readonly libelle: "Promotions";
        readonly description: "Opérations commerciales automatiques.";
    }, {
        readonly cle: "balance";
        readonly libelle: "Balance";
        readonly description: "Lecture des étiquettes de balance du rayon frais.";
    }];
    readonly quotas: readonly [{
        readonly cle: "caisses";
        readonly libelle: "Caisses rattachées";
        readonly defaut: 1;
        readonly max: 999;
    }, {
        readonly cle: "boutiques";
        readonly libelle: "Boutiques";
        readonly defaut: 1;
        readonly max: 999;
    }];
    readonly formules: {
        readonly restaurant: {
            readonly libelle: "Restaurant";
            readonly fonctions: readonly ["sale", "restaurant", "customers", "purchasing"];
        };
        readonly quincaillerie: {
            readonly libelle: "Quincaillerie";
            readonly fonctions: readonly ["sale", "purchasing", "customers"];
        };
        readonly 'grande-surface': {
            readonly libelle: "Grande surface";
            readonly fonctions: readonly ["sale", "purchasing", "customers", "multistore", "backoffice", "promotions", "balance"];
            readonly quotas: {
                readonly caisses: 3;
                readonly boutiques: 1;
            };
        };
        /** Tout ouvert, pour une période d'essai ou une démonstration. */
        readonly essai: {
            readonly libelle: "Essai — tout ouvert";
            readonly fonctions: readonly ["sale", "restaurant", "purchasing", "customers", "multistore", "backoffice", "promotions", "balance"];
        };
    };
    readonly essaiJours: 30;
    readonly graceJours: 15;
};
/**
 * Clés des fonctions de ce produit, comme type.
 *
 * L'application les emploie plutôt que `string` : demander une fonction qui
 * n'existe pas devient une erreur de compilation, et non un module qui reste
 * fermé sans que personne comprenne pourquoi.
 */
type FonctionCaisse = (typeof CAISSE)['fonctions'][number]['cle'];

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
declare const BOUTIQUE: {
    readonly code: "boutique";
    readonly nom: "Gestion de boutique";
    readonly prefixe: "BOUTIQUE";
    readonly fonctions: readonly [{
        readonly cle: "vente";
        readonly libelle: "Vente et stock";
        readonly description: "Comptoir, tickets, factures, catalogue, suivi des appareils par IMEI. C’est le logiciel : toujours ouvert.";
        readonly noyau: true;
    }, {
        readonly cle: "apres-vente";
        readonly libelle: "Remboursements et échanges";
        readonly description: "Retours, avoirs, échanges d’appareils.";
    }, {
        readonly cle: "achats";
        readonly libelle: "Achats";
        readonly description: "Fournisseurs, commandes, réceptions, répartition des frais sur le coût de revient.";
    }, {
        readonly cle: "clients";
        readonly libelle: "Clients";
        readonly description: "Fiches clients et historique d’achat.";
    }, {
        readonly cle: "multiboutique";
        readonly libelle: "Multi-boutique";
        readonly description: "Plusieurs boutiques dans la même entreprise, et transferts entre elles.";
    }, {
        readonly cle: "synchronisation";
        readonly libelle: "Synchronisation";
        readonly description: "Échange des ventes, du stock et des appareils entre boutiques distantes.";
    }, {
        readonly cle: "rapports";
        readonly libelle: "Rapports";
        readonly description: "Ventes, marges, évolution des prix d’achat et de vente.";
    }, {
        readonly cle: "import";
        readonly libelle: "Import Excel";
        readonly description: "Reprise du catalogue et du stock depuis des classeurs.";
    }];
    readonly quotas: readonly [{
        readonly cle: "postes";
        readonly libelle: "Postes rattachés";
        readonly defaut: 1;
        readonly max: 999;
    }, {
        readonly cle: "boutiques";
        readonly libelle: "Boutiques";
        readonly defaut: 1;
        readonly max: 999;
    }, {
        readonly cle: "utilisateurs";
        readonly libelle: "Comptes utilisateurs";
        readonly defaut: 3;
        readonly max: 999;
    }];
    readonly formules: {
        readonly solo: {
            readonly libelle: "Boutique seule";
            readonly fonctions: readonly ["vente", "apres-vente", "clients", "import"];
            readonly quotas: {
                readonly postes: 1;
                readonly boutiques: 1;
                readonly utilisateurs: 3;
            };
        };
        readonly standard: {
            readonly libelle: "Standard";
            readonly fonctions: readonly ["vente", "apres-vente", "achats", "clients", "rapports", "import"];
            readonly quotas: {
                readonly postes: 2;
                readonly boutiques: 1;
                readonly utilisateurs: 6;
            };
        };
        readonly reseau: {
            readonly libelle: "Réseau de boutiques";
            readonly fonctions: readonly ["vente", "apres-vente", "achats", "clients", "multiboutique", "synchronisation", "rapports", "import"];
            readonly quotas: {
                readonly postes: 6;
                readonly boutiques: 3;
                readonly utilisateurs: 20;
            };
        };
        readonly essai: {
            readonly libelle: "Essai — tout ouvert";
            readonly fonctions: readonly ["vente", "apres-vente", "achats", "clients", "multiboutique", "synchronisation", "rapports", "import"];
        };
    };
    readonly essaiJours: 30;
    readonly graceJours: 15;
};
/**
 * Clés des fonctions de ce produit, comme type.
 *
 * L'application les emploie plutôt que `string` : demander une fonction qui
 * n'existe pas devient une erreur de compilation, et non un module qui reste
 * fermé sans que personne comprenne pourquoi.
 */
type FonctionBoutique = (typeof BOUTIQUE)['fonctions'][number]['cle'];

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
declare const APPLIVE: {
    readonly code: "applive";
    readonly nom: "APPLIVE";
    readonly prefixe: "APPLIVE";
    readonly fonctions: readonly [{
        readonly cle: "boutique-en-ligne";
        readonly libelle: "Boutique en ligne";
        readonly description: "Catalogue public, réservation de 15 minutes, paiement à la livraison ou Mobile Money, administration. C’est le logiciel : toujours ouvert.";
        readonly noyau: true;
    }];
    readonly quotas: readonly [];
    readonly formules: {
        readonly standard: {
            readonly libelle: "Standard — tout compris";
            readonly fonctions: readonly ["boutique-en-ligne"];
        };
        readonly essai: {
            readonly libelle: "Essai — tout ouvert";
            readonly fonctions: readonly ["boutique-en-ligne"];
        };
    };
    readonly essaiJours: 30;
    readonly graceJours: 15;
};
/** Clés des fonctions de ce produit, comme type. */
type FonctionApplive = (typeof APPLIVE)['fonctions'][number]['cle'];

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
declare const PRODUITS: readonly Produit[];
declare const CATALOGUE: Record<string, Produit>;
/** Descripteur d'un code produit, ou `null` s'il est inconnu. */
declare function produitPar(code: string): Produit | null;
/**
 * Nom présentable d'un code produit.
 *
 * Un code inconnu se rend tel quel plutôt que remplacé par « inconnu » : quand
 * un client lit sa clé au téléphone, le code brut nous dit s'il s'est trompé de
 * logiciel ou s'il a une clé plus récente que notre outil.
 */
declare function nomDuProduit(code: string): string;

/**
 * Trousseau de l'éditeur : la clé privée et le registre, chiffrés ensemble.
 *
 * POURQUOI IL EXISTE. La clé privée signe toutes les licences, de tous les
 * logiciels. Qui la détient peut en émettre à votre place, gratuitement — et
 * une clé privée perdue NE SE RÉVOQUE PAS : la clé publique est gravée dans
 * chaque poste déjà installé. Le seul remède serait de republier tous les
 * logiciels et de réémettre toutes les licences en circulation.
 *
 * Elle ne pouvait donc pas voyager en clair. Tant qu'elle vivait sur une seule
 * machine, un fichier en 0600 suffisait ; dès qu'elle suit son propriétaire
 * d'un ordinateur à l'autre, elle traverse des clés USB qui s'égarent et des
 * dossiers partagés. Un trousseau volé sans sa phrase de passe ne vaut rien.
 *
 * POURQUOI LE REGISTRE EST DEDANS. Émettre depuis deux ordinateurs scinderait
 * l'historique : chaque machine ne connaîtrait que ses propres ventes, et l'on
 * perdrait la vue des échéances. Le registre suit donc la clé, dans le même
 * fichier — et il est chiffré du même coup, ce qui est souhaitable : il porte le
 * nom et le commerce de chaque client.
 *
 * UN SEUL TROUSSEAU POUR TOUS LES LOGICIELS. Une clé privée par produit
 * multiplierait ce qu'il y a à protéger sans rien protéger de plus : la même
 * personne les détiendrait toutes, sur la même machine. Ce qui sépare les
 * produits est écrit DANS la charge signée, pas dans la clé qui signe.
 *
 * POURQUOI WEBCRYPTO. Le même code doit tourner dans la WebView de
 * l'application et dans Node pour la ligne de commande. PBKDF2 et AES-GCM y
 * sont disponibles à l'identique.
 */
/** En-tête du fichier écrit aujourd'hui. */
declare const TROUSSEAU_MAGIC = "LICENCES-TROUSSEAU-2";
/**
 * En-tête de la première version, quand un seul logiciel existait.
 *
 * Toujours accepté à la LECTURE : le trousseau de l'éditeur est un fichier
 * unique, souvent le seul exemplaire, et refuser de l'ouvrir reviendrait à lui
 * faire perdre son registre entier.
 */
declare const TROUSSEAU_MAGIC_V1 = "CAISSE-TROUSSEAU-1";
/**
 * Itérations de PBKDF2.
 *
 * 600 000, recommandation OWASP pour PBKDF2-SHA-256. C'est délibérément lent :
 * une seconde à l'ouverture du trousseau ne se remarque pas, mais elle multiplie
 * par autant le coût d'une attaque par dictionnaire sur la phrase de passe.
 */
declare const TROUSSEAU_ITERATIONS = 600000;
/** Une vente inscrite au registre. */
interface RegistreEntry {
    emiseLe: string;
    /** Logiciel vendu. Absent des entrées de version 1 : c'était la caisse. */
    produit: string;
    code: string;
    nom: string;
    formule: string;
    fonctions: string[];
    quotas: Record<string, number>;
    expireLe: string;
    note: string;
    cle: string;
}
/** Entrée telle qu'elle était écrite en version 1. */
interface RegistreEntryV1 {
    emiseLe: string;
    code: string;
    nom: string;
    segment: string;
    fonctions: string[];
    caisses: number;
    boutiques: number;
    expireLe: string;
    note: string;
    cle: string;
}
/**
 * Ramène une entrée de registre à la forme courante.
 *
 * Les plafonds retrouvent leurs noms, et le produit devient explicite. Rien
 * n'est perdu : `caisses` et `boutiques` sont exactement ce que `r` et `b`
 * signifiaient.
 */
declare function normaliserEntree(brute: RegistreEntry | RegistreEntryV1): RegistreEntry;
/** Contenu déchiffré. La clé privée y est au format JWK. */
interface TrousseauContent {
    clePrivee: JsonWebKey;
    clePublique: string;
    registre: RegistreEntry[];
}
/** Fichier tel qu'il est écrit sur le disque. */
interface TrousseauFile {
    magic: string;
    kdf: {
        name: 'PBKDF2';
        hash: 'SHA-256';
        iterations: number;
        salt: string;
    };
    cipher: {
        name: 'AES-GCM';
        iv: string;
    };
    data: string;
}
declare class TrousseauError extends Error {
    constructor(message: string);
}
/**
 * Ce qui rend une phrase de passe inacceptable.
 *
 * Douze signes, pas huit. C'est le seul rempart entre un trousseau égaré et
 * l'émission de licences en votre nom ; et contrairement à un mot de passe de
 * service, personne ne peut ici limiter les tentatives — l'attaquant a le
 * fichier et tout son temps.
 */
declare function passphraseProblem(phrase: string): string | null;
/** Chiffre un trousseau. Le résultat est du texte, prêt à écrire. */
declare function sealTrousseau(content: TrousseauContent, phrase: string, iterations?: number): Promise<string>;
/**
 * Déchiffre un trousseau, de l'une ou l'autre version.
 *
 * Le nombre d'itérations est LU DANS LE FICHIER et non supposé : un trousseau
 * écrit hier doit rester ouvrable après que la recommandation aura changé.
 *
 * Les entrées de registre sont ramenées à la forme courante à l'ouverture. Le
 * fichier sur le disque, lui, n'est pas touché : il ne passera en version 2
 * qu'à la prochaine écriture, quand l'éditeur émettra sa prochaine clé.
 */
declare function openTrousseau(brut: string, phrase: string): Promise<TrousseauContent>;
/** Importe la clé privée du trousseau, non réexportable. */
declare function importSigningKey(jwk: JsonWebKey): Promise<CryptoKey>;

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
declare class EmissionError extends Error {
    constructor(message: string);
}
interface EmissionRequest {
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
declare function addMonths(depart: Date, mois: number): Date;
/**
 * Valide une demande et en tire la charge de la licence.
 *
 * Pure : c'est elle qui porte toutes les règles, et c'est elle que les épreuves
 * éprouvent. Une charge mal formée n'est découverte qu'au moment où le
 * commerçant, qui a déjà payé, tente d'activer son poste.
 */
declare function buildPayload(produit: Produit, demande: EmissionRequest, maintenant: Date): LicencePayload;
/** Signe une charge et rend la clé transmissible au commerçant. */
declare function signPayload(payload: LicencePayload, produit: Produit, privee: CryptoKey): Promise<string>;
interface Emission {
    payload: LicencePayload;
    cle: string;
    entree: RegistreEntry;
}
/** Émet une clé et prépare son inscription au registre. */
declare function emitLicence(produit: Produit, demande: EmissionRequest, privee: CryptoKey, maintenant: Date): Promise<Emission>;

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
declare const LICENCE_PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEC13AWEULsoRVAKSeFNEEuIe7bm3EItia/wsRN3IfQgXtOKeJ30lVmPiHy2phqOmyxT6ldp6mAAA4XGBFWt/Zeg==";

export { APPLIVE, BOUTIQUE, CAISSE, CATALOGUE, type ClockVerdict, type DecodedLicence, type Emission, EmissionError, type EmissionRequest, type Fonction, type FonctionApplive, type FonctionBoutique, type FonctionCaisse, type Formule, LICENCE_GRACE_DAYS, LICENCE_PUBLIC_KEY, LICENCE_TRIAL_DAYS, LICENCE_VERSION, LICENCE_WARN_DAYS, type LicencePayload, type LicencePayloadV1, type LicenceState, type LicenceStatus, PRODUITS, PRODUIT_HISTORIQUE, type Produit, type Quota, RATCHET_MAX_JUMP_DAYS, type RegistreEntry, TROUSSEAU_ITERATIONS, TROUSSEAU_MAGIC, TROUSSEAU_MAGIC_V1, type TrousseauContent, TrousseauError, type TrousseauFile, type VerificationOptions, addMonths, buildPayload, decodeLicence, emitLicence, encodeLicence, fonctionsDe, fonctionsDeFormule, importSigningKey, installationCode, judgeClock, licenceAllows, licenceBlocks, licenceQuota, licenceState, nomDuProduit, normaliserCharge, normaliserEntree, noyauDe, openTrousseau, passphraseProblem, prefixePour, problemeDescripteur, produitPar, quota, quotasDeFormule, sealTrousseau, signPayload, trialStatus, verifyLicence };
