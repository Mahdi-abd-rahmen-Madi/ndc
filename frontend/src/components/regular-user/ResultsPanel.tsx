import { MapPin, Wind, Mountain, FileText, CheckCircle2, Download, Activity, RefreshCw, Radio, Layers, Settings, Server, SignalHigh, ArrowDownToLine, SlidersHorizontal, Ruler, Scale, Sparkles } from 'lucide-react';
import { LookupResult, DocumentInfo, SectorData, AntennaConfigState } from './types';
import { getTerrainDetails } from './PdfGenerator';
import { useState, useEffect } from 'react';
import { getEnabledConfigs, EquipmentConfig } from '../../config/equipmentConfig';
import PdfPreviewModal from './PdfPreviewModal';

interface ResultsPanelProps {
  lookupResult: LookupResult | null;
  selectedAddress: any;
  selectedMontage: string;
  isSearching: boolean;
  matPrincipal?: string;
  plotMetallique?: string;
  brasDeDeport?: string;
  matSecondaire?: string;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
  equipmentToggles?: Record<string, boolean>;
  ndcPdfUrl?: string | null;
  sectors?: SectorData[];
  siteImageUrl?: string | null;
  siteName?: string;
  codeSite?: string;
  clientName?: string;
  clientLogoUrl?: string | null;
  ant4gConfig?: AntennaConfigState;
  ant5gConfig?: AntennaConfigState;
  buildingHeight?: number;
  mastHeight?: number;
  plotHeight?: number;
  recommendedMastSection?: string;
  recommendedPlotSection?: string;
  recommendedBrasSection?: string;
  recommendedMast5gSection?: string;
  hideAnalysisHeader?: boolean;
  headerOnly?: boolean;
  showSectorsCount?: boolean;
  showSectorsConfig?: boolean;
  showEquipmentConfig?: boolean;
  showAerialEquipmentConfig?: boolean;
  showTechniqueEquipmentConfig?: boolean;
  operator?: string;
}

export default function ResultsPanel({
  lookupResult,
  selectedAddress,
  selectedMontage,
  isSearching,
  operator = 'bouygues',
  matPrincipal,
  plotMetallique,
  brasDeDeport,
  matSecondaire,
  nombreSecteurs = 3,
  equipmentValues = {},
  equipmentToggles = {},
  sectors = [],
  siteImageUrl = null,
  siteName = '',
  codeSite = '',
  clientName = '',
  clientLogoUrl = null,
  ant4gConfig,
  ant5gConfig,
  buildingHeight,
  mastHeight,
  plotHeight,
  recommendedMastSection = 'TRON 139x6.3',
  recommendedPlotSection = 'TCAR 200x5',
  recommendedBrasSection = 'TCAR 50x5',
  recommendedMast5gSection = 'TRON 76x5',
  hideAnalysisHeader = false,
  headerOnly = false,
  showSectorsCount = true,
  showSectorsConfig = true,
  showEquipmentConfig = true,
  showAerialEquipmentConfig,
  showTechniqueEquipmentConfig
}: ResultsPanelProps) {
  const isAerialEquipVisible = showAerialEquipmentConfig !== undefined ? showAerialEquipmentConfig : showEquipmentConfig;
  const isTechniqueEquipVisible = showTechniqueEquipmentConfig !== undefined ? showTechniqueEquipmentConfig : showEquipmentConfig;

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [conversionError, setConversionError] = useState(false);
  const enabledConfigs = getEnabledConfigs(equipmentToggles);
  const aerialConfigs = enabledConfigs.filter(c => {
    if (c.zone !== 'aerienne') return false;
    if (c.id === 'rrh' && operator === 'bouygues') return false;
    if (c.id === 'baie' && operator !== 'orange') return false;
    return true;
  });
  const techniqueConfigs = enabledConfigs.filter(c => c.zone === 'technique');

  const displaySectors: SectorData[] = (sectors && sectors.length > 0)
    ? sectors
    : (ant4gConfig || ant5gConfig)
      ? [{
        id: 'sector-default',
        selectedHeight: mastHeight || 3,
        selectedMontage4G: ant4gConfig?.model || '',
        selectedMontage5G: ant5gConfig?.model || '',
        ant4gConfig: ant4gConfig || { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
        ant5gConfig: ant5gConfig || { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
      } as unknown as SectorData]
      : [];

  const renderEquipmentItem = (config: EquipmentConfig) => {
    const IconComponent = config.icon === 'Radio' ? Radio : config.icon === 'Server' ? Server : Activity;
    const colorClass = config.color === 'blue' ? 'blue' :
      config.color === 'purple' ? 'purple' :
        config.color === 'amber' ? 'amber' :
          config.color === 'rose' ? 'rose' :
            config.color === 'orange' ? 'orange' :
              config.color === 'fuchsia' ? 'fuchsia' : 'emerald';

    const accentBorderClasses: Record<string, string> = {
      blue: 'border-l-blue-500 hover:border-blue-400',
      purple: 'border-l-purple-500 hover:border-purple-400',
      amber: 'border-l-amber-500 hover:border-amber-400',
      rose: 'border-l-rose-500 hover:border-rose-400',
      emerald: 'border-l-emerald-500 hover:border-emerald-400',
      orange: 'border-l-orange-500 hover:border-orange-400',
      fuchsia: 'border-l-fuchsia-500 hover:border-fuchsia-400',
    };
    const iconColorClasses: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
      purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
      amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
      rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
      emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
      orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
      fuchsia: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100',
    };
    const accentBorder = accentBorderClasses[colorClass] || 'border-l-violet-600 hover:border-violet-400';

    const quantiteField = config.fields.find(f => f.label.toLowerCase().includes('quantit'));
    const otherFields = config.fields.filter(f => !f.label.toLowerCase().includes('quantit'));

    const renderCard = (
      keyId: string,
      qValue: any,
      itemValues: any,
      indexLabel?: string,
      scopeBadge?: { text: string; bg: string; textCol: string; border: string },
      totalQtyInfo?: { perSector: number; total: number; unit?: string },
      customTitle?: string,
      typeBadge?: { text: string; bg: string; textCol: string; border: string }
    ) => {
      const defaultDisplayName = config.id === 'rru' && operator === 'free' ? 'RF NSN' : config.name;
      const displayName = customTitle || (defaultDisplayName + (indexLabel ? ` ${indexLabel}` : ''));
      return (
        <div key={keyId} className={`group relative bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-sm flex flex-col gap-3 border-l-[3px] ${accentBorder} hover:shadow-md duration-300 transition-all`}>
          {/* Header section */}
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-2.5">
            {/* Line 1: Reserved EXCLUSIVELY for Icon + Full Name / Reference */}
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className={`p-1.5 ${iconColorClasses[colorClass] || 'bg-violet-50 text-violet-600'} rounded-lg group-hover:scale-105 shadow-2xs transition-transform shrink-0`}>
                <IconComponent className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug break-words flex-1 min-w-0" title={displayName}>
                {displayName}
              </h4>
            </div>

            {/* Line 2: Scope & Type badges on left & Stacked Quantity + Total on right */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {typeBadge && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${typeBadge.bg} ${typeBadge.textCol} border ${typeBadge.border}`}>
                    {typeBadge.text}
                  </span>
                )}
                {scopeBadge ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${scopeBadge.bg} ${scopeBadge.textCol} border ${scopeBadge.border}`}>
                    {scopeBadge.text}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {config.zone === 'technique' ? 'Zone technique' : 'Équipement'}
                  </span>
                )}
              </div>

              {totalQtyInfo ? (
                <div className="flex flex-col items-end shrink-0">
                  <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-700">
                      {totalQtyInfo.perSector}/secteur
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-violet-700 mt-0.5 tracking-tight">
                    Total : {totalQtyInfo.total}
                  </span>
                </div>
              ) : qValue !== null ? (
                <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-700">
                    x{qValue}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Body fields with clean non-redundant specs */}
          <div className="flex flex-col gap-1.5 flex-1 justify-center">
            {itemValues && typeof itemValues === 'object' && Object.keys(itemValues).length > 0 ? (
              Object.entries(itemValues).map(([key, val], idx) => {
                if (val === undefined || val === null || val === '') return null;
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center gap-2.5 bg-slate-50/80 rounded-lg p-2 border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
                      {label}
                    </span>
                    <span className="text-xs font-bold text-slate-800 text-right leading-tight max-w-[65%] break-words" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                );
              })
            ) : otherFields.length > 0 ? (
              otherFields.map((field, idx) => {
                const val = itemValues?.[field.label.toLowerCase()] ||
                  itemValues?.[field.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ||
                  field.value;
                return (
                  <div key={idx} className="flex justify-between items-center gap-2.5 bg-slate-50/80 rounded-lg p-2 border border-slate-100 hover:border-slate-200 transition-colors">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">{field.label}</span>
                    <span className="text-xs font-bold text-slate-800 text-right leading-tight max-w-[65%] break-words" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-[10px] italic py-2">
                Aucun paramètre
              </div>
            )}
          </div>
        </div>
      );
    };

    if (config.id === 'fh') {
      const fhVal = equipmentValues.fh || {};
      const qVal = fhVal.quantité || 1;
      return renderCard(
        config.id,
        qVal,
        {
          modèle: fhVal.référence || 'N/A',
          diamètre: fhVal.diamètre || 'N/A',
          ...(fhVal.poids && fhVal.poids !== 'N/A' ? { poids: fhVal.poids } : {})
        },
        '',
        { text: '1x par site', bg: 'bg-amber-50', textCol: 'text-amber-700', border: 'border-amber-200' }
      );
    }

    if (config.id === 'rrh') {
      if (operator === 'bouygues') return null;
      if (equipmentValues.rrhItems && Array.isArray(equipmentValues.rrhItems)) {
        return equipmentValues.rrhItems.map((item, index) => {
          const qty = item.quantity || 1;
          const totalQty = qty * (nombreSecteurs || 1);
          const typeName = 'RRH';
          const title = item.reference || `${typeName} #${index + 1}`;
          const vendor = item.vendor;
          const model = vendor && item.reference && item.reference.startsWith(vendor)
            ? item.reference.substring(vendor.length).trim()
            : item.reference;
          const bodySpecs = vendor && model && model !== item.reference ? {
            marque: vendor,
            modèle: model
          } : {
            modèle: item.reference || 'N/A'
          };

          return renderCard(
            `${config.id}-${index}`,
            qty,
            bodySpecs,
            '',
            { text: 'Par secteur', bg: 'bg-violet-50', textCol: 'text-violet-700', border: 'border-violet-200' },
            { perSector: qty, total: totalQty },
            title,
            { text: typeName, bg: 'bg-rose-50', textCol: 'text-rose-700', border: 'border-rose-200' }
          );
        });
      }
    }

    if (config.id === 'rru' && equipmentValues.rruItems && Array.isArray(equipmentValues.rruItems)) {
      return equipmentValues.rruItems.map((item, index) => {
        const qty = item.quantity || 1;
        const totalQty = qty * (nombreSecteurs || 1);
        const typeName = operator === 'free' ? 'RF NSN' : 'RRU';
        const title = item.reference || `${typeName} #${index + 1}`;
        const vendor = item.vendor;
        const model = vendor && item.reference && item.reference.startsWith(vendor)
          ? item.reference.substring(vendor.length).trim()
          : item.reference;
        const bodySpecs: Record<string, any> = {
          ...(vendor && model && model !== item.reference ? {
            marque: vendor,
            modèle: model
          } : {
            modèle: item.reference || 'N/A'
          }),
          ...(item.dimensions ? { dimensions: item.dimensions } : {}),
          ...(item.weight ? { 'poids unitaire': `${item.weight} kg` } : {}),
          ...(item.weight && totalQty > 1 ? { 'poids total': `${(item.weight * totalQty).toFixed(1)} kg` } : {})
        };

        return renderCard(
          `${config.id}-${index}`,
          qty,
          bodySpecs,
          '',
          { text: 'Par secteur', bg: 'bg-violet-50', textCol: 'text-violet-700', border: 'border-violet-200' },
          { perSector: qty, total: totalQty },
          title,
          { text: typeName, bg: 'bg-emerald-50', textCol: 'text-emerald-700', border: 'border-emerald-200' }
        );
      });
    }

    if (config.id === 'coffrets_fibre') {
      const coffretVal = equipmentValues.coffrets_fibre || {};
      const totalQty = nombreSecteurs || 1;
      return renderCard(
        config.id,
        1,
        {
          modèle: coffretVal.référence || 'Standard'
        },
        '',
        { text: 'Par secteur', bg: 'bg-violet-50', textCol: 'text-violet-700', border: 'border-violet-200' },
        { perSector: 1, total: totalQty }
      );
    }

    if (config.id === 'baie') {
      const items = equipmentValues.baie?.items;
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item: any, index: number) => {
          const qty = item.quantity || 1;
          const specs: Record<string, any> = {
            'catégorie': item.category_label || item.category || 'N/A',
            ...(item.dimensions ? { dimensions: item.dimensions } : {}),
            ...(item.weight ? { 'poids unitaire': `${item.weight} kg` } : {}),
            ...(item.weight && qty > 1 ? { 'poids total': `${item.weight * qty} kg` } : {})
          };
          return renderCard(
            `${config.id}-${index}`,
            qty,
            specs,
            '',
            { text: '1x par site', bg: 'bg-orange-50', textCol: 'text-orange-700', border: 'border-orange-200' },
            undefined,
            item.name,
            { text: item.category_label || 'Baie', bg: 'bg-orange-100', textCol: 'text-orange-800', border: 'border-orange-300' }
          );
        });
      }

      const types = [];
      if (equipmentValues.baie?.baieRadio) types.push('Baie radio');
      if (equipmentValues.baie?.baieEnergie) types.push('Baie énergie');
      return renderCard(config.id, null, { type: types.join(', ') || 'Sélectionnée' });
    }

    if (config.id === 'cab') {
      const types = [];
      if (equipmentValues.cab?.cabOne) types.push('CAB ONE');
      if (equipmentValues.cab?.cabTwo) types.push('CAB TWO');
      if (equipmentValues.cab?.cabThree) types.push('CAB THREE');
      const supportMap: Record<string, string> = {
        plinthes: 'Plinthes',
        support_autostable: 'Support Autostable',
        support_fimo: 'Support FIMO',
        support_muraux: 'Supports Muraux'
      };
      const supportLabel = supportMap[equipmentValues.cab?.support] || equipmentValues.cab?.support || 'N/A';
      return renderCard(config.id, null, { type: types.join(', ') || 'Sélectionnée', support: supportLabel });
    }

    if (config.id === 'atelier_energie') {
      if (operator === 'bouygues') {
        const bcube = equipmentValues.atelier_energie?.bcube;
        return renderCard(config.id, null, {
          modèle: bcube?.name || 'BCube (TD + AE)',
          fournisseur: bcube?.supplier || 'N/A',
          dimensions: bcube?.dimensions || 'N/A',
          poids: bcube?.weight ? `${bcube.weight} kg` : '50 kg'
        }, '', undefined, undefined, 'BCube (TD + AE)');
      }
      const modules = [];
      if (equipmentValues.atelier_energie?.atelierFprb) {
        const qty = equipmentValues.atelier_energie?.atelierFprbQuantity;
        modules.push(qty && qty > 1 ? `${qty}x FPRB` : 'FPRB');
      }
      if (equipmentValues.atelier_energie?.atelierFpbc) {
        const qty = equipmentValues.atelier_energie?.atelierFpbcQuantity;
        modules.push(qty && qty > 1 ? `${qty}x FPBC (batterie)` : 'FPBC (batterie)');
      }
      return renderCard(config.id, null, { modules: modules.join(', ') || 'Sélectionné' });
    }

    if (config.id === 'convertisseur_mdea') {
      const mdea = equipmentValues.convertisseur_mdea;
      const qty = mdea?.quantité || 1;
      return renderCard(config.id, qty, {
        modèle: 'MDEA',
        dimensions: '338*295*140mm',
        poids: `${10 * qty} kg${qty > 1 ? ' (10kg/u)' : ''}`,
        quantité: qty
      });
    }

    let quantiteValue = null;
    if (quantiteField) {
      quantiteValue = equipmentValues[config.id]?.[quantiteField.label.toLowerCase()] ||
        equipmentValues[config.id]?.[quantiteField.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ||
        quantiteField.value;
    }

    return renderCard(config.id, quantiteValue, equipmentValues[config.id]);
  };

  // Get first equipment details for preview button
  const firstEquipmentDetails = lookupResult && lookupResult.equipment.length > 0
    ? getTerrainDetails(lookupResult.equipment[0], lookupResult.detected_terrain_type)
    : null;

  const handlePreviewDocument = async (doc: DocumentInfo) => {
    setIsConverting(true);
    setConversionError(false);
    setPreviewPdfUrl(null);

    try {
      // Call backend API to convert docx to PDF
      const apiUrl = '/api/geodata/preview-document/';
      const response = await fetch(`${apiUrl}?url=${encodeURIComponent(doc.url)}`);

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const data = await response.json();

      if (data.preview_url) {
        // Construct full URL if it's a relative path
        const fullUrl = data.preview_url.startsWith('http')
          ? data.preview_url
          : `${window.location.origin}${data.preview_url}`;
        setPreviewPdfUrl(fullUrl);
      } else {
        throw new Error('No preview URL returned');
      }
    } catch (error) {
      console.error('Error converting document:', error);
      setConversionError(true);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadDocumentPdf = async (doc: DocumentInfo) => {
    // If it's already a PDF, download it directly
    if (doc.url.toLowerCase().endsWith('.pdf')) {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.filename;
      link.click();
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const apiUrl = '/api/geodata/preview-document/';
      const response = await fetch(`${apiUrl}?url=${encodeURIComponent(doc.url)}`);

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const data = await response.json();

      if (data.preview_url) {
        const fullUrl = data.preview_url.startsWith('http')
          ? data.preview_url
          : `${window.location.origin}${data.preview_url}`;

        // Derive pdf filename by replacing extension
        const pdfFilename = doc.filename.replace(/\.[^/.]+$/, "") + ".pdf";

        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = pdfFilename;
        link.click();
      } else {
        throw new Error('No preview URL returned');
      }
    } catch (error) {
      console.error('Error downloading document as PDF:', error);
      // Fallback: download original docx
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.filename;
      link.click();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const [pollingMsg, setPollingMsg] = useState<string>('');

  // Helper to poll job status
  const pollJobStatus = async (jobId: string, maxAttempts = 120): Promise<any> => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const res = await fetch(`/api/calculations/${jobId}/`, {
          headers: { 'Authorization': `Token ${localStorage.getItem('ndc_auth_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Check if PDF generation is completed (ndc_pdf_url exists) or job failed
          if (data.status === 'FAILED' || ((data.status === 'COMPLETED' || data.status === 'PENDING') && data.result_data?.ndc_pdf_url)) {
            return data;
          }
          // If just COMPLETED or PENDING with result data but no PDF yet, we keep polling (for generate_pdf step)
          if ((data.status === 'COMPLETED' || (data.status === 'PENDING' && data.result_data)) && attempts > 0) {
            return data; // Return early if we are just polling for initial completion
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
      attempts++;
    }
    throw new Error("Polling timeout");
  };

  const handlePreviewTemplate = async () => {
    setIsConverting(true);
    setConversionError(false);
    setPreviewPdfUrl(null);
    setPollingMsg('Création du job Robot...');

    try {
      const payload: any = {
        code_site: codeSite || '',
        ref_site: codeSite || '',
        site: {
          name: siteName || '',
          code_site: codeSite || '',
          ref_site: codeSite || '',
          client: clientName || '',
          address: selectedAddress?.label || selectedAddress?.name || '',
          client_logo_url: clientLogoUrl || '',
          photo_url: siteImageUrl || '',
          ancrage: 'metallique' // Robot Worker requires this
        },
        environment: {
          region: (() => {
            const r = lookupResult?.detected_region;
            if (typeof r === 'object' && r !== null) return (r as any).number || 2;
            if (typeof r === 'number') return r;
            if (typeof r === 'string') return parseInt(r.replace(/\D/g, ''), 10) || 2;
            return 2;
          })(),
          terrain_type: lookupResult?.detected_terrain_type || '0',
          building_height_m: buildingHeight || 0,
          plot_height_m: plotHeight || 0
        },
        structure: {
          mast_height_m: mastHeight || 0,
          hauteur_mat_m: mastHeight || 0,
          montage_id: selectedMontage || "cas_1",
          is_custom_montage: selectedMontage === 'Custom',
          mat_principal: firstEquipmentDetails?.matPrincipal || matPrincipal || recommendedMastSection,
          mat_secondaire: firstEquipmentDetails?.matSecondaire || matSecondaire || recommendedMast5gSection,
          plot_metallique: firstEquipmentDetails?.plotMetallique || plotMetallique || recommendedPlotSection,
          bras_de_deport: firstEquipmentDetails?.brasDeDeport || brasDeDeport || recommendedBrasSection,
          mast_section: firstEquipmentDetails?.matPrincipal || matPrincipal || recommendedMastSection,
          plot_section: firstEquipmentDetails?.plotMetallique || plotMetallique || recommendedPlotSection,
          bras_section: firstEquipmentDetails?.brasDeDeport || brasDeDeport || recommendedBrasSection,
          mast_5g_section: firstEquipmentDetails?.matSecondaire || matSecondaire || recommendedMast5gSection,
          material_name: 'S 235'
        }
      };

      if (ant4gConfig) {
        payload.antenna_4g = {
          model: ant4gConfig.model || 'Standard',
          hauteur_mm: ant4gConfig.height,
          largeur_mm: ant4gConfig.width,
          epaisseur_mm: ant4gConfig.thickness,
          poids_kg: ant4gConfig.weight
        };
      }

      if (ant5gConfig) {
        payload.antenna_5g = {
          model: ant5gConfig.model || 'Standard',
          hauteur_mm: ant5gConfig.height,
          largeur_mm: ant5gConfig.width,
          epaisseur_mm: ant5gConfig.thickness,
          poids_kg: ant5gConfig.weight
        };
      }

      let calculationJobId = null;
      let finalJobStatus = null;

      try {
        const calcResponse = await fetch('/api/calculations/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${localStorage.getItem('ndc_auth_token')}`
          },
          body: JSON.stringify(payload)
        });
        if (calcResponse.ok) {
          const calcData = await calcResponse.json();
          calculationJobId = calcData.data?.id;
        } else {
          const errText = await calcResponse.text();
          console.error("Calculation API returned error:", errText);
        }
      } catch (e) {
        console.error("Failed to trigger robot calculation", e);
      }

      if (calculationJobId) {
        setPollingMsg('Calcul Robot en cours...');
        try {
          const finalJob = await pollJobStatus(calculationJobId, 120);
          finalJobStatus = finalJob.status;
        } catch (e) {
          console.error(e);
        }
      }

      setPollingMsg('Génération du PDF...');
      const pdfEndpoint = (calculationJobId && (finalJobStatus === 'COMPLETED' || finalJobStatus === 'PENDING'))
        ? `/api/calculations/${calculationJobId}/generate_pdf/`
        : '/api/calculations/preview_template/';

      const response = await fetch(pdfEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${localStorage.getItem('ndc_auth_token')}`
        },
        body: JSON.stringify({ ...payload, photo_url: siteImageUrl })
      });
      if (!response.ok) throw new Error('Preview failed');
      const data = await response.json();

      let finalPdfUrl = data.ndc_pdf_url;

      // If it's an async task (from generate_pdf), poll until PDF URL is ready
      if (data.task_id && calculationJobId) {
        setPollingMsg('Génération asynchrone du PDF...');
        let pdfAttempts = 0;
        while (!finalPdfUrl && pdfAttempts < 120) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const pollRes = await fetch(`/api/calculations/${calculationJobId}/`, {
            headers: { 'Authorization': `Token ${localStorage.getItem('ndc_auth_token')}` }
          });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.result_data?.ndc_pdf_url) {
              finalPdfUrl = pollData.result_data.ndc_pdf_url;
            }
          }
          pdfAttempts++;
        }
      }

      if (finalPdfUrl) {
        const fullUrl = finalPdfUrl.startsWith('http')
          ? finalPdfUrl
          : `${window.location.origin}${finalPdfUrl}`;
        setPreviewPdfUrl(fullUrl);
      } else {
        throw new Error('No preview URL returned');
      }
    } catch (error) {
      console.error('Error fetching template preview:', error);
      setConversionError(true);
    } finally {
      setIsConverting(false);
      setPollingMsg('');
    }
  };

  if (!lookupResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 h-full min-h-[400px]">
        <MapPin className="w-16 h-16 mb-4 opacity-30 text-slate-300" />
        <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun résultat</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm">
          Remplissez les critères de recherche à gauche pour obtenir la classification environnementale et le profil structurel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header Results with Classification on Right — shown only once */}
      {!hideAnalysisHeader && (
        <div className="mb-5 p-4 sm:p-5 bg-gradient-to-r from-white via-violet-50/20 to-white rounded-2xl border border-slate-200/90 shadow-sm relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-violet-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-4">
            {/* Top row: Title on left, Metric badges on right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Configuration du site
                </h2>
                {isSearching && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
                  </span>
                )}
              </div>

              {/* Badges grouped cleanly together */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {showSectorsCount && (
                  <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs flex items-center gap-2.5 hover:border-violet-300 transition-all">
                    <div className="p-1.5 bg-violet-50 rounded-lg text-violet-600 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Secteurs</p>
                      <p className="text-sm font-bold text-slate-900 leading-none">
                        {nombreSecteurs}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs flex items-center gap-2.5 hover:border-blue-300 transition-all">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Région de Vent</p>
                    <p className="text-sm font-bold text-slate-900 leading-none">
                      {lookupResult.detected_region ? `Région ${lookupResult.detected_region}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom row: Full address with 100% width, no truncation */}
            {selectedAddress && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-600 w-full shadow-2xs">
                <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
                <span className="font-semibold text-slate-700 shrink-0">Adresse :</span>
                <span className="text-slate-800 font-medium whitespace-normal break-words sm:whitespace-nowrap sm:overflow-x-auto sm:scrollbar-none">
                  {selectedAddress.name}, {selectedAddress.city}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {!headerOnly && (
        <>
          {/* Aériens : Secteurs & Équipements de mât */}
          {(showSectorsConfig || (isAerialEquipVisible && aerialConfigs.length > 0)) && (
            <div className="mb-5 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-violet-600" />
                  Aériens
                </h3>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 tracking-normal shadow-2xs">
                  Antennes & Mâts
                </span>
              </div>

              {/* Sub-section 1: Antennes 4G & 5G */}
              {showSectorsConfig && displaySectors.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-violet-600" />
                      Antennes 4G & 5G
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {displaySectors.length} secteur{displaySectors.length > 1 ? 's' : ''} {displaySectors.length > 1 ? 'identiques' : 'configuré'}
                    </span>
                  </div>

                  {/* Group identical sectors to avoid repeating duplicate cards */}
                  {(() => {
                    const formatSectorTitle = (indices: number[]) => {
                      if (indices.length === 1) return `Secteur ${indices[0]}`;
                      if (indices.length === 2) return `Secteurs ${indices[0]} & ${indices[1]}`;
                      const allButLast = indices.slice(0, -1).join(', ');
                      return `Secteurs ${allButLast} & ${indices[indices.length - 1]}`;
                    };

                    const groupedDisplaySectors: { indices: number[]; sector: SectorData }[] = [];
                    displaySectors.forEach((s, idx) => {
                      const sectorNum = idx + 1;
                      const existingGroup = groupedDisplaySectors.find(g => {
                        const prev = g.sector;
                        const sameHeight = prev.selectedHeight === s.selectedHeight;
                        const sameMode = (prev.configMode || 'agile') === (s.configMode || 'agile');
                        const isModeAgile = (prev.configMode || 'agile') === 'agile';
                        const same4G = isModeAgile
                          ? prev.ant4gConfig?.height === s.ant4gConfig?.height &&
                          prev.ant4gConfig?.width === s.ant4gConfig?.width &&
                          prev.ant4gConfig?.thickness === s.ant4gConfig?.thickness &&
                          prev.ant4gConfig?.weight === s.ant4gConfig?.weight
                          : prev.selectedVendor4G === s.selectedVendor4G && prev.selectedReference4G === s.selectedReference4G;
                        const same5G = isModeAgile
                          ? prev.ant5gConfig?.height === s.ant5gConfig?.height &&
                          prev.ant5gConfig?.width === s.ant5gConfig?.width &&
                          prev.ant5gConfig?.thickness === s.ant5gConfig?.thickness &&
                          prev.ant5gConfig?.weight === s.ant5gConfig?.weight
                          : prev.selectedVendor5G === s.selectedVendor5G && prev.selectedReference5G === s.selectedReference5G;
                        return sameHeight && sameMode && same4G && same5G;
                      });

                      if (existingGroup) {
                        existingGroup.indices.push(sectorNum);
                      } else {
                        groupedDisplaySectors.push({ indices: [sectorNum], sector: s });
                      }
                    });

                    return (
                      <div className="space-y-3">
                        {groupedDisplaySectors.map((group, groupIdx) => {
                          const sector = group.sector;
                          const isAgile = sector.configMode === 'agile' || !sector.configMode;
                          const brand4G = sector.selectedVendor4G || 'Standard';
                          const model4G = sector.ant4gConfig?.model || sector.selectedReference4G || 'Standard';
                          const brand5G = sector.selectedVendor5G || 'Standard';
                          const model5G = sector.ant5gConfig?.model || sector.selectedReference5G || 'Standard';

                          const dim4G = sector.ant4gConfig && sector.ant4gConfig.height > 0
                            ? `${sector.ant4gConfig.height} × ${sector.ant4gConfig.width} × ${sector.ant4gConfig.thickness} mm`
                            : 'Non spécifié';
                          const weight4G = sector.ant4gConfig && sector.ant4gConfig.weight > 0
                            ? `${sector.ant4gConfig.weight} kg`
                            : 'N/A';

                          const dim5G = sector.ant5gConfig && sector.ant5gConfig.height > 0
                            ? `${sector.ant5gConfig.height} × ${sector.ant5gConfig.width} × ${sector.ant5gConfig.thickness} mm`
                            : 'Non spécifié';
                          const weight5G = sector.ant5gConfig && sector.ant5gConfig.weight > 0
                            ? `${sector.ant5gConfig.weight} kg`
                            : 'N/A';

                          return (
                            <div key={groupIdx} className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm hover:border-violet-300 transition-all">
                              {/* Sector Header with Mast Height */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse"></span>
                                    {formatSectorTitle(group.indices)}
                                  </h4>
                                  {group.indices.length > 1 && (
                                    <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                      {group.indices.length} secteurs identiques
                                    </span>
                                  )}
                                  {isAgile ? (
                                    <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200 flex items-center gap-1 shadow-2xs">
                                      <SlidersHorizontal className="w-2.5 h-2.5 text-violet-600" />
                                      Configuration Agile
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shadow-2xs">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Références Réelles
                                    </span>
                                  )}
                                </div>
                                {sector.selectedHeight && sector.selectedHeight !== 3 && sector.selectedHeight !== 4 ? (
                                  <span className="text-[10px] font-bold text-amber-800 px-2.5 py-0.5 bg-amber-50/90 border border-amber-300 rounded-full flex items-center gap-1.5 shadow-2xs animate-fadeIn">
                                    <span className="text-amber-700 font-medium">Mât :</span>
                                    <span className="font-extrabold text-amber-950">{sector.selectedHeight}m</span>
                                    <span className="text-[8px] px-1.5 py-0.2 bg-amber-200/90 text-amber-900 rounded font-bold uppercase tracking-wider">Sur-mesure</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-600 px-2.5 py-0.5 bg-slate-100 rounded-full border border-slate-200 flex items-center gap-1.5">
                                    <ArrowDownToLine className="w-3 h-3 text-violet-600" />
                                    <span className="text-slate-500">Mât :</span>
                                    <span className="font-bold text-slate-800">{sector.selectedHeight}m</span>
                                  </span>
                                )}
                              </div>

                              {/* 4G & 5G Cards side by side */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* 4G Antenna */}
                                <div className="bg-slate-50/70 border border-slate-200/90 border-l-[3px] border-l-blue-500 rounded-xl p-3 flex flex-col justify-between hover:bg-slate-50 transition-colors shadow-2xs">
                                  <div className="flex items-center justify-between mb-2.5 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 border border-blue-200/60 shadow-2xs shrink-0">
                                        <Radio className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-xs font-bold text-slate-900 truncate">Antenne 4G</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                                      4G LTE
                                    </span>
                                  </div>

                                  {isAgile ? (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                            <Ruler className="w-3 h-3 text-blue-500 shrink-0" />
                                            Dimensions
                                          </span>
                                          <span className="text-xs font-extrabold text-slate-800 truncate mt-0.5" title={dim4G}>
                                            {dim4G}
                                          </span>
                                        </div>
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                            <Scale className="w-3 h-3 text-blue-500 shrink-0" />
                                            Poids
                                          </span>
                                          <span className="text-xs font-extrabold text-slate-800 truncate mt-0.5">
                                            {weight4G}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-violet-600 font-medium flex items-center gap-1 pt-0.5">
                                        <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                                        <span>Gabarit agile (sans référence constructeur)</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Marque</span>
                                          <span className="text-xs font-bold text-slate-800 truncate mt-0.5" title={brand4G}>
                                            {brand4G}
                                          </span>
                                        </div>
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Modèle</span>
                                          <span className="text-xs font-bold text-slate-800 truncate mt-0.5" title={model4G}>
                                            {model4G}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between pt-0.5">
                                        <span>Dimensions : {dim4G}</span>
                                        <span>{weight4G}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* 5G Antenna */}
                                <div className="bg-slate-50/70 border border-slate-200/90 border-l-[3px] border-l-purple-500 rounded-xl p-3 flex flex-col justify-between hover:bg-slate-50 transition-colors shadow-2xs">
                                  <div className="flex items-center justify-between mb-2.5 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600 border border-purple-200/60 shadow-2xs shrink-0">
                                        <SignalHigh className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="text-xs font-bold text-slate-900 truncate">Antenne 5G</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                                      5G NR
                                    </span>
                                  </div>

                                  {isAgile ? (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                            <Ruler className="w-3 h-3 text-purple-500 shrink-0" />
                                            Dimensions
                                          </span>
                                          <span className="text-xs font-extrabold text-slate-800 truncate mt-0.5" title={dim5G}>
                                            {dim5G}
                                          </span>
                                        </div>
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                            <Scale className="w-3 h-3 text-purple-500 shrink-0" />
                                            Poids
                                          </span>
                                          <span className="text-xs font-extrabold text-slate-800 truncate mt-0.5">
                                            {weight5G}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-purple-700 font-medium flex items-center gap-1 pt-0.5">
                                        <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                        <span>Gabarit agile (sans référence constructeur)</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Marque</span>
                                          <span className="text-xs font-bold text-slate-800 truncate mt-0.5" title={brand5G}>
                                            {brand5G}
                                          </span>
                                        </div>
                                        <div className="flex flex-col bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs min-w-0">
                                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Modèle</span>
                                          <span className="text-xs font-bold text-slate-800 truncate mt-0.5" title={model5G}>
                                            {model5G}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between px-2 py-1 bg-slate-100/70 border border-slate-200/80 rounded-lg text-[10px] text-slate-600 font-medium">
                                        <span>Dimensions : {dim5G}</span>
                                        <span>{weight5G}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Sub-section 2: Aerial equipments */}
              {isAerialEquipVisible && aerialConfigs.length > 0 && (
                <div className={`${showSectorsConfig && displaySectors.length > 0 ? 'mt-6 pt-5 border-t border-slate-200/80' : ''}`}>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Équipements Aériens Additionnels
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {aerialConfigs.map(renderEquipmentItem)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profil Structurel Recommandé (Hidden internally per request) */}
          {lookupResult.equipment.length > 0 && (
            <div className="hidden mb-8 animate-slide-in">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                Profil Structurel Recommandé
              </h3>
              <div className="space-y-4">
                {lookupResult.equipment.map((eq: any, idx: number) => {
                  const details = getTerrainDetails(eq, lookupResult.detected_terrain_type);

                  const rawName = eq.name || '';
                  const rawMontage = eq.sub_elements || selectedMontage || '';

                  // Hide A1 / A1.2 text variations as requested
                  const isA1Name = /a1(\.\d+)?/i.test(rawName);
                  const isA1Montage = /a1(\.\d+)?/i.test(rawMontage);

                  const displayName = isA1Name ? "Configuration Validée" : rawName;
                  const showMontage = !isA1Montage;

                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-emerald-500/40 duration-300 group">
                      <div className="p-4 sm:p-5">
                        <div className="flex justify-between items-start mb-5">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              </div>
                              <h4 className="text-xl font-extrabold text-slate-900 tracking-tight">{displayName}</h4>
                            </div>
                            {showMontage && rawMontage && (
                              <div className="flex items-center gap-2 ml-12">
                                <Layers className="w-4 h-4 text-slate-500" />
                                <p className="text-sm text-slate-500 font-medium">Montage: <span className="text-slate-800">{rawMontage}</span></p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Section Validée
                            </span>
                            {(eq.reference_4g || eq.reference_5g) && (
                              <span className="px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-bold rounded-full border border-violet-200 flex items-center gap-1.5 shadow-sm">
                                <Activity className="w-3.5 h-3.5" />
                                Dimensions Réelles
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={`bg-slate-50 rounded-xl p-5 border border-slate-200 ${(eq.reference_4g || eq.reference_5g) ? 'mb-4' : ''}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Settings className="w-4 h-4 text-slate-500" />
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Spécification Matériau</p>
                          </div>
                          {!(firstEquipmentDetails?.matPrincipal || matPrincipal || firstEquipmentDetails?.plotMetallique || plotMetallique || firstEquipmentDetails?.brasDeDeport || brasDeDeport || firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                            <p className="text-emerald-800 font-medium whitespace-pre-line leading-relaxed text-sm">
                              {details.material}
                            </p>
                          )}

                          {(firstEquipmentDetails?.matPrincipal || matPrincipal || firstEquipmentDetails?.plotMetallique || plotMetallique || firstEquipmentDetails?.brasDeDeport || brasDeDeport || firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                            <div className="space-y-2.5 text-xs pt-2">
                              {(firstEquipmentDetails?.matPrincipal || matPrincipal) && (
                                <div className="flex justify-between items-center py-0.5 border-b border-slate-200 last:border-0">
                                  <span className="text-slate-500 font-medium">Mât Principal:</span>
                                  <span className="text-slate-800 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.matPrincipal || matPrincipal}>
                                    {firstEquipmentDetails?.matPrincipal || matPrincipal}
                                  </span>
                                </div>
                              )}
                              {(firstEquipmentDetails?.plotMetallique || plotMetallique) && (
                                <div className="flex justify-between items-center py-0.5 border-b border-slate-200 last:border-0">
                                  <span className="text-slate-500 font-medium">Plot Métallique:</span>
                                  <span className="text-slate-800 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.plotMetallique || plotMetallique}>
                                    {firstEquipmentDetails?.plotMetallique || plotMetallique}
                                  </span>
                                </div>
                              )}
                              {(firstEquipmentDetails?.brasDeDeport || brasDeDeport) && (
                                <div className="flex justify-between items-center py-0.5 border-b border-slate-200 last:border-0">
                                  <span className="text-slate-500 font-medium">Bras de déport:</span>
                                  <span className="text-slate-800 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.brasDeDeport || brasDeDeport}>
                                    {firstEquipmentDetails?.brasDeDeport || brasDeDeport}
                                  </span>
                                </div>
                              )}
                              {(firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                                <div className="flex justify-between items-center py-0.5 border-b border-slate-200 last:border-0">
                                  <span className="text-slate-500 font-medium">Mât antenne 5G:</span>
                                  <span className="text-slate-800 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.matSecondaire || matSecondaire}>
                                    {firstEquipmentDetails?.matSecondaire || matSecondaire}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {(eq.reference_4g || eq.reference_5g) && (
                          <div className="bg-violet-50/50 rounded-xl p-5 border border-violet-100">
                            <div className="flex items-center gap-2 mb-4">
                              <Radio className="w-4 h-4 text-violet-600" />
                              <p className="text-xs text-violet-700 uppercase tracking-wider font-semibold">Références Équipement</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {eq.reference_4g && (
                                <div className="bg-white rounded-lg p-3 border border-slate-200 hover:border-blue-300 transition-colors shadow-sm">
                                  <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 mb-1.5 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Modèle 4G
                                  </p>
                                  <p className="text-sm font-bold text-slate-800">{eq.reference_4g}</p>
                                </div>
                              )}
                              {eq.reference_5g && (
                                <div className="bg-white rounded-lg p-3 border border-slate-200 hover:border-violet-300 transition-colors shadow-sm">
                                  <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 mb-1.5 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                    Modèle 5G
                                  </p>
                                  <p className="text-sm font-bold text-slate-800">{eq.reference_5g}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Zone Technique */}
          {isTechniqueEquipVisible && techniqueConfigs.length > 0 && (
            <div className="mb-5 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Zone Technique
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-normal">
                  Local technique & Baies
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {techniqueConfigs.map(renderEquipmentItem)}
              </div>
            </div>
          )}

          {/* Actions & Fallbacks */}
          <div>
            {lookupResult.equipment.length === 0 && (
              <div className="hidden bg-slate-50 border border-slate-300 border-dashed rounded-xl p-8 text-center flex flex-col items-center">
                <div className="p-4 bg-slate-100 rounded-full mb-4 relative">
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] font-bold flex items-center justify-center text-white">!</span>
                  </span>
                  <FileText className="w-8 h-8 text-slate-500" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Configuration Hors Catalogue</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  Les paramètres saisis nécessitent une note de calcul spécifique. À titre indicatif, voici la recommandation standard jusqu'à 4m.
                </p>

                {/* Recommended configuration based on 3-4m values */}
                <div className={`w-full max-w-2xl mx-auto text-left mb-6 ${(mastHeight || 0) > 4 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                  <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <h3 className="font-bold">Configuration Validée {((mastHeight || 0) > 4) && <span className="text-sm font-normal text-slate-500">(Recommandée uniquement pour 3m et 4m)</span>}</h3>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 relative overflow-hidden group hover:border-emerald-300 transition-colors">
                    <div className="flex flex-col gap-2 items-end absolute top-4 right-4">
                      <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Section Validée
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-slate-200 mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Spécification Matériau</p>
                      </div>
                      <div className="space-y-2.5 text-xs pt-2">
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                          <span className="text-slate-500 font-medium">Plot Métallique:</span>
                          <span className="text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-right">TCAR 150x5</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                          <span className="text-slate-500 font-medium">Bras de déport:</span>
                          <span className="text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-right">TCAR 50x5</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                          <span className="text-slate-500 font-medium">Mât antenne 5G:</span>
                          <span className="text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-right">TRON 76x5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal PDF Preview extracted to component */}
          <PdfPreviewModal
            previewPdfUrl={previewPdfUrl}
            conversionError={conversionError}
            onClose={() => setPreviewPdfUrl(null)}
          />

          {conversionError && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <p className="text-sm text-rose-600">
                Impossible de prévisualiser ce document. Veuillez le télécharger.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
