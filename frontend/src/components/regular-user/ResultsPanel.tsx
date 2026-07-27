import { MapPin, Wind, Mountain, FileText, CheckCircle2, Download, Activity, AlertCircle, RefreshCw, Radio, Layers } from 'lucide-react';
import { LookupResult, DocumentInfo } from './types';
import { getTerrainDetails } from './PdfGenerator';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getEnabledConfigs, EquipmentConfig } from '../../config/equipmentConfig';

interface ResultsPanelProps {
  lookupResult: LookupResult | null;
  selectedAddress: any;
  selectedMontage: string;
  isSearching: boolean;
  onDownloadPdf: () => void;
  pdfGenerating: boolean;
  onTriggerCalculation: () => void;
  isCalculationPending: boolean;
  matPrincipal: string;
  setMatPrincipal: (val: string) => void;
  plotMetallique: string;
  setPlotMetallique: (val: string) => void;
  brasDeDeport: string;
  setBrasDeDeport: (val: string) => void;
  matSecondaire: string;
  setMatSecondaire: (val: string) => void;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
  equipmentToggles?: Record<string, boolean>;
  ndcPdfUrl?: string | null;
}

export default function ResultsPanel({
  lookupResult,
  selectedAddress,
  selectedMontage,
  isSearching,
  onDownloadPdf,
  pdfGenerating,
  onTriggerCalculation,
  isCalculationPending,
  matPrincipal,
  setMatPrincipal,
  plotMetallique,
  setPlotMetallique,
  brasDeDeport,
  setBrasDeDeport,
  matSecondaire,
  setMatSecondaire,
  nombreSecteurs = 3,
  equipmentValues = {},
  equipmentToggles = {},
  ndcPdfUrl = null
}: ResultsPanelProps) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
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
      if (!lookupResult || !selectedMontage) {
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

  const handlePreviewTemplate = async () => {
    setIsConverting(true);
    setConversionError(false);
    setPreviewPdfUrl(null);

    try {
      const apiUrl = '/api/calculations/preview_template/';
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Preview failed');
      const data = await response.json();
      if (data.ndc_pdf_url) {
        const fullUrl = data.ndc_pdf_url.startsWith('http') 
          ? data.ndc_pdf_url 
          : `${window.location.origin}${data.ndc_pdf_url}`;
        setPreviewPdfUrl(fullUrl);
      } else {
        throw new Error('No preview URL returned');
      }
    } catch (error) {
      console.error('Error fetching template preview:', error);
      setConversionError(true);
    } finally {
      setIsConverting(false);
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
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
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
        </div>
        
        {/* Consolidated Classification Section on Right */}
        <div className="flex gap-3 ml-6">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-3 hover:bg-slate-800 transition-colors">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Secteurs</p>
              <p className="text-sm font-bold text-white">
                {nombreSecteurs}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-3 hover:bg-slate-800 transition-colors">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 shrink-0">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Région</p>
              <p className="text-sm font-bold text-white">
                Région {lookupResult.detected_region || 'N/A'}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center gap-3 hover:bg-slate-800 transition-colors">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Terrain</p>
              <p className="text-sm font-bold text-white">
                Type {lookupResult.detected_terrain_type || 'IIIa'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Configuration Équipements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enabledConfigs.map((config: EquipmentConfig) => {
            const IconComponent = config.icon === 'Radio' ? Radio : Activity;
            const colorClass = config.color === 'blue' ? 'blue' :
                              config.color === 'purple' ? 'purple' :
                              config.color === 'amber' ? 'amber' :
                              config.color === 'rose' ? 'rose' : 'emerald';
            
            return (
              <div key={config.id} className={`bg-slate-800/50 rounded-xl p-4 border border-slate-700/50`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 bg-${colorClass}-500/10 rounded-lg text-${colorClass}-400`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">{config.name}</h4>
                </div>
                <div className="space-y-2 text-sm">
                  {config.fields.map((field, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-slate-400">{field.label}:</span>
                      <span className="text-white font-medium">
                        {equipmentValues[config.id]?.[field.label.toLowerCase()] || 
                         equipmentValues[config.id]?.[field.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || 
                         field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Section Mat in Configuration Équipements */}
          {(firstEquipmentDetails?.matPrincipal || matPrincipal || firstEquipmentDetails?.plotMetallique || plotMetallique || firstEquipmentDetails?.brasDeDeport || brasDeDeport || firstEquipmentDetails?.matSecondaire || matSecondaire) && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Sections d'Équipement</h4>
              </div>
              <div className="space-y-2 text-sm">
                {(firstEquipmentDetails?.matPrincipal || matPrincipal) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Section Mat Terrain 0:</span>
                    <span className="text-white font-medium text-right">{firstEquipmentDetails?.matPrincipal || matPrincipal}</span>
                  </div>
                )}
                {(firstEquipmentDetails?.plotMetallique || plotMetallique) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Section Plot Métallique:</span>
                    <span className="text-white font-medium text-right">{firstEquipmentDetails?.plotMetallique || plotMetallique}</span>
                  </div>
                )}
                {(firstEquipmentDetails?.brasDeDeport || brasDeDeport) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Section Bras de déport:</span>
                    <span className="text-white font-medium text-right">{firstEquipmentDetails?.brasDeDeport || brasDeDeport}</span>
                  </div>
                )}
                {(firstEquipmentDetails?.matSecondaire || matSecondaire) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Section Mat antenne 5G:</span>
                    <span className="text-white font-medium text-right">{firstEquipmentDetails?.matSecondaire || matSecondaire}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Equipment Results */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          Profil Structurel Recommandé
        </h3>
        
        {lookupResult.equipment.length > 0 ? (
          <div className="space-y-4">
            {lookupResult.equipment.map((eq: any, idx: number) => {
              const details = getTerrainDetails(eq, lookupResult.detected_terrain_type);
              
              return (
              <div key={idx} className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-emerald-500/30 rounded-xl overflow-hidden shadow-lg shadow-emerald-900/10 hover:border-emerald-500/50 transition-colors">
                <div className="p-5 border-b border-slate-800/80">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-lg font-bold text-white">{eq.name}</h4>
                      </div>
                      <p className="text-sm text-slate-400">Montage: {eq.sub_elements || selectedMontage}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                        Section Validée
                      </span>
                      {(eq.reference_4g || eq.reference_5g) && (
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-full border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                          Dimensions Réelles
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`bg-slate-950/50 rounded-lg p-4 border border-slate-800 ${(eq.reference_4g || eq.reference_5g) ? 'mb-3' : ''}`}>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Spécification Matériau</p>
                    <p className="text-emerald-300 font-medium whitespace-pre-line leading-relaxed">
                      {details.material}
                    </p>
                  </div>

                  {(eq.reference_4g || eq.reference_5g) && (
                    <div className="bg-indigo-950/30 rounded-lg p-4 border border-indigo-500/30">
                      <p className="text-xs text-indigo-400/80 uppercase tracking-wider mb-2">Références Équipement</p>
                      <div className="grid grid-cols-2 gap-4">
                        {eq.reference_4g && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Modèle 4G</p>
                            <p className="text-sm font-medium text-white">{eq.reference_4g}</p>
                          </div>
                        )}
                        {eq.reference_5g && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Modèle 5G</p>
                            <p className="text-sm font-medium text-white">{eq.reference_5g}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
            })}

            {/* Actions for valid equipment with PDF preview */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cataloguePdf ? (
                  <button
                    disabled
                    title="Bientôt disponible"
                    className="py-4 bg-slate-800 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-not-allowed opacity-70"
                  >
                    <Download className="w-5 h-5" />
                    Télécharger la Note de Calcul
                  </button>
                ) : (
                  <div className="py-4 bg-slate-800 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 border-dashed opacity-70">
                    <FileText className="w-5 h-5" />
                    PDF Catalogue Indisponible
                  </div>
                )}
                
                {ndcPdfUrl ? (
                  <button
                    onClick={() => setPreviewPdfUrl(ndcPdfUrl)}
                    className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-indigo-500 shadow-lg shadow-indigo-900/20 transition-all"
                  >
                    <FileText className="w-5 h-5" />
                    Aperçu Document
                  </button>
                ) : (
                  <button
                    disabled
                    title="Document non généré"
                    className="py-4 bg-slate-800 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-not-allowed opacity-70"
                  >
                    <FileText className="w-5 h-5" />
                    Aperçu Document (En attente)
                  </button>
                )}
              </div>
              
              <div className="mt-4">
                <button
                  onClick={handlePreviewTemplate}
                  disabled={isConverting}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Prévisualiser le Template NDC (Mode Debug)
                </button>
              </div>

              {/* Catalogue PDF Section */}
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
                      <a
                        href={cataloguePdf.url}
                        download={cataloguePdf.filename}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Télécharger</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
              
              {/* Modal PDF Preview using Portal to ensure it escapes any parent stacking contexts */}
              {previewPdfUrl && !conversionError && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                  <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-lg text-white font-bold tracking-wide">Aperçu du document</h3>
                          <p className="text-xs text-slate-400">Visionneuse PDF intégrée</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPreviewPdfUrl(null)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-400 transition-all"
                        title="Fermer l'aperçu"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex-1 w-full bg-slate-200">
                      <iframe
                        src={`${previewPdfUrl}#view=FitH`}
                        className="w-full h-full border-0"
                        title="Document Preview"
                      />
                    </div>
                  </div>
                </div>,
                document.body
              )}
              
              {conversionError && (
                <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                  <p className="text-sm text-rose-400">
                    Impossible de prévisualiser ce document. Veuillez le télécharger.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-700 border-dashed rounded-xl p-8 text-center flex flex-col items-center">
            <div className="p-4 bg-slate-800 rounded-full mb-4 relative">
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] font-bold flex items-center justify-center text-white">!</span>
              </span>
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Aucun matériel standard</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Les critères sélectionnés ou la configuration sur-mesure ne correspondent à aucune étude précalculée dans notre base de données.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mât principal</label>
                <input
                  type="text"
                  value={matPrincipal}
                  onChange={(e) => setMatPrincipal(e.target.value)}
                  placeholder="Ex: Mât standard..."
                  className="w-full py-2 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Plot métallique</label>
                <input
                  type="text"
                  value={plotMetallique}
                  onChange={(e) => setPlotMetallique(e.target.value)}
                  placeholder="Ex: Plot type B..."
                  className="w-full py-2 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bras de déport</label>
                <input
                  type="text"
                  value={brasDeDeport}
                  onChange={(e) => setBrasDeDeport(e.target.value)}
                  placeholder="Ex: Bras standard..."
                  className="w-full py-2 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mât secondaire</label>
                <input
                  type="text"
                  value={matSecondaire}
                  onChange={(e) => setMatSecondaire(e.target.value)}
                  placeholder="Ex: Mât auxiliaire..."
                  className="w-full py-2 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Nouveau bouton pour lancer le calcul via l'API APS */}
            <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-2xl mx-auto">
              <button
                onClick={onTriggerCalculation}
                disabled={isCalculationPending}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50"
              >
                {isCalculationPending ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calcul en cours...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    Lancer le calcul (APS)
                  </>
                )}
              </button>

              <button
                onClick={onDownloadPdf}
                disabled={pdfGenerating}
                className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 group"
              >
                {pdfGenerating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Génération...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    Fiche Synthèse
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-amber-500/70 mt-4 max-w-sm flex gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Génère le payload JSON strict pour exécution sur le serveur de calcul Windows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
