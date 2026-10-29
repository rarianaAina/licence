import { describe, expect, it } from 'vitest';
import {
  APPLIVE,
  BOUTIQUE,
  CAISSE,
  CATALOGUE,
  PRODUITS,
  fonctionsDe,
  fonctionsDeFormule,
  nomDuProduit,
  noyauDe,
  problemeDescripteur,
  produitPar,
  quotasDeFormule,
  type Produit,
} from '../src/index.js';

describe('catalogue', () => {
  it('ne déclare aucun descripteur fautif', () => {
    // Un descripteur est du code, pas une saisie : le fauter doit se voir ici,
    // à l'intégration, et jamais chez un client.
    for (const produit of PRODUITS) {
      expect(problemeDescripteur(produit), produit.code).toBeNull();
    }
  });

  it('ne réutilise jamais un code produit', () => {
    // Le code est écrit dans chaque clé émise : deux produits qui le
    // partageraient s'ouvriraient mutuellement.
    expect(new Set(PRODUITS.map((produit) => produit.code)).size).toBe(PRODUITS.length);
  });

  it('ne réutilise jamais un préfixe', () => {
    expect(new Set(PRODUITS.map((produit) => produit.prefixe)).size).toBe(PRODUITS.length);
  });

  it('retrouve un produit par son code', () => {
    expect(produitPar('caisse')).toBe(CAISSE);
    expect(produitPar('boutique')).toBe(BOUTIQUE);
    expect(produitPar('applive')).toBe(APPLIVE);
    expect(produitPar('inexistant')).toBeNull();
    expect(Object.keys(CATALOGUE).sort()).toEqual(['applive', 'boutique', 'caisse']);
  });

  it('rend un code inconnu tel quel plutôt que « inconnu »', () => {
    // Quand un client lit sa clé au téléphone, le code brut nous dit s'il
    // s'est trompé de logiciel ou s'il a une clé plus récente que notre outil.
    expect(nomDuProduit('atelier')).toBe('atelier');
    expect(nomDuProduit('caisse')).toBe('Caisse');
  });
});

describe('fonctions d’un produit', () => {
  it('déclare exactement une fonction de noyau par produit', () => {
    // Sans noyau, une formule pourrait vendre un logiciel entièrement fermé.
    for (const produit of PRODUITS) {
      expect(noyauDe(produit).length, produit.code).toBeGreaterThan(0);
    }
  });

  it('conserve les clés historiques de la caisse', () => {
    // Elles sont écrites dans chaque clé déjà chez un client : les renommer
    // fermerait, du jour au lendemain, des fonctions payées.
    expect(fonctionsDe(CAISSE)).toEqual([
      'sale',
      'restaurant',
      'purchasing',
      'customers',
      'multistore',
      'backoffice',
      'promotions',
      'balance',
    ]);
  });

  it('inclut le noyau dans toute formule', () => {
    for (const produit of PRODUITS) {
      for (const nom of Object.keys(produit.formules)) {
        const fonctions = fonctionsDeFormule(produit, nom) ?? [];
        for (const noyau of noyauDe(produit)) {
          expect(fonctions, `${produit.code}/${nom}`).toContain(noyau);
        }
      }
    }
  });

  it('range les fonctions dans l’ordre du descripteur', () => {
    const desordre = fonctionsDeFormule(CAISSE, 'grande-surface') ?? [];
    expect(desordre).toEqual(desordre.slice().sort((a, b) => ordre(a) - ordre(b)));
    function ordre(cle: string) {
      return fonctionsDe(CAISSE).indexOf(cle);
    }
  });

  it('ne connaît pas une formule qui n’est pas la sienne', () => {
    expect(fonctionsDeFormule(BOUTIQUE, 'quincaillerie')).toBeNull();
  });

  it('ouvre tout dans la formule d’essai', () => {
    for (const produit of PRODUITS) {
      expect(fonctionsDeFormule(produit, 'essai'), produit.code).toEqual(fonctionsDe(produit));
    }
  });
});

describe('plafonds d’un produit', () => {
  it('rend une valeur pour chacun, même si la formule se tait', () => {
    for (const produit of PRODUITS) {
      const quotas = quotasDeFormule(produit, 'essai');
      expect(Object.keys(quotas).sort()).toEqual(
        produit.quotas.map((plafond) => plafond.cle).sort(),
      );
    }
  });

  it('préfère la valeur de la formule au défaut du produit', () => {
    expect(quotasDeFormule(BOUTIQUE, 'reseau')['boutiques']).toBe(3);
    expect(quotasDeFormule(BOUTIQUE, 'solo')['boutiques']).toBe(1);
  });
});

describe('descripteur fautif', () => {
  // Typé `Produit` et non figé : ces épreuves déforment volontairement un
  // descripteur valable pour vérifier que le défaut se voit.
  const base = (modifications: Partial<Produit> = {}): Produit => ({ ...CAISSE, ...modifications });

  it('refuse un code produit qui ne tient pas dans une clé', () => {
    expect(problemeDescripteur(base({ code: 'Ma Caisse' }))).toMatch(/Code produit invalide/);
  });

  it('refuse un préfixe contenant un tiret', () => {
    // Le tiret sépare le préfixe du numéro de version : « MA-CAISSE-2 » ne se
    // découperait pas.
    expect(problemeDescripteur(base({ prefixe: 'MA-CAISSE' }))).toMatch(/Préfixe invalide/);
  });

  it('refuse une clé de fonction qui ne tient pas dans une clé', () => {
    expect(
      problemeDescripteur(
        base({ fonctions: [{ cle: 'Ma Fonction', libelle: 'x', description: 'x' }] }),
      ),
    ).toMatch(/Fonction invalide/);
  });

  it('refuse une fonction en double', () => {
    const doublon = { cle: 'sale', libelle: 'Vente', description: 'x' };
    expect(problemeDescripteur(base({ fonctions: [doublon, doublon] }))).toMatch(/en double/);
  });

  it('refuse une formule qui ouvre une fonction inexistante', () => {
    expect(
      problemeDescripteur(
        base({ formules: { bancal: { libelle: 'Bancal', fonctions: ['inexistante'] } } }),
      ),
    ).toMatch(/fonction inconnue/);
  });

  it('refuse une formule qui fixe un plafond inexistant', () => {
    expect(
      problemeDescripteur(
        base({
          formules: {
            bancal: { libelle: 'Bancal', fonctions: ['sale'], quotas: { ateliers: 2 } },
          },
        }),
      ),
    ).toMatch(/plafond inconnu/);
  });

  it('refuse un plafond en double', () => {
    const plafond = { cle: 'caisses', libelle: 'Caisses', defaut: 1, max: 10 };
    expect(problemeDescripteur(base({ quotas: [plafond, plafond], formules: {} }))).toMatch(
      /Plafond en double/,
    );
  });

  it('refuse un défaut hors des bornes du plafond', () => {
    expect(
      problemeDescripteur(
        base({
          quotas: [{ cle: 'caisses', libelle: 'Caisses', defaut: 0, max: 10 }],
          formules: {},
        }),
      ),
    ).toMatch(/entre 1 et 10/);
  });

  it('refuse un produit qui ne vend rien', () => {
    expect(problemeDescripteur(base({ fonctions: [], formules: {} }))).toMatch(
      /ne vend aucune fonction/,
    );
  });
});
