"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BOUTIQUE: () => BOUTIQUE,
  CAISSE: () => CAISSE,
  CATALOGUE: () => CATALOGUE,
  EmissionError: () => EmissionError,
  LICENCE_GRACE_DAYS: () => LICENCE_GRACE_DAYS,
  LICENCE_PUBLIC_KEY: () => LICENCE_PUBLIC_KEY,
  LICENCE_TRIAL_DAYS: () => LICENCE_TRIAL_DAYS,
  LICENCE_VERSION: () => LICENCE_VERSION,
  LICENCE_WARN_DAYS: () => LICENCE_WARN_DAYS,
  PRODUITS: () => PRODUITS,
  PRODUIT_HISTORIQUE: () => PRODUIT_HISTORIQUE,
  RATCHET_MAX_JUMP_DAYS: () => RATCHET_MAX_JUMP_DAYS,
  TROUSSEAU_ITERATIONS: () => TROUSSEAU_ITERATIONS,
  TROUSSEAU_MAGIC: () => TROUSSEAU_MAGIC,
  TROUSSEAU_MAGIC_V1: () => TROUSSEAU_MAGIC_V1,
  TrousseauError: () => TrousseauError,
  addMonths: () => addMonths,
  buildPayload: () => buildPayload,
  decodeLicence: () => decodeLicence,
  emitLicence: () => emitLicence,
  encodeLicence: () => encodeLicence,
  fonctionsDe: () => fonctionsDe,
  fonctionsDeFormule: () => fonctionsDeFormule,
  importSigningKey: () => importSigningKey,
  installationCode: () => installationCode,
  judgeClock: () => judgeClock,
  licenceAllows: () => licenceAllows,
  licenceBlocks: () => licenceBlocks,
  licenceQuota: () => licenceQuota,
  licenceState: () => licenceState,
  nomDuProduit: () => nomDuProduit,
  normaliserCharge: () => normaliserCharge,
  normaliserEntree: () => normaliserEntree,
  noyauDe: () => noyauDe,
  openTrousseau: () => openTrousseau,
  passphraseProblem: () => passphraseProblem,
  prefixePour: () => prefixePour,
  problemeDescripteur: () => problemeDescripteur,
  produitPar: () => produitPar,
  quota: () => quota,
  quotasDeFormule: () => quotasDeFormule,
  sealTrousseau: () => sealTrousseau,
  signPayload: () => signPayload,
  trialStatus: () => trialStatus,
  verifyLicence: () => verifyLicence
});
module.exports = __toCommonJS(index_exports);

// src/licence.ts
var LICENCE_VERSION = 2;
var PRODUIT_HISTORIQUE = "caisse";
function normaliserCharge(brute) {
  if (typeof brute.p === "string" && brute.p !== "") {
    const charge = brute;
    return { ...charge, f: [...charge.f ?? []], q: { ...charge.q ?? {} } };
  }
  const v1 = brute;
  return {
    v: 1,
    p: PRODUIT_HISTORIQUE,
    c: v1.c,
    n: v1.n,
    s: v1.s,
    f: [...v1.f ?? []],
    q: { caisses: Number(v1.r) || 1, boutiques: Number(v1.b) || 1 },
    i: v1.i,
    e: v1.e
  };
}
function quota(payload, cle, defaut = 1) {
  const valeur = payload?.q?.[cle];
  return Number.isFinite(valeur) && valeur > 0 ? valeur : defaut;
}
var LICENCE_GRACE_DAYS = 15;
var LICENCE_WARN_DAYS = 30;
var LICENCE_TRIAL_DAYS = 30;
var HEX = "0123456789ABCDEF";
function installationCode(companyId) {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (const ch of companyId.toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0;
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (code << 3 | h1 & 7), 2246822519) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    const source = i < 6 ? h1 >>> i * 4 : h2 >>> (i - 6) * 4;
    out += HEX[source & 15];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}
var base64url = (bytes) => {
  let binaire = "";
  for (const octet of bytes) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var fromBase64url = (texte) => {
  const complet = texte.replace(/-/g, "+").replace(/_/g, "/");
  const binaire = atob(complet.padEnd(Math.ceil(complet.length / 4) * 4, "="));
  return Uint8Array.from(binaire, (ch) => ch.charCodeAt(0));
};
function prefixePour(produit, version = LICENCE_VERSION) {
  return `${produit.prefixe}-${version}`;
}
function encodeLicence(payload, signature, prefixe) {
  const charge = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${prefixe}.${charge}.${base64url(signature)}`;
}
function decodeLicence(cle) {
  const propre = cle.replace(/\s+/g, "");
  const morceaux = propre.split(".");
  if (morceaux.length !== 3) return null;
  const prefixe = morceaux[0] ?? "";
  if (!/^[A-Z0-9]+-\d+$/.test(prefixe)) return null;
  try {
    const signed = fromBase64url(morceaux[1] ?? "");
    const brute = JSON.parse(new TextDecoder().decode(signed));
    if (typeof brute !== "object" || brute === null) return null;
    return {
      payload: normaliserCharge(brute),
      prefixe,
      signature: fromBase64url(morceaux[2] ?? ""),
      signed
    };
  } catch {
    return null;
  }
}
var jour = 864e5;
var auJour = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
function licenceState(payload, produit, companyId, now, options = {}) {
  if (payload.p !== produit.code) {
    return {
      state: "autre-produit",
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: `Cette cl\xE9 a \xE9t\xE9 \xE9mise pour ${nommerProduit(payload.p)}, pas pour ${produit.nom}.`
    };
  }
  const codeAttendu = options.codeInstallation?.trim() || installationCode(companyId);
  if (payload.c !== codeAttendu) {
    return {
      state: "autre-entreprise",
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: `Cette cl\xE9 a \xE9t\xE9 \xE9mise pour l\u2019installation ${payload.c}.`
    };
  }
  const fin = auJour(payload.e);
  if (!Number.isFinite(fin)) {
    return {
      state: "invalide",
      payload,
      daysLeft: null,
      graceLeft: null,
      reason: "Date illisible"
    };
  }
  const restants = Math.floor((fin + jour - auJour(new Date(now).toISOString())) / jour);
  if (restants > 0) return { state: "valide", payload, daysLeft: restants, graceLeft: null };
  const graceLeft = (produit.graceJours ?? LICENCE_GRACE_DAYS) + restants;
  if (graceLeft > 0) return { state: "grace", payload, daysLeft: restants, graceLeft };
  return { state: "expiree", payload, daysLeft: restants, graceLeft: 0 };
}
function nommerProduit(code) {
  return code && code.trim() !== "" ? `\xAB ${code} \xBB` : "un autre logiciel";
}
async function verifyLicence(cle, options) {
  const now = options.now ?? Date.now();
  if (!cle || cle.trim() === "") {
    return { state: "absente", payload: null, daysLeft: null, graceLeft: null };
  }
  const decoded = decodeLicence(cle);
  if (!decoded) {
    return {
      state: "invalide",
      payload: null,
      daysLeft: null,
      graceLeft: null,
      reason: "Cl\xE9 illisible : v\xE9rifiez qu\u2019elle a \xE9t\xE9 copi\xE9e en entier."
    };
  }
  let authentique = false;
  try {
    const spki = fromBase64url(options.publicKeySpki.replace(/\+/g, "-").replace(/\//g, "_"));
    const key = await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    authentique = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      decoded.signature,
      decoded.signed
    );
  } catch {
    authentique = false;
  }
  if (!authentique) {
    return {
      state: "invalide",
      payload: null,
      daysLeft: null,
      graceLeft: null,
      reason: "Signature invalide : cette cl\xE9 n\u2019a pas \xE9t\xE9 \xE9mise par l\u2019\xE9diteur."
    };
  }
  return licenceState(decoded.payload, options.produit, options.companyId, now, {
    codeInstallation: options.codeInstallation
  });
}
function trialStatus(installedAt, produit, now) {
  const debut = auJour(installedAt);
  if (!Number.isFinite(debut)) {
    return { state: "absente", payload: null, daysLeft: null, graceLeft: null };
  }
  const duree = produit.essaiJours ?? LICENCE_TRIAL_DAYS;
  const ecoules = Math.floor((auJour(new Date(now).toISOString()) - debut) / jour);
  const restants = duree - ecoules;
  const essai = {
    v: LICENCE_VERSION,
    p: produit.code,
    c: "",
    n: "P\xE9riode d\u2019essai",
    s: "essai",
    f: produit.fonctions.map((fonction) => fonction.cle),
    q: Object.fromEntries(produit.quotas.map((plafond) => [plafond.cle, plafond.defaut])),
    i: installedAt.slice(0, 10),
    e: new Date(debut + duree * jour).toISOString().slice(0, 10)
  };
  if (restants > 0) return { state: "valide", payload: essai, daysLeft: restants, graceLeft: null };
  return {
    state: "expiree",
    payload: essai,
    daysLeft: restants,
    graceLeft: 0,
    reason: "La p\xE9riode d\u2019essai est termin\xE9e."
  };
}
function licenceAllows(status, fonction) {
  if (status.state !== "valide" && status.state !== "grace") return false;
  return status.payload?.f.includes(fonction) ?? false;
}
function licenceQuota(status, cle, defaut = 1) {
  if (status.state !== "valide" && status.state !== "grace") return defaut;
  return quota(status.payload, cle, defaut);
}
function licenceBlocks(status) {
  return status.state === "expiree" || status.state === "invalide" || status.state === "absente" || status.state === "autre-entreprise" || status.state === "autre-produit";
}
var RATCHET_MAX_JUMP_DAYS = 45;
function judgeClock(now, ratchet) {
  if (ratchet === null || !Number.isFinite(ratchet)) {
    return { effective: now, ratchet: now, suspect: false };
  }
  if (now < ratchet) {
    return { effective: ratchet, ratchet, suspect: true };
  }
  if (now > ratchet + RATCHET_MAX_JUMP_DAYS * jour) {
    return { effective: ratchet, ratchet, suspect: true };
  }
  return { effective: now, ratchet: now, suspect: false };
}

// src/produit.ts
function fonctionsDe(produit) {
  return produit.fonctions.map((fonction) => fonction.cle);
}
function noyauDe(produit) {
  return produit.fonctions.filter((fonction) => fonction.noyau).map((fonction) => fonction.cle);
}
function fonctionsDeFormule(produit, formule) {
  const trouvee = produit.formules[formule];
  if (!trouvee) return null;
  const retenues = /* @__PURE__ */ new Set([...noyauDe(produit), ...trouvee.fonctions]);
  return fonctionsDe(produit).filter((cle) => retenues.has(cle));
}
function quotasDeFormule(produit, formule) {
  const proposes = produit.formules[formule]?.quotas ?? {};
  return Object.fromEntries(
    produit.quotas.map((plafond) => [plafond.cle, proposes[plafond.cle] ?? plafond.defaut])
  );
}
function problemeDescripteur(produit) {
  if (!/^[a-z0-9-]+$/.test(produit.code)) {
    return `Code produit invalide : ${produit.code}. Minuscules, chiffres et tirets.`;
  }
  if (!/^[A-Z0-9]+$/.test(produit.prefixe)) {
    return `Pr\xE9fixe invalide : ${produit.prefixe}. Majuscules et chiffres, sans tiret \u2014 le tiret s\xE9pare le pr\xE9fixe du num\xE9ro de version.`;
  }
  if (produit.fonctions.length === 0) return `${produit.nom} ne vend aucune fonction.`;
  const vues = /* @__PURE__ */ new Set();
  for (const fonction of produit.fonctions) {
    if (!/^[a-z0-9-]+$/.test(fonction.cle)) {
      return `Fonction invalide : ${fonction.cle}. Minuscules, chiffres et tirets.`;
    }
    if (vues.has(fonction.cle)) return `Fonction en double : ${fonction.cle}.`;
    vues.add(fonction.cle);
  }
  const plafonds = /* @__PURE__ */ new Set();
  for (const plafond of produit.quotas) {
    if (plafonds.has(plafond.cle)) return `Plafond en double : ${plafond.cle}.`;
    if (plafond.defaut < 1 || plafond.defaut > plafond.max) {
      return `Plafond ${plafond.cle} : le d\xE9faut doit tenir entre 1 et ${plafond.max}.`;
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
  if (produit.essaiJours < 0) return `${produit.nom} : dur\xE9e d\u2019essai n\xE9gative.`;
  if (produit.graceJours < 0) return `${produit.nom} : d\xE9lai de gr\xE2ce n\xE9gatif.`;
  return null;
}

// src/produits/caisse.ts
var CAISSE = {
  code: "caisse",
  nom: "Caisse",
  prefixe: "CAISSE",
  fonctions: [
    {
      cle: "sale",
      libelle: "Vente et encaissement",
      description: "Vendre, encaisser, imprimer. C\u2019est le logiciel : toujours ouvert.",
      noyau: true
    },
    {
      cle: "restaurant",
      libelle: "Salle et cuisine",
      description: "Tables, envois en cuisine, t\xE9l\xE9phones des serveurs."
    },
    {
      cle: "purchasing",
      libelle: "Achats",
      description: "Fournisseurs, r\xE9ceptions, r\xE9approvisionnement."
    },
    { cle: "customers", libelle: "Clients", description: "Fiches clients et ardoise." },
    {
      cle: "multistore",
      libelle: "Multi-boutique",
      description: "Plus d\u2019une boutique dans la m\xEAme entreprise."
    },
    {
      cle: "backoffice",
      libelle: "Tableau de bord web",
      description: "Consultation consolid\xE9e depuis un navigateur."
    },
    {
      cle: "promotions",
      libelle: "Promotions",
      description: "Op\xE9rations commerciales automatiques."
    },
    {
      cle: "balance",
      libelle: "Balance",
      description: "Lecture des \xE9tiquettes de balance du rayon frais."
    }
  ],
  quotas: [
    { cle: "caisses", libelle: "Caisses rattach\xE9es", defaut: 1, max: 999 },
    { cle: "boutiques", libelle: "Boutiques", defaut: 1, max: 999 }
  ],
  formules: {
    restaurant: {
      libelle: "Restaurant",
      fonctions: ["sale", "restaurant", "customers", "purchasing"]
    },
    quincaillerie: {
      libelle: "Quincaillerie",
      fonctions: ["sale", "purchasing", "customers"]
    },
    "grande-surface": {
      libelle: "Grande surface",
      fonctions: [
        "sale",
        "purchasing",
        "customers",
        "multistore",
        "backoffice",
        "promotions",
        "balance"
      ],
      quotas: { caisses: 3, boutiques: 1 }
    },
    /** Tout ouvert, pour une période d'essai ou une démonstration. */
    essai: {
      libelle: "Essai \u2014 tout ouvert",
      fonctions: [
        "sale",
        "restaurant",
        "purchasing",
        "customers",
        "multistore",
        "backoffice",
        "promotions",
        "balance"
      ]
    }
  },
  essaiJours: 30,
  graceJours: 15
};

// src/produits/boutique.ts
var BOUTIQUE = {
  code: "boutique",
  nom: "Gestion de boutique",
  prefixe: "BOUTIQUE",
  fonctions: [
    {
      cle: "vente",
      libelle: "Vente et stock",
      description: "Comptoir, tickets, factures, catalogue, suivi des appareils par IMEI. C\u2019est le logiciel : toujours ouvert.",
      noyau: true
    },
    {
      cle: "apres-vente",
      libelle: "Remboursements et \xE9changes",
      description: "Retours, avoirs, \xE9changes d\u2019appareils."
    },
    {
      cle: "achats",
      libelle: "Achats",
      description: "Fournisseurs, commandes, r\xE9ceptions, r\xE9partition des frais sur le co\xFBt de revient."
    },
    { cle: "clients", libelle: "Clients", description: "Fiches clients et historique d\u2019achat." },
    {
      cle: "multiboutique",
      libelle: "Multi-boutique",
      description: "Plusieurs boutiques dans la m\xEAme entreprise, et transferts entre elles."
    },
    {
      cle: "synchronisation",
      libelle: "Synchronisation",
      description: "\xC9change des ventes, du stock et des appareils entre boutiques distantes."
    },
    {
      cle: "rapports",
      libelle: "Rapports",
      description: "Ventes, marges, \xE9volution des prix d\u2019achat et de vente."
    },
    {
      cle: "import",
      libelle: "Import Excel",
      description: "Reprise du catalogue et du stock depuis des classeurs."
    }
  ],
  quotas: [
    { cle: "postes", libelle: "Postes rattach\xE9s", defaut: 1, max: 999 },
    { cle: "boutiques", libelle: "Boutiques", defaut: 1, max: 999 },
    { cle: "utilisateurs", libelle: "Comptes utilisateurs", defaut: 3, max: 999 }
  ],
  formules: {
    solo: {
      libelle: "Boutique seule",
      fonctions: ["vente", "apres-vente", "clients", "import"],
      quotas: { postes: 1, boutiques: 1, utilisateurs: 3 }
    },
    standard: {
      libelle: "Standard",
      fonctions: ["vente", "apres-vente", "achats", "clients", "rapports", "import"],
      quotas: { postes: 2, boutiques: 1, utilisateurs: 6 }
    },
    reseau: {
      libelle: "R\xE9seau de boutiques",
      fonctions: [
        "vente",
        "apres-vente",
        "achats",
        "clients",
        "multiboutique",
        "synchronisation",
        "rapports",
        "import"
      ],
      quotas: { postes: 6, boutiques: 3, utilisateurs: 20 }
    },
    essai: {
      libelle: "Essai \u2014 tout ouvert",
      fonctions: [
        "vente",
        "apres-vente",
        "achats",
        "clients",
        "multiboutique",
        "synchronisation",
        "rapports",
        "import"
      ]
    }
  },
  essaiJours: 30,
  graceJours: 15
};

// src/catalogue.ts
var PRODUITS = [CAISSE, BOUTIQUE];
var CATALOGUE = Object.fromEntries(
  PRODUITS.map((produit) => [produit.code, produit])
);
function produitPar(code) {
  return CATALOGUE[code] ?? null;
}
function nomDuProduit(code) {
  return produitPar(code)?.nom ?? code;
}

// src/emission.ts
var EmissionError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EmissionError";
  }
};
function addMonths(depart, mois) {
  const quantieme = depart.getUTCDate();
  const arrivee = new Date(depart);
  arrivee.setUTCDate(1);
  arrivee.setUTCMonth(arrivee.getUTCMonth() + mois);
  const dernierJour = new Date(
    Date.UTC(arrivee.getUTCFullYear(), arrivee.getUTCMonth() + 1, 0)
  ).getUTCDate();
  arrivee.setUTCDate(Math.min(quantieme, dernierJour));
  return arrivee;
}
var entierPositif = (valeur, defaut, max, etiquette) => {
  const n = valeur === void 0 || valeur === null || valeur === "" ? defaut : Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new EmissionError(`${etiquette} doit \xEAtre un entier entre 1 et ${max}.`);
  }
  return n;
};
function buildPayload(produit, demande, maintenant) {
  const code = String(demande.code ?? "").toUpperCase().trim();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)) {
    throw new EmissionError(
      "Code d\u2019installation mal form\xE9. Attendu douze signes hexad\xE9cimaux en trois groupes, ex. A1B2-C3D4-E5F6"
    );
  }
  const nom = String(demande.nom ?? "").trim();
  if (nom === "") throw new EmissionError("Le nom du commerce est obligatoire.");
  const formule = String(demande.formule ?? demande.segment ?? "");
  const demandees = demande.fonctions ?? null;
  const connues = fonctionsDe(produit);
  let fonctions;
  if (demandees && demandees.length > 0) {
    for (const fonction of demandees) {
      if (!connues.includes(fonction)) {
        throw new EmissionError(
          `Fonction inconnue pour ${produit.nom} : ${fonction}. Connues : ${connues.join(", ")}`
        );
      }
    }
    const retenues = /* @__PURE__ */ new Set([...noyauDe(produit), ...demandees]);
    fonctions = connues.filter((cle) => retenues.has(cle));
  } else {
    const parFormule = fonctionsDeFormule(produit, formule);
    if (!parFormule) {
      throw new EmissionError(
        `Formule inconnue pour ${produit.nom} : ${formule || "(vide)"}. Connues : ${Object.keys(
          produit.formules
        ).join(", ")}`
      );
    }
    fonctions = parFormule;
  }
  const mois = Number(demande.mois);
  if (!Number.isInteger(mois) || mois < 1 || mois > 120) {
    throw new EmissionError("La dur\xE9e doit \xEAtre un entier entre 1 et 120 mois.");
  }
  const proposes = quotasDeFormule(produit, formule);
  const saisis = demande.quotas ?? {};
  for (const cle of Object.keys(saisis)) {
    if (!produit.quotas.some((plafond) => plafond.cle === cle)) {
      throw new EmissionError(
        `Plafond inconnu pour ${produit.nom} : ${cle}. Connus : ${produit.quotas.map((plafond) => plafond.cle).join(", ")}`
      );
    }
  }
  const quotas = {};
  for (const plafond of produit.quotas) {
    quotas[plafond.cle] = entierPositif(
      saisis[plafond.cle],
      proposes[plafond.cle] ?? plafond.defaut,
      plafond.max,
      plafond.libelle
    );
  }
  const jour2 = (date) => date.toISOString().slice(0, 10);
  return {
    v: LICENCE_VERSION,
    p: produit.code,
    c: code,
    n: nom,
    s: formule,
    f: fonctions,
    q: quotas,
    i: jour2(maintenant),
    e: jour2(addMonths(maintenant, mois))
  };
}
async function signPayload(payload, produit, privee) {
  const octets = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privee, octets)
  );
  return encodeLicence(payload, signature, prefixePour(produit));
}
async function emitLicence(produit, demande, privee, maintenant) {
  const payload = buildPayload(produit, demande, maintenant);
  const cle = await signPayload(payload, produit, privee);
  return {
    payload,
    cle,
    entree: {
      emiseLe: maintenant.toISOString(),
      produit: produit.code,
      code: payload.c,
      nom: payload.n,
      formule: payload.s,
      fonctions: [...payload.f],
      quotas: { ...payload.q },
      expireLe: payload.e,
      note: String(demande.note ?? ""),
      // La clé figure au registre, et ce n'est pas un secret : c'est ce que le
      // client a reçu, et c'est ce qu'on lui renverra s'il la perd.
      cle
    }
  };
}

// src/trousseau.ts
var TROUSSEAU_MAGIC = "LICENCES-TROUSSEAU-2";
var TROUSSEAU_MAGIC_V1 = "CAISSE-TROUSSEAU-1";
var TROUSSEAU_ITERATIONS = 6e5;
function normaliserEntree(brute) {
  if (typeof brute.produit === "string") {
    const entree = brute;
    return {
      ...entree,
      fonctions: [...entree.fonctions ?? []],
      quotas: { ...entree.quotas ?? {} }
    };
  }
  const v1 = brute;
  return {
    emiseLe: v1.emiseLe,
    produit: PRODUIT_HISTORIQUE,
    code: v1.code,
    nom: v1.nom,
    formule: v1.segment ?? "",
    fonctions: [...v1.fonctions ?? []],
    quotas: { caisses: Number(v1.caisses) || 1, boutiques: Number(v1.boutiques) || 1 },
    expireLe: v1.expireLe,
    note: v1.note ?? "",
    cle: v1.cle
  };
}
var TrousseauError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TrousseauError";
  }
};
var b64 = {
  encode(octets) {
    let texte = "";
    for (const octet of octets) texte += String.fromCharCode(octet);
    return btoa(texte);
  },
  decode(texte) {
    const brut = atob(texte);
    const octets = new Uint8Array(brut.length);
    for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
    return octets;
  }
};
async function deriveKey(phrase, salt, iterations) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(phrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
function passphraseProblem(phrase) {
  if (phrase.length < 12) {
    return "La phrase de passe doit compter au moins douze signes : c\u2019est le seul rempart si le trousseau est \xE9gar\xE9.";
  }
  return null;
}
async function sealTrousseau(content, phrase, iterations = TROUSSEAU_ITERATIONS) {
  const probleme = passphraseProblem(phrase);
  if (probleme) throw new TrousseauError(probleme);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(phrase, salt, iterations);
  const clair = new TextEncoder().encode(JSON.stringify(content));
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, clair)
  );
  const fichier = {
    magic: TROUSSEAU_MAGIC,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64.encode(salt) },
    cipher: { name: "AES-GCM", iv: b64.encode(iv) },
    data: b64.encode(chiffre)
  };
  return JSON.stringify(fichier, null, 2);
}
async function openTrousseau(brut, phrase) {
  let fichier;
  try {
    fichier = JSON.parse(brut);
  } catch {
    throw new TrousseauError("Ce fichier n\u2019est pas un trousseau.");
  }
  if (fichier.magic !== TROUSSEAU_MAGIC && fichier.magic !== TROUSSEAU_MAGIC_V1) {
    throw new TrousseauError(
      `Ce fichier n\u2019est pas un trousseau reconnu (attendu ${TROUSSEAU_MAGIC} ou ${TROUSSEAU_MAGIC_V1}).`
    );
  }
  if (!fichier.kdf?.salt || !fichier.cipher?.iv || !fichier.data) {
    throw new TrousseauError("Trousseau incomplet : il a probablement \xE9t\xE9 tronqu\xE9.");
  }
  const iterations = Number(fichier.kdf.iterations);
  if (!Number.isSafeInteger(iterations) || iterations < 1e3) {
    throw new TrousseauError("Trousseau illisible : param\xE8tres de d\xE9rivation invalides.");
  }
  const key = await deriveKey(phrase, b64.decode(fichier.kdf.salt), iterations);
  let clair;
  try {
    clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64.decode(fichier.cipher.iv) },
      key,
      b64.decode(fichier.data)
    );
  } catch {
    throw new TrousseauError(
      "Phrase de passe incorrecte, ou trousseau alt\xE9r\xE9. Aucun moyen de distinguer les deux."
    );
  }
  const content = JSON.parse(new TextDecoder().decode(clair));
  if (!content.clePrivee || !Array.isArray(content.registre)) {
    throw new TrousseauError("Trousseau ouvert mais illisible : contenu inattendu.");
  }
  return { ...content, registre: content.registre.map(normaliserEntree) };
}
function importSigningKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign"
  ]);
}

// src/cle-publique.ts
var LICENCE_PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEJTF5i99Fi0L8WmdtEPwMLbgO2inqdZBg+AWtOTTBlLMfvBr6EEf1j1rub447Kj3iUSDPT2Ny9JSmm4or7j0OFw==";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BOUTIQUE,
  CAISSE,
  CATALOGUE,
  EmissionError,
  LICENCE_GRACE_DAYS,
  LICENCE_PUBLIC_KEY,
  LICENCE_TRIAL_DAYS,
  LICENCE_VERSION,
  LICENCE_WARN_DAYS,
  PRODUITS,
  PRODUIT_HISTORIQUE,
  RATCHET_MAX_JUMP_DAYS,
  TROUSSEAU_ITERATIONS,
  TROUSSEAU_MAGIC,
  TROUSSEAU_MAGIC_V1,
  TrousseauError,
  addMonths,
  buildPayload,
  decodeLicence,
  emitLicence,
  encodeLicence,
  fonctionsDe,
  fonctionsDeFormule,
  importSigningKey,
  installationCode,
  judgeClock,
  licenceAllows,
  licenceBlocks,
  licenceQuota,
  licenceState,
  nomDuProduit,
  normaliserCharge,
  normaliserEntree,
  noyauDe,
  openTrousseau,
  passphraseProblem,
  prefixePour,
  problemeDescripteur,
  produitPar,
  quota,
  quotasDeFormule,
  sealTrousseau,
  signPayload,
  trialStatus,
  verifyLicence
});
