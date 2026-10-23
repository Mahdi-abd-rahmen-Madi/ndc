import type { TerrainDetails } from '../components/regular-user/types';

// The helper to get terrain details for an equipment item
export const getTerrainDetails = (eq: any, detectedTerrain?: string): TerrainDetails => {
  const rawTerrainType = detectedTerrain || eq.terrain || 'IIIa';
  const terrainTypeKey = `Terrain ${rawTerrainType}`;

  const terrainCalc = eq.terrain_calculations?.find(
    (tc: any) => tc.terrain_type === rawTerrainType || tc.terrain_type === terrainTypeKey
  );

  let materialDisplay = terrainCalc?.material_specification || eq.sub_elements || 'Montage Standard';

  if (terrainCalc) {
    const parts: string[] = [];
    if (terrainCalc.material_specification) parts.push(`Mat Principal: ${terrainCalc.material_specification}`);
    if (terrainCalc.plot_metallique) parts.push(`Plot Métallique: ${terrainCalc.plot_metallique}`);
    if (terrainCalc.bras_de_deport) parts.push(`Bras de déport: ${terrainCalc.bras_de_deport}`);
    if (terrainCalc.mat_secondaire) parts.push(`Mat 5G: ${terrainCalc.mat_secondaire}`);

    if (parts.length > 0) {
      materialDisplay = parts.join('\n');
    }
  }

  return {
    terrain: terrainTypeKey,
    material: materialDisplay,
    matPrincipal: terrainCalc?.material_specification,
    plotMetallique: terrainCalc?.plot_metallique,
    brasDeDeport: terrainCalc?.bras_de_deport,
    matSecondaire: terrainCalc?.mat_secondaire,
    docList: terrainCalc?.documentation ? (
      (terrainCalc.document_urls || terrainCalc.documentation.document_urls || '')
        .split(',')
        .filter(Boolean)
        .map((url: string) => {
          const cleanUrl = url.trim();
          const isLocal = cleanUrl.startsWith('/media/');
          const filename = cleanUrl.split('/').pop() || 'document';
          const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
          return { url: cleanUrl, filename, ext, localUrl: isLocal ? cleanUrl : undefined };
        })
    ) : []
  };
};
