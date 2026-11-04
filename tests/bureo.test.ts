import { describe, expect, it } from 'vitest';
import { BUREO, CAISSE, buildPayload, installationCode, verifyLicence } from '../src/index.js';
import { emettreDeTest, paireDeTest } from './helpers/signature.js';

/**
 * Bureo vérifie ses clés en Python : ces épreuves fixent, côté émission, ce que
 * `bureo/licence.py` attend. Une clé Bureo nomme son produit, porte le code de
 * l'installation, et sa date `e` est la fin des mises à jour comprises.
 */
describe('Bureo', () => {
  const LE_JOUR = new Date('2026-11-04T10:00:00.000Z');
  const CODE = installationCode('6f1c2b4e-8d3a-4f5b-9c7e-2a1d0e9b8c7f');

  it('émet par défaut la formule standard, mises à jour pendant un an', () => {
    const charge = buildPayload(
      BUREO,
      { code: CODE, nom: 'Rova Conseil', formule: 'standard', mois: 12 },
      LE_JOUR,
    );
    expect(charge).toMatchObject({
      v: 2,
      p: 'bureo',
      c: CODE,
      f: ['bureau'],
      q: {},
      i: '2026-11-04',
      e: '2027-11-04',
    });
  });

  it('ouvre Bureo et pas un autre logiciel', async () => {
    const { privee, publique } = await paireDeTest();
    const cle = await emettreDeTest(BUREO, privee, { code: CODE, formule: 'standard' });
    expect(cle.startsWith('BUREO-2.')).toBe(true);

    const pourBureo = await verifyLicence(cle, {
      publicKeySpki: publique,
      produit: BUREO,
      companyId: '6f1c2b4e-8d3a-4f5b-9c7e-2a1d0e9b8c7f',
      now: Date.parse('2026-06-01'),
    });
    expect(pourBureo.state).toBe('valide');

    const pourLaCaisse = await verifyLicence(cle, {
      publicKeySpki: publique,
      produit: CAISSE,
      companyId: '6f1c2b4e-8d3a-4f5b-9c7e-2a1d0e9b8c7f',
    });
    expect(pourLaCaisse.state).toBe('autre-produit');
  });

  it('n’a ni plafond ni délai de grâce : la clé est à vie', () => {
    expect(BUREO.quotas).toEqual([]);
    expect(BUREO.graceJours).toBe(0);
    expect(BUREO.essaiJours).toBe(14);
  });
});
