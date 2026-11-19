import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getTerrainDetails } from '../utils/terrainDetails';

describe('getTerrainDetails', () => {
  it('extracts structural sections and local documents for matching terrain', () => {
    const eq = {
      sub_elements: 'Montage A1',
      terrain_calculations: [
        {
          terrain_type: 'IIIa',
          material_specification: 'TRON 139x6.3',
          plot_metallique: 'TCAR 200x5',
          bras_de_deport: 'TCAR 50x5',
          mat_secondaire: 'TRON 76x5',
          documentation: {
            document_urls: '/media/catalogue/a1_iiia.pdf, https://example.com/ext.docx',
          },
        },
      ],
    };

    const details = getTerrainDetails(eq, 'IIIa');
    assert.equal(details.terrain, 'Terrain IIIa');
    assert.equal(details.matPrincipal, 'TRON 139x6.3');
    assert.equal(details.plotMetallique, 'TCAR 200x5');
    assert.equal(details.brasDeDeport, 'TCAR 50x5');
    assert.equal(details.matSecondaire, 'TRON 76x5');
    assert.equal(details.docList.length, 2);
    assert.equal(details.docList[0].localUrl, '/media/catalogue/a1_iiia.pdf');
    assert.equal(details.docList[0].ext, 'PDF');
    assert.equal(details.docList[1].localUrl, undefined);
  });

  it('falls back cleanly when terrain calculation is missing', () => {
    const details = getTerrainDetails({ sub_elements: 'Fallback' }, 'IV');
    assert.equal(details.terrain, 'Terrain IV');
    assert.equal(details.material, 'Fallback');
    assert.deepEqual(details.docList, []);
  });
});

