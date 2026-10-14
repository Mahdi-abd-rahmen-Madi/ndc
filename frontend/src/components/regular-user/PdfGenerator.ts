import jsPDF from 'jspdf';
import { LookupResult, TerrainDetails } from './types';

// The helper to get terrain details for an equipment item
export const getTerrainDetails = (eq: any, detectedTerrain?: string): TerrainDetails => {
  const rawTerrainType = detectedTerrain || eq.terrain || 'IIIa';
  const terrainTypeKey = `Terrain ${rawTerrainType}`;

  const terrainCalc = eq.terrain_calculations?.find(
    (tc: any) => tc.terrain_type === rawTerrainType || tc.terrain_type === terrainTypeKey
  );

  let materialDisplay = terrainCalc?.material_specification || eq.sub_elements || 'Montage Standard';

  if (terrainCalc) {
    const parts = [];
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

interface PdfGeneratorOptions {
  siteType: string;
  foundationType: string;
  ancrageInfo: string;
  selectedAddress: any;
  selectedCoords: any;
  lookupResult: LookupResult;
  selectedBuildingHeight: number;
  selectedHeight: number;
  selectedMontage: string;
  ant4gModel: string;
  ant4gHeight: number;
  ant4gWidth: number;
  ant4gThickness: number;
  ant4gWeight: number;
  ant5gModel: string;
  ant5gHeight: number;
  ant5gWidth: number;
  ant5gThickness: number;
  ant5gWeight: number;
  hasFhEquipment: boolean;
  fhDiameter: number;
  fhReference: string;
  fhQuantity: number;
  hasRrhEquipment: boolean;
  rrhItems: { id: string; reference: string; quantity: number }[];
  hasRruEquipment: boolean;
  rruItems: { id: string; reference: string; quantity: number }[];
  hasTdEquipment: boolean;
  tdType: 'tetraphase' | 'monophase';
  tdReference: string;
  tgbtReference: string;
  hasGps: boolean;
  gpsMarque?: string;
  gpsQuantity: number;
  gpsReference: string;
  hasBoitierLovage: boolean;
  boitierLovageQuantity: number;
  boitierLovageReference: string;
  hasCoffret: boolean;
  coffretReference: string;
  coffretOptions: { id: string; name: string }[];
  hasBaie?: boolean;
  baieRadio?: boolean;
  baieEnergie?: boolean;
  hasCab?: boolean;
  cabOne?: boolean;
  cabTwo?: boolean;
  cabThree?: boolean;
  cabSupport?: string;
  hasAtelierEnergie?: boolean;
  atelierFprb?: boolean;
  atelierFpbc?: boolean;
  miniMapImage: string | null;
  nombreSecteurs: number;
  operator?: string;
}

export const generateAndDownloadPdf = (options: PdfGeneratorOptions, setPdfGenerating: (val: boolean) => void) => {
  setPdfGenerating(true);

  try {
    const {
      siteType,
      foundationType,
      ancrageInfo,
      selectedAddress,
      selectedCoords,
      lookupResult,
      selectedBuildingHeight,
      selectedHeight,
      selectedMontage,
      ant4gModel,
      ant4gHeight,
      ant4gWidth,
      ant4gThickness,
      ant4gWeight,
      ant5gModel,
      ant5gHeight,
      ant5gWidth,
      ant5gThickness,
      ant5gWeight,
      hasFhEquipment,
      fhDiameter,
      fhReference,
      fhQuantity,
      hasRrhEquipment,
      rrhItems,
      hasRruEquipment,
      rruItems,
      hasTdEquipment,
      tdType,
      tdReference,
      tgbtReference,
      hasGps, gpsMarque, gpsQuantity, gpsReference,
      hasBoitierLovage, boitierLovageQuantity, boitierLovageReference,
      hasCoffret, coffretReference, coffretOptions,
      hasBaie, baieRadio, baieEnergie,
      hasCab, cabOne, cabTwo, cabThree, cabSupport,
      hasAtelierEnergie, atelierFprb, atelierFpbc,
      miniMapImage,
      nombreSecteurs,
      operator
    } = options;

    const doc = new jsPDF();
    const primaryColor = '#4f46e5';
    const secondaryColor = '#64748b';



    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Fiche de Synthèse Technique', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Réf: ${selectedMontage}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, 105, 30, { align: 'center' });

    let yPos = 50;

    // 1. Informations du Site
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Informations du Site', 20, yPos);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const siteDetails = [
      `Type de site: ${siteType === 'nouveau' ? 'Site Neuf' : 'Site Existant'}`,
      `Type de fondation: ${foundationType === 'metallique' ? 'Plot Métallique' : foundationType === 'beton' ? 'Plot Béton' : foundationType === 'encastre' ? 'Encastré' : 'N/A'}`,
      `Type d'ancrage: ${ancrageInfo}`
    ];
    if (selectedAddress?.name) siteDetails.push(`Adresse: ${selectedAddress.name}`);
    siteDetails.push(`Coordonnées: ${selectedCoords.latitude.toFixed(5)}, ${selectedCoords.longitude.toFixed(5)}`);
    siteDetails.forEach(detail => {
      doc.text(`• ${detail}`, 25, yPos);
      yPos += 6;
    });
    yPos += 5;

    // 2. Classification Environnementale
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Classification Environnementale (Eurocode)', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`• Région de vent: Région ${lookupResult.detected_region || 'N/A'}`, 25, yPos);
    yPos += 6;
    doc.text(`• Catégorie de terrain: Terrain ${lookupResult.detected_terrain_type || 'IIIa'}`, 25, yPos);
    yPos += 15;

    // 3. Configuration Structurelle
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Configuration Structurelle', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`• Hauteur du bâtiment: ${selectedBuildingHeight} m`, 25, yPos);
    yPos += 6;
    doc.text(`• Hauteur du mât : ${selectedHeight} m`, 25, yPos);
    yPos += 6;
    doc.text(`• Type de montage: ${selectedMontage}`, 25, yPos);
    yPos += 6;
    doc.text(`• Nombre de secteurs: ${nombreSecteurs}`, 25, yPos);
    yPos += 15;

    // Add map and montage image if available
    if (miniMapImage) {
      try {
        doc.addImage(miniMapImage, 'PNG', 20, yPos, 60, 60);
      } catch (e) {
        console.warn('Could not add mini map image to PDF');
      }
    }

    // New Page for Equipment
    doc.addPage();
    yPos = 20;

    // 4. Équipements : Aériens & Zone Technique
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Spécifications des Équipements (Aériens & Technique)', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 8;

    // Sous-titre : Aériens
    doc.setFontSize(11);
    doc.setTextColor(primaryColor);
    doc.text('Aériens (Antennes & Équipements de mât)', 20, yPos);
    yPos += 5;

    // 4G Specs
    doc.setFillColor(245, 245, 255);
    doc.rect(20, yPos, 80, 45, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Antenne 4G', 25, yPos + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Modèle: ${ant4gModel === 'custom' ? 'Sur-mesure' : (ant4gModel || 'Standard')}`, 25, yPos + 16);
    doc.text(`Dimensions: ${ant4gHeight}x${ant4gWidth}x${ant4gThickness} mm`, 25, yPos + 24);
    doc.text(`Poids unitaire: ${ant4gWeight} daN`, 25, yPos + 32);

    // 5G Specs
    doc.setFillColor(245, 245, 255);
    doc.rect(110, yPos, 80, 45, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Antenne 5G', 115, yPos + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Modèle: ${ant5gModel === 'custom' ? 'Sur-mesure' : (ant5gModel || 'Standard')}`, 115, yPos + 16);
    doc.text(`Dimensions: ${ant5gHeight}x${ant5gWidth}x${ant5gThickness} mm`, 115, yPos + 24);
    doc.text(`Poids unitaire: ${ant5gWeight} daN`, 115, yPos + 32);
    yPos += 52;

    // Équipements Aériens (FH, RRH, RRU, Coffret)
    const showRrhInPdf = operator !== 'bouygues' && hasRrhEquipment && rrhItems && rrhItems.length > 0;
    const hasAerialEquipment = hasFhEquipment || showRrhInPdf || hasRruEquipment || hasCoffret;
    if (hasAerialEquipment) {
      doc.setFillColor(250, 245, 255);

      let aerialCount = 0;
      if (hasFhEquipment) aerialCount++;
      if (showRrhInPdf) aerialCount += rrhItems.length;
      if (hasRruEquipment && rruItems) aerialCount += rruItems.length;
      if (hasCoffret) aerialCount++;

      const boxHeight = 10 + aerialCount * 8;
      doc.rect(20, yPos, 170, boxHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Équipements Aériens Additionnels :`, 25, yPos + 8);

      doc.setFont('helvetica', 'normal');
      let lineY = yPos + 16;
      if (hasFhEquipment) {
        doc.text(`• Faisceau Hertzien (FH) [Unique au site]: Diamètre ${fhDiameter}mm - Réf: ${fhReference || 'N/A'} - Qté: ${fhQuantity}`, 28, lineY);
        lineY += 8;
      }
      if (showRrhInPdf) {
        rrhItems.forEach((item, index) => {
          const totalQty = item.quantity * (nombreSecteurs || 1);
          const totalText = (nombreSecteurs && nombreSecteurs > 1) ? ` (Total site: ${totalQty})` : '';
          doc.text(`• RRH ${rrhItems.length > 1 ? `#${index + 1} ` : ''}[Par secteur]: Réf: ${item.reference || 'Standard'} - Qté: ${item.quantity}/secteur${totalText}`, 28, lineY);
          lineY += 8;
        });
      }
      if (hasRruEquipment && rruItems) {
        rruItems.forEach((item, index) => {
          const prefix = operator === 'free' ? 'RF NSN' : 'RRU';
          const totalQty = item.quantity * (nombreSecteurs || 1);
          const totalText = (nombreSecteurs && nombreSecteurs > 1) ? ` (Total site: ${totalQty})` : '';
          doc.text(`• ${prefix} ${rruItems.length > 1 ? `#${index + 1} ` : ''}[Par secteur]: Réf: ${item.reference || 'Standard'} - Qté: ${item.quantity}/secteur${totalText}`, 28, lineY);
          lineY += 8;
        });
      }
      if (hasCoffret) {
        const refObj = coffretOptions.find((r: any) => r.id === coffretReference);
        const refName = refObj ? `${refObj.name.replace(/\s*\([^)]*\)/g, '').trim()} - Réf: ${refObj.id}` : (coffretReference || 'Standard');
        const totalText = (nombreSecteurs && nombreSecteurs > 1) ? ` (Total site: ${nombreSecteurs})` : '';
        doc.text(`• Coffrets fibre / hybride [Par secteur]: ${refName} - Qté: 1/secteur${totalText}`, 28, lineY);
        lineY += 8;
      }
      yPos += boxHeight + 8;
    }

    // Équipements Zone Technique (TD, GPS, Boîtier de lovage, Baie, CAB, Atelier d'énergie)
    const showBaieInPdf = operator === 'orange' && hasBaie;
    const showCabInPdf = operator === 'free' && hasCab;
    const showAtelierInPdf = operator === 'free' && hasAtelierEnergie;
    const hasTechniqueEquipment = hasTdEquipment || hasGps || hasBoitierLovage || showBaieInPdf || showCabInPdf || showAtelierInPdf;
    if (hasTechniqueEquipment) {
      doc.setFillColor(245, 248, 255);

      let techCount = 0;
      if (hasTdEquipment) techCount++;
      if (hasGps) techCount++;
      if (hasBoitierLovage) techCount++;
      if (showBaieInPdf) techCount++;
      if (showCabInPdf) techCount++;
      if (showAtelierInPdf) techCount++;

      const boxHeight = 10 + techCount * 8;
      doc.rect(20, yPos, 170, boxHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Zone Technique :`, 25, yPos + 8);

      doc.setFont('helvetica', 'normal');
      let lineY = yPos + 16;
      if (hasTdEquipment) {
        const tdStr = tdType === 'monophase'
          ? `• TD Monophasé : Réf TD ${tdReference || 'N/A'} - TGBT 300x255x160mm`
          : `• TD Tétraphasé : Référence ${tdReference || 'N/A'}`;
        doc.text(tdStr, 28, lineY);
        lineY += 8;
      }
      if (hasGps) {
        const marqueStr = gpsMarque ? `${gpsMarque} - ` : '';
        doc.text(`• GPS : ${marqueStr}Référence ${gpsReference || 'Standard'} - Qté: ${gpsQuantity}`, 28, lineY);
        lineY += 8;
      }
      if (hasBoitierLovage) {
        doc.text(`• Boitier de lovage : Référence ${boitierLovageReference || 'Standard'} - Qté: ${boitierLovageQuantity}`, 28, lineY);
        lineY += 8;
      }
      if (showBaieInPdf) {
        const baies = [];
        if (baieRadio) baies.push('Baie radio');
        if (baieEnergie) baies.push('Baie énergie');
        doc.text(`• Présence baie : ${baies.join(', ') || 'Sélectionnée'}`, 28, lineY);
        lineY += 8;
      }
      if (showCabInPdf) {
        const cabs = [];
        if (cabOne) cabs.push('CAB ONE');
        if (cabTwo) cabs.push('CAB TWO');
        if (cabThree) cabs.push('CAB THREE');
        const supportMap: Record<string, string> = {
          plinthes: 'Plinthes',
          support_autostable: 'Support Autostable',
          support_fimo: 'Support FIMO',
          support_muraux: 'Support Muraux'
        };
        const suppLabel = (cabSupport && supportMap[cabSupport]) ? supportMap[cabSupport] : (cabSupport || '');
        const suppText = suppLabel ? ` (Support: ${suppLabel})` : '';
        doc.text(`• Présence Baie CAB : ${cabs.join(', ') || 'Sélectionnée'}${suppText}`, 28, lineY);
        lineY += 8;
      }
      if (showAtelierInPdf) {
        const modules = [];
        if (atelierFprb) modules.push("Module d'énergie FPRB");
        if (atelierFpbc) modules.push('Module FPBC (batterie)');
        doc.text(`• Atelier d'énergie : ${modules.join(', ') || 'Sélectionné'}`, 28, lineY);
        lineY += 8;
      }
      yPos += boxHeight + 10;
    } else {
      yPos += 6;
    }

    // 5. Résultats du Catalogue & Profil Structurel
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Profil Structurel Recommandé', 20, yPos);
    doc.line(20, yPos + 2, 190, yPos + 2);
    yPos += 10;

    const eq = lookupResult.equipment[0];
    if (eq) {
      const { material } = getTerrainDetails(eq, lookupResult.detected_terrain_type);

      doc.setFillColor(240, 253, 244); // bg-emerald-50
      doc.setDrawColor(52, 211, 153); // border-emerald-400
      doc.rect(20, yPos, 170, 30, 'FD');

      doc.setTextColor(5, 150, 105); // text-emerald-600
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SECTION DE MÂT VALIDÉE', 25, yPos + 10);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(material, 25, yPos + 20);
      yPos += 40;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor);
      if (eq.responsible_person) {
        doc.text(`Vérifié par: ${eq.responsible_person}`, 20, yPos);
      }
    } else {
      doc.setTextColor(secondaryColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Aucune correspondance standard trouvée dans le catalogue.', 20, yPos);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} - Document strictement confidentiel - Page ${i}/${pageCount}`,
        105, 290, { align: 'center' }
      );
    }

    doc.save(`Fiche_Technique_${selectedMontage}_${selectedAddress?.city || 'Site'}.pdf`);
  } catch (error) {
    console.error("Error generating PDF", error);
    alert("Erreur lors de la génération du PDF");
  } finally {
    setPdfGenerating(false);
  }
};
