import { MapPin, Wind, Mountain, FileText, CheckCircle2, Download, Activity, RefreshCw, Radio, Layers, Settings } from 'lucide-react';
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
}

export default function ResultsPanel({
  lookupResult,
  selectedAddress,
  selectedMontage,
  isSearching,
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
  recommendedMast5gSection = 'TRON 76x5'
}: ResultsPanelProps) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [conversionError, setConversionError] = useState(false);
  const [cataloguePdf, setCataloguePdf] = useState<{ url: string; filename: string } | null>(null);
  const [loadingCataloguePdf, setLoadingCataloguePdf] = useState(false);
  const enabledConfigs = getEnabledConfigs(equipmentToggles);

  // Get first equipment details for preview button
  const firstEquipmentDetails = lookupResult && lookupResult.equipment.length > 0
    ? getTerrainDetails(lookupResult.equipment[0], lookupResult.detected_terrain_type)
    : null;

  // Fetch matching catalogue PDF based on user criteria
  useEffect(() => {
    const fetchCataloguePdf = async () => {
      if (!lookupResult || !selectedMontage || (mastHeight !== 3 && mastHeight !== 4)) {
        setCataloguePdf(null);
        return;
      }

      setLoadingCataloguePdf(true);
      try {
        // Use building_height since PDF catalogues are categorized by building height
        const equipment = lookupResult.equipment[0];
        const height = equipment?.building_height || 15;

        let actualMontage = selectedMontage;
        if (actualMontage === 'Custom' && equipment?.sub_elements) {
          actualMontage = equipment.sub_elements;
        }

        const params = new URLSearchParams({
          montage: actualMontage,
          terrain_type: lookupResult.detected_terrain_type || 'IIIa',
          region: lookupResult.detected_region || '1',
          height: height.toString()
        });

        if (equipment?.item_id) {
          params.append('item_id', equipment.item_id);
        }

        const response = await fetch(`/api/geodata/matching-catalogue-pdf/?${params}`);

        if (response.ok) {
          const data = await response.json();
          setCataloguePdf({ url: data.url, filename: data.filename });
        } else {
          setCataloguePdf(null);
        }
      } catch (error) {
        console.error('Error fetching catalogue PDF:', error);
        setCataloguePdf(null);
      } finally {
        setLoadingCataloguePdf(false);
      }
    };

    fetchCataloguePdf();
  }, [lookupResult, selectedMontage]);

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
  const pollJobStatus = async (jobId: string, maxAttempts = 40): Promise<any> => {
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
        site: {
          name: siteName || '',
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
           const finalJob = await pollJobStatus(calculationJobId, 40);
           finalJobStatus = finalJob.status;
        } catch(e) {
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
         while (!finalPdfUrl && pdfAttempts < 30) {
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
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 h-full min-h-[400px]">
        <MapPin className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-bold text-slate-400 mb-2">Aucun résultat</h3>
        <p className="text-sm text-center max-w-sm">
          Remplissez les critères de recherche à gauche pour obtenir la classification environnementale et le profil structurel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header Results with Classification on Right */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-800">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            Résultats de l'Analyse
            {isSearching && (
              <span className="flex h-3 w-3 relative ml-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            )}
          </h2>
          {selectedAddress && (
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              {selectedAddress.name}, {selectedAddress.city}
            </p>
          )}
               {/* Consolidated Classification Section on Right */}
        <div className="flex flex-wrap items-center justify-end gap-3 ml-6">
          <div className="group relative bg-slate-800/40 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/60 shadow-lg flex items-center gap-4 hover:bg-slate-800/80 hover:border-indigo-500/30 transition-all duration-300">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shrink-0 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
              <Layers className="w-5 h-5" />
            </div>
            <div className="pr-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Secteurs</p>
              <p className="text-base font-bold text-white leading-none">
                {nombreSecteurs}
              </p>
            </div>
          </div>
          
          <div className="group relative bg-slate-800/40 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/60 shadow-lg flex items-center gap-4 hover:bg-slate-800/80 hover:border-blue-500/30 transition-all duration-300">
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 shrink-0 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
              <Wind className="w-5 h-5" />
            </div>
            <div className="pr-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Région de Vent</p>
              <p className="text-base font-bold text-white leading-none">
                {lookupResult.detected_region ? `Région ${lookupResult.detected_region}` : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="group relative bg-slate-800/40 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/60 shadow-lg flex items-center gap-4 hover:bg-slate-800/80 hover:border-emerald-500/30 transition-all duration-300">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all">
              <Mountain className="w-5 h-5" />
            </div>
            <div className="pr-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Terrain</p>
              <p className="text-base font-bold text-white leading-none">
                Type {lookupResult.detected_terrain_type || 'IIIa'}
              </p>
            </div>
          </div>
        </div>     </div>
      </div>

      {/* Configuration Antennes par Secteur */}
      {sectors && sectors.length > 0 && (
        <div className="mb-8 animate-slide-in">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-400" />
            Configuration Antennes par Secteur
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map((sector, idx) => (
              <div key={sector.id} className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-800 border-l-4 border-l-indigo-500 hover:border-indigo-500/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Secteur {idx + 1}
                  </h4>
                  <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-900 rounded-full border border-slate-800">
                    h mât: {sector.selectedHeight}m
                  </span>
                </div>

                <div className="space-y-4">
                  {/* 4G Antenna */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-400 mb-1">
                      <span>Antenne 4G</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{sector.ant4gConfig.model || 'Standard'}</span>
                    </div>
                    <div className="bg-slate-950/40 rounded p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dimensions:</span>
                        <span className="text-slate-300 font-medium">{sector.ant4gConfig.height}×{sector.ant4gConfig.width}×{sector.ant4gConfig.thickness} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Poids:</span>
                        <span className="text-slate-300 font-medium">{sector.ant4gConfig.weight} daN</span>
                      </div>
                    </div>
                  </div>

                  {/* 5G Antenna */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-400 mb-1">
                      <span>Antenne 5G</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{sector.ant5gConfig.model || 'Standard'}</span>
                    </div>
                    <div className="bg-slate-950/40 rounded p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dimensions:</span>
                        <span className="text-slate-300 font-medium">{sector.ant5gConfig.height}×{sector.ant5gConfig.width}×{sector.ant5gConfig.thickness} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Poids:</span>
                        <span className="text-slate-300 font-medium">{sector.ant5gConfig.weight} daN</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profil Structurel Recommandé (Hidden internally per request) */}
      {lookupResult.equipment.length > 0 && (
        <div className="hidden mb-8 animate-slide-in">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
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
                <div key={idx} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl hover:shadow-emerald-900/20 hover:border-emerald-500/40 transition-all duration-300 group">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors shadow-inner">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </div>
                          <h4 className="text-xl font-extrabold text-white tracking-tight">{displayName}</h4>
                        </div>
                        {showMontage && rawMontage && (
                          <div className="flex items-center gap-2 ml-12">
                            <Layers className="w-4 h-4 text-slate-500" />
                            <p className="text-sm text-slate-400 font-medium">Montage: <span className="text-slate-300">{rawMontage}</span></p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Section Validée
                        </span>
                        {(eq.reference_4g || eq.reference_5g) && (
                          <span className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-full border border-indigo-500/20 flex items-center gap-1.5 shadow-sm">
                            <Activity className="w-3.5 h-3.5" />
                            Dimensions Réelles
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`bg-slate-950/40 rounded-xl p-5 border border-slate-800/50 ${(eq.reference_4g || eq.reference_5g) ? 'mb-4' : ''}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Spécification Matériau</p>
                      </div>
                      {!(firstEquipmentDetails?.matPrincipal || matPrincipal || firstEquipmentDetails?.plotMetallique || plotMetallique || firstEquipmentDetails?.brasDeDeport || brasDeDeport || firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                        <p className="text-emerald-300/90 font-medium whitespace-pre-line leading-relaxed text-sm">
                          {details.material}
                        </p>
                      )}

                      {(firstEquipmentDetails?.matPrincipal || matPrincipal || firstEquipmentDetails?.plotMetallique || plotMetallique || firstEquipmentDetails?.brasDeDeport || brasDeDeport || firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                        <div className="space-y-2.5 text-xs pt-2">
                          {(firstEquipmentDetails?.matPrincipal || matPrincipal) && (
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                              <span className="text-slate-400 font-medium">Mât Principal:</span>
                              <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.matPrincipal || matPrincipal}>
                                {firstEquipmentDetails?.matPrincipal || matPrincipal}
                              </span>
                            </div>
                          )}
                          {(firstEquipmentDetails?.plotMetallique || plotMetallique) && (
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                              <span className="text-slate-400 font-medium">Plot Métallique:</span>
                              <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.plotMetallique || plotMetallique}>
                                {firstEquipmentDetails?.plotMetallique || plotMetallique}
                              </span>
                            </div>
                          )}
                          {(firstEquipmentDetails?.brasDeDeport || brasDeDeport) && (
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                              <span className="text-slate-400 font-medium">Bras de déport:</span>
                              <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.brasDeDeport || brasDeDeport}>
                                {firstEquipmentDetails?.brasDeDeport || brasDeDeport}
                              </span>
                            </div>
                          )}
                          {(firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                              <span className="text-slate-400 font-medium">Mât antenne 5G:</span>
                              <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right max-w-[60%] truncate" title={firstEquipmentDetails?.matSecondaire || matSecondaire}>
                                {firstEquipmentDetails?.matSecondaire || matSecondaire}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {(eq.reference_4g || eq.reference_5g) && (
                      <div className="bg-indigo-950/20 rounded-xl p-5 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-4">
                          <Radio className="w-4 h-4 text-indigo-400" />
                          <p className="text-xs text-indigo-400 uppercase tracking-wider font-semibold">Références Équipement</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {eq.reference_4g && (
                            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50 hover:border-blue-500/30 transition-colors">
                              <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 mb-1.5 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                Modèle 4G
                              </p>
                              <p className="text-sm font-bold text-slate-200">{eq.reference_4g}</p>
                            </div>
                          )}
                          {eq.reference_5g && (
                            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50 hover:border-purple-500/30 transition-colors">
                              <p className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 mb-1.5 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span>
                                Modèle 5G
                              </p>
                              <p className="text-sm font-bold text-slate-200">{eq.reference_5g}</p>
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

      {/* Equipment Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-400" />
          Configuration Équipements
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {enabledConfigs.map((config: EquipmentConfig) => {
            const IconComponent = config.icon === 'Radio' ? Radio : Activity;
            const colorClass = config.color === 'blue' ? 'blue' :
              config.color === 'purple' ? 'purple' :
                config.color === 'amber' ? 'amber' :
                  config.color === 'rose' ? 'rose' : 'emerald';

            // Premium color accent borders
            const accentBorderClasses: Record<string, string> = {
              blue: 'border-l-blue-500 hover:border-blue-500/30',
              purple: 'border-l-purple-500 hover:border-purple-500/30',
              amber: 'border-l-amber-500 hover:border-amber-500/30',
              rose: 'border-l-rose-500 hover:border-rose-500/30',
              emerald: 'border-l-emerald-500 hover:border-emerald-500/30',
            };
            const accentBorder = accentBorderClasses[colorClass] || 'border-l-indigo-500 hover:border-indigo-500/30';

            // Extract Quantité field if it exists
            const quantiteField = config.fields.find(f => f.label.toLowerCase().includes('quantit'));
            const otherFields = config.fields.filter(f => !f.label.toLowerCase().includes('quantit'));

            const renderCard = (keyId: string, qValue: any, itemValues: any, indexLabel?: string) => (
              <div key={keyId} className={`group relative bg-slate-800/40 backdrop-blur-md rounded-xl p-3 border border-slate-700/60 shadow-md flex flex-col gap-2 border-l-[3px] ${accentBorder} hover:bg-slate-800/80 transition-all duration-300`}>
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 bg-${colorClass}-500/10 rounded-lg text-${colorClass}-400 group-hover:bg-${colorClass}-500/20 group-hover:scale-110 transition-all shadow-inner`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-[11px] font-extrabold text-white tracking-tight truncate max-w-[120px]" title={config.name}>
                      {config.name} {indexLabel || ''}
                    </h4>
                  </div>
                  {qValue !== null && (
                    <div className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 shadow-sm flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-300">x{qValue}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 justify-center">
                  {otherFields.length > 0 ? otherFields.map((field, idx) => {
                    const val = itemValues?.[field.label.toLowerCase()] ||
                                itemValues?.[field.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ||
                                field.value;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-950/20 rounded p-1.5 border border-slate-800/30 hover:border-slate-700 transition-colors">
                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">{field.label}</span>
                        <span className="text-xs font-bold text-slate-200 text-right max-w-[65%] truncate" title={String(val)}>
                          {val}
                        </span>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center justify-center h-full text-slate-500 text-[10px] italic">
                      Aucun paramètre
                    </div>
                  )}
                </div>
              </div>
            );

            if (config.id === 'rrh' && equipmentValues.rrhItems && Array.isArray(equipmentValues.rrhItems)) {
              return equipmentValues.rrhItems.map((item, index) => 
                renderCard(`${config.id}-${index}`, item.quantity, { modèle: item.reference || 'N/A' }, equipmentValues.rrhItems.length > 1 ? `#${index + 1}` : '')
              );
            }

            if (config.id === 'rru' && equipmentValues.rruItems && Array.isArray(equipmentValues.rruItems)) {
              return equipmentValues.rruItems.map((item, index) => 
                renderCard(`${config.id}-${index}`, item.quantity, { modèle: item.reference || 'N/A' }, equipmentValues.rruItems.length > 1 ? `#${index + 1}` : '')
              );
            }

            let quantiteValue = null;
            if (quantiteField) {
              quantiteValue = equipmentValues[config.id]?.[quantiteField.label.toLowerCase()] ||
                              equipmentValues[config.id]?.[quantiteField.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ||
                              quantiteField.value;
            }

            return renderCard(config.id, quantiteValue, equipmentValues[config.id]);
          })}
        </div>
      </div>

      {/* Actions & Fallbacks */}
      <div>
        {lookupResult.equipment.length === 0 && (
          <div className="hidden bg-slate-800/30 border border-slate-700 border-dashed rounded-xl p-8 text-center flex flex-col items-center">
            <div className="p-4 bg-slate-800 rounded-full mb-4 relative">
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] font-bold flex items-center justify-center text-white">!</span>
              </span>
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Configuration Hors Catalogue</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
              Les paramètres saisis nécessitent une note de calcul spécifique. À titre indicatif, voici la recommandation standard jusqu'à 4m.
            </p>

            {/* Recommended configuration based on 3-4m values */}
            <div className={`w-full max-w-2xl mx-auto text-left mb-6 ${(mastHeight || 0) > 4 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex items-center gap-2 mb-4 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-bold">Configuration Validée {((mastHeight || 0) > 4) && <span className="text-sm font-normal text-slate-400">(Recommandée uniquement pour 3m et 4m)</span>}</h3>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors"></div>
                <div className="flex flex-col gap-2 items-end absolute top-4 right-4">
                  <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Section Validée
                  </span>
                </div>
                
                <div className="bg-slate-950/40 rounded-xl p-5 border border-slate-800/50 mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Spécification Matériau</p>
                  </div>
                  <div className="space-y-2.5 text-xs pt-2">
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                      <span className="text-slate-400 font-medium">Plot Métallique:</span>
                      <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right">TCAR 150x5</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                      <span className="text-slate-400 font-medium">Bras de déport:</span>
                      <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right">TCAR 50x5</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0">
                      <span className="text-slate-400 font-medium">Mât antenne 5G:</span>
                      <span className="text-slate-200 font-semibold bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800/30 text-right">TRON 76x5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Template Preview OR Catalogue PDF */}
      {(mastHeight !== 3 && mastHeight !== 4) || lookupResult.equipment.length === 0 ? (
        <div className="mt-6 pt-6 border-t border-slate-800">
          <button
            onClick={handlePreviewTemplate}
            disabled={isConverting}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all text-sm"
          >
            {isConverting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {pollingMsg || 'Prévisualisation...'}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Prévisualiser le Template NDC (Mode Debug)
              </>
            )}
          </button>
        </div>
      ) : (
        /* Catalogue PDF Section */
        (loadingCataloguePdf || cataloguePdf) ? (
          <div className="mt-6 pt-6 border-t border-slate-800">
          {loadingCataloguePdf ? (
            <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Recherche du PDF catalogue...</span>
              </div>
            </div>
          ) : cataloguePdf ? (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">PDF Catalogue Correspondant</p>
                    <p className="text-xs text-slate-400">{cataloguePdf.filename}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreviewDocument({ url: cataloguePdf.url, filename: cataloguePdf.filename, ext: 'PDF' })}
                    disabled={isConverting}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConverting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Conversion...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Aperçu</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDownloadDocumentPdf({ url: cataloguePdf.url, filename: cataloguePdf.filename, ext: 'PDF' })}
                    disabled={isDownloadingPdf}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Téléchargement...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Télécharger</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        ) : null
      )}

      {/* Modal PDF Preview extracted to component */}
      <PdfPreviewModal
        previewPdfUrl={previewPdfUrl}
        conversionError={conversionError}
        onClose={() => setPreviewPdfUrl(null)}
      />

      {conversionError && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
          <p className="text-sm text-rose-400">
            Impossible de prévisualiser ce document. Veuillez le télécharger.
          </p>
        </div>
      )}
    </div>
  );
}
