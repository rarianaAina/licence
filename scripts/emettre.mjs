#!/usr/bin/env node
/**
 * Émet une clé d'activation v2, pour n'importe quel logiciel du catalogue.
 *
 *   $env:LICENCE_PHRASE = '…'        (PowerShell ; en bash : LICENCE_PHRASE='…')
 *   node scripts/emettre.mjs --produit applive --code A1B2-C3D4-E5F6 \
 *     --nom "Boutique Rakoto" --mois 12
 *
 * POURQUOI CE SCRIPT. L'outil d'émission de la caisse signe encore au format
 * v1 (« CAISSE-1 »), qui ne connaît pas d'autre produit : sans cette voie, ni
 * APPLIVE ni MOBI STOCK ne pourraient recevoir de clé. Les règles (validation,
 * échéance, signature, registre) restent celles du noyau : `emitLicence`.
 *
 * Le trousseau est le même que celui de la caisse : une seule clé privée pour
 * tous les logiciels, une seule clé publique embarquée partout.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  EmissionError,
  PRODUITS,
  TrousseauError,
  emitLicence,
  importSigningKey,
  openTrousseau,
  produitPar,
  sealTrousseau,
} from '../dist/index.js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const CHEMIN = args.get('trousseau') ?? join(homedir(), '.caisse-licence', 'trousseau.json');

// La phrase de passe passe par l'environnement, jamais par un argument : la
// ligne de commande est visible des autres comptes de la machine, et elle finit
// dans l'historique du shell. CAISSE_PHRASE reste accepté, c'est le même trousseau.
const PHRASE = process.env['LICENCE_PHRASE'] ?? process.env['CAISSE_PHRASE'];

const usage = () => {
  console.error(`
  Usage : LICENCE_PHRASE='votre phrase' node scripts/emettre.mjs \\
            --produit <${PRODUITS.map((p) => p.code).join('|')}> \\
            --code A1B2-C3D4-E5F6 --nom "Nom du commerce" --mois 12 \\
            [--formule <nom>] [--fonctions a,b] [--quotas postes=2,boutiques=1] \\
            [--note "…"] [--trousseau <chemin>]

  Formules par produit :
${PRODUITS.map((p) => `    ${p.code.padEnd(9)} ${Object.keys(p.formules).join(', ')}`).join('\n')}
`);
};

/** « postes=2,boutiques=1 » → { postes: '2', boutiques: '1' } */
function lireQuotas(texte) {
  if (!texte) return null;
  return Object.fromEntries(
    texte.split(',').map((paire) => {
      const [cle, valeur] = paire.split('=').map((s) => s.trim());
      if (!cle || valeur === undefined)
        throw new EmissionError(`Plafond mal écrit : « ${paire} ». Attendu cle=nombre.`);
      return [cle, valeur];
    }),
  );
}

try {
  const code = args.get('produit');
  const produit = code ? produitPar(code) : null;
  if (!produit) {
    throw new EmissionError(
      `Produit ${code ? `inconnu : ${code}` : 'manquant'}. Connus : ${PRODUITS.map((p) => p.code).join(', ')}`,
    );
  }
  if (!PHRASE) {
    throw new TrousseauError(
      'Phrase de passe absente. Donnez-la par la variable LICENCE_PHRASE, jamais en argument.',
    );
  }

  const contenu = await openTrousseau(await readFile(CHEMIN, 'utf8'), PHRASE);
  const privee = await importSigningKey(contenu.clePrivee);

  // Un produit à formule unique n'oblige pas à la nommer
  const formules = Object.keys(produit.formules).filter((nom) => nom !== 'essai');
  const formule = args.get('formule') ?? (formules.length === 1 ? formules[0] : undefined);

  const { payload, cle, entree } = await emitLicence(
    produit,
    {
      code: args.get('code'),
      nom: args.get('nom'),
      formule,
      mois: args.get('mois'),
      fonctions: args
        .get('fonctions')
        ?.split(',')
        .map((f) => f.trim()),
      quotas: lireQuotas(args.get('quotas')),
      note: args.get('note'),
    },
    privee,
    new Date(),
  );

  // On réécrit le trousseau AVANT d'afficher la clé : une clé montrée mais
  // absente du registre partirait chez un client sans qu'on en garde trace.
  await ecrireAtomique(
    CHEMIN,
    await sealTrousseau({ ...contenu, registre: [entree, ...contenu.registre] }, PHRASE),
  );

  const plafonds = Object.entries(payload.q);
  console.log(`
  ${produit.nom} — ${payload.n}
  Installation   ${payload.c}
  Formule        ${payload.s || '(à la carte)'}  (${payload.f.join(', ')})${
    plafonds.length ? `\n  Plafonds       ${plafonds.map(([k, v]) => `${k} ${v}`).join(', ')}` : ''
  }
  Validité       du ${payload.i} au ${payload.e} inclus

  Clé à transmettre :

${cle}
`);
} catch (erreur) {
  if (erreur instanceof EmissionError || erreur instanceof TrousseauError) {
    console.error(`\n  ${erreur.message}`);
    usage();
    process.exit(1);
  }
  if (erreur?.code === 'ENOENT') {
    console.error(`\n  Trousseau introuvable : ${CHEMIN}\n`);
    process.exit(1);
  }
  throw erreur;
}

/**
 * Écriture atomique : on écrit à côté, puis on renomme.
 *
 * Le trousseau contient l'unique exemplaire de la clé privée. Une coupure au
 * milieu d'une écriture directe laisserait un fichier tronqué — c'est-à-dire
 * une clé perdue, et des licences qu'on ne pourrait plus émettre.
 */
async function ecrireAtomique(chemin, contenu) {
  await mkdir(dirname(chemin), { recursive: true, mode: 0o700 });
  const provisoire = `${chemin}.tmp`;
  await writeFile(provisoire, contenu, { mode: 0o600 });
  await rename(provisoire, chemin);
}
