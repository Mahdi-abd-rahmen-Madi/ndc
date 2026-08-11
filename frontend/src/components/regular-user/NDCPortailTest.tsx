import { useState, useEffect } from 'react';
import axios from 'axios';
import MontageSelectionModal from '../MontageSelectionModal';

const VARIABLE_DESCRIPTIONS: Record<string, { label: string, category: string, unit: string }> = {
  var_1: { label: "Diamètre mât", category: "Géométrie Structure", unit: "mm" },
  var_2: { label: "Epaisseur mât", category: "Géométrie Structure", unit: "mm" },
  var_3: { label: "Hauteur mât", category: "Géométrie Structure", unit: "mm" },
  var_4: { label: "Réservé", category: "Système", unit: "" },
  var_5: { label: "Réservé", category: "Système", unit: "" },
  var_6: { label: "Diamètre tube 5G", category: "Géométrie Structure", unit: "mm" },
  var_7: { label: "Epaisseur tube 5G", category: "Géométrie Structure", unit: "mm" },
  var_8: { label: "Hauteur tube 5G", category: "Géométrie Structure", unit: "mm" },
  var_9: { label: "Longueur bras de déport", category: "Géométrie Structure", unit: "mm" },
  var_10: { label: "Réservé", category: "Système", unit: "" },
  var_11: { label: "Réservé", category: "Système", unit: "" },
  var_12: { label: "Région de vent", category: "Données Environnement", unit: "" },
  var_13: { label: "Type de terrain", category: "Données Environnement", unit: "" },
  var_14: { label: "Hauteur de référence (z_ref)", category: "Données Environnement", unit: "m" },
  var_15: { label: "Vitesse de base (V_b0)", category: "Données Environnement", unit: "m/s" },
  var_16: { label: "Facteur de terrain (kr)", category: "Calculs Aérodynamiques", unit: "" },
  var_17: { label: "Coefficient de rugosité (cr)", category: "Calculs Aérodynamiques", unit: "" },
  var_18: { label: "Coefficient de rugosité (cr)", category: "Calculs Aérodynamiques", unit: "" },
  var_19: { label: "Coefficient orographie (co)", category: "Calculs Aérodynamiques", unit: "" },
  var_20: { label: "Vitesse de base (V_b0)", category: "Calculs Aérodynamiques", unit: "m/s" },
  var_21: { label: "Vitesse moyenne (vm)", category: "Calculs Aérodynamiques", unit: "m/s" },
  var_22: { label: "Intensité turbulence (Iv)", category: "Calculs Aérodynamiques", unit: "" },
  var_23: { label: "Pression dynamique (qp)", category: "Calculs Aérodynamiques", unit: "daN/m²" },
  var_24: { label: "Diamètre mât", category: "Charges au Vent", unit: "m" },
  var_25: { label: "Pression (qp)", category: "Charges au Vent", unit: "daN/m²" },
  var_26: { label: "Force vent mât", category: "Charges au Vent", unit: "daN/ml" },
  var_27: { label: "Largeur 4G", category: "Charges au Vent - 4G", unit: "m" },
  var_28: { label: "Hauteur 4G", category: "Charges au Vent - 4G", unit: "m" },
  var_29: { label: "Pression 4G (qp)", category: "Charges au Vent - 4G", unit: "daN/m²" },
  var_30: { label: "Force frontale 4G", category: "Charges au Vent - 4G", unit: "daN" },
  var_31: { label: "Epaisseur 4G", category: "Charges au Vent - 4G", unit: "m" },
  var_32: { label: "Hauteur 4G (lat)", category: "Charges au Vent - 4G", unit: "m" },
  var_33: { label: "Pression 4G (qp)", category: "Charges au Vent - 4G", unit: "daN/m²" },
  var_34: { label: "Force latérale 4G", category: "Charges au Vent - 4G", unit: "daN" },
  var_35: { label: "Largeur 5G", category: "Charges au Vent - 5G", unit: "m" },
  var_36: { label: "Hauteur 5G", category: "Charges au Vent - 5G", unit: "m" },
  var_37: { label: "Pression 5G (qp)", category: "Charges au Vent - 5G", unit: "daN/m²" },
  var_38: { label: "Force frontale 5G", category: "Charges au Vent - 5G", unit: "daN" },
  var_39: { label: "Epaisseur 5G", category: "Charges au Vent - 5G", unit: "m" },
  var_40: { label: "Hauteur 5G (lat)", category: "Charges au Vent - 5G", unit: "m" },
  var_41: { label: "Pression 5G (qp)", category: "Charges au Vent - 5G", unit: "daN/m²" },
  var_42: { label: "Force latérale 5G", category: "Charges au Vent - 5G", unit: "daN" },
  var_43: { label: "Diamètre mât (Rappel)", category: "Récapitulatif Sections", unit: "mm" },
  var_44: { label: "Dimensions 4G (HxLxP)", category: "Récapitulatif Sections", unit: "mm" },
  var_45: { label: "Poids 4G", category: "Récapitulatif Sections", unit: "kg" },
  var_46: { label: "Hauteur base 4G", category: "Récapitulatif Sections", unit: "m" },
  var_47: { label: "Dimensions 5G (HxLxP)", category: "Récapitulatif Sections", unit: "mm" },
  var_48: { label: "Poids 5G", category: "Récapitulatif Sections", unit: "kg" },
  var_49: { label: "Hauteur base 5G", category: "Récapitulatif Sections", unit: "m" },
  var_50: { label: "Section Plot", category: "Profilés & Ancrage", unit: "" },
  var_51: { label: "Hauteur Plot", category: "Profilés & Ancrage", unit: "m" },
  var_52: { label: "Section Bras", category: "Profilés & Ancrage", unit: "" },
  var_53: { label: "Longueur Bras", category: "Profilés & Ancrage", unit: "m" },
  var_54: { label: "Section Mât Principal", category: "Profilés & Ancrage", unit: "mm" },
  var_55: { label: "Hauteur Mât Principal", category: "Profilés & Ancrage", unit: "m" },
  var_56: { label: "Section Mât 5G", category: "Profilés & Ancrage", unit: "" },
  var_57: { label: "Hauteur Mât 5G", category: "Profilés & Ancrage", unit: "m" },
};

interface Payload {
  schema_version: string;
  site: {
    ancrage: string;
  };
  environment: {
    region: number;
    terrain_type: string;
  };
  structure: {
    hauteur_mat_m: number;
    montage_id: string;
    is_custom_montage: boolean;
    mat_principal: string;
    plot_metallique: string;
    mat_secondaire: string;
    mast_section: string;
    material_name: string;
    plot_section: string;
    bras_section: string;
    mast_5g_section: string;
  };
  antenna_4g: {
    model: string;
    hauteur_mm: number;
    largeur_mm: number;
    epaisseur_mm: number;
    poids_kg: number;
  };
  antenna_5g: {
    model: string;
    hauteur_mm: number;
    largeur_mm: number;
    epaisseur_mm: number;
    poids_kg: number;
  };
}

const EUROCODE_STEEL = ["Steel", "S 235", "S 275", "S 355", "S 420", "S 460", "S 500", "S 550", "S 600", "S 620", "S 650", "S 690", "S 700"];
const EUROCODE_CONCRETE = ["Concrete", "C12/15", "C16/20", "C20/25", "C25/30", "C30/37", "C35/45", "C40/50", "C45/55", "C50/60"];
const FRENCH_STEEL = ["ACIER", "ACIER E24", "ACIER E28", "ACIER E30", "ACIER E36", "ACIER E42", "S 355 M", "S 420 M", "S 460 M", "INOX"];
const FRENCH_CONCRETE = ["BETON", "BETON20", "BETON25", "BETON30", "BETON35", "BETON40", "BETON45", "BETON50", "BETON55", "BETON60"];

const COMMON_SECTIONS = [
  "TCAR 22x2.3", "TCAR 25x2.5", "TCAR 28x2.5", "TCAR 28x2.6", "TCAR 28x4",
  "TCAR 30x2.5", "TCAR 35x2.5", "TCAR 35x2.7", "TCAR 35x3.2", "TCAR 35x4",
  "TCAR 40x2.5", "TCAR 40x2.7", "TCAR 40x3.2", "TCAR 40x4",
  "TCAR 45x2.5", "TCAR 45x2.7", "TCAR 45x3.2", "TCAR 45x4",
  "TCAR 50x2.5", "TCAR 50x3.2", "TCAR 50x4", "TCAR 50x5",
  "TCAR 55x2.5", "TCAR 55x3.2", "TCAR 55x5",
  "TCAR 60x2.5", "TCAR 60x3.2", "TCAR 60x4", "TCAR 60x5",
  "TCAR 70x3.2", "TCAR 70x4", "TCAR 70x5",
  "TCAR 80x3.2", "TCAR 80x3.6", "TCAR 80x4", "TCAR 80x5", "TCAR 80x6.3",
  "TCAR 90x3.2", "TCAR 90x4", "TCAR 90x5", "TCAR 90x6.3", "TCAR 90x7.1", "TCAR 90x8",
  "TCAR 100x10", "TCAR 100x3.2", "TCAR 100x4", "TCAR 100x5", "TCAR 100x6.3", "TCAR 100x7.1", "TCAR 100x8",
  "TCAR 120x3.2", "TCAR 120x4", "TCAR 120x5", "TCAR 120x6.3", "TCAR 120x7.1", "TCAR 120x8",
  "TCAR 135x3.2", "TCAR 135x4", "TCAR 135x5", "TCAR 135x7.1",
  "TCAR 140x3.6", "TCAR 140x4.5", "TCAR 140x6.3", "TCAR 140x7.1", "TCAR 140x8",
  "TCAR 150x10", "TCAR 150x12", "TCAR 150x4", "TCAR 150x5", "TCAR 150x6", "TCAR 150x8",
  "TCAR 180x10", "TCAR 180x12", "TCAR 180x3.6", "TCAR 180x6.3", "TCAR 180x8",
  "TCAR 200x10", "TCAR 200x12", "TCAR 200x5", "TCAR 200x6", "TCAR 200x8",
  "TCAR 250x10", "TCAR 250x12", "TCAR 250x6", "TCAR 250x8",
  "TCAR 300x10", "TCAR 300x12", "TCAR 300x6", "TCAR 300x8",
  "TCAR 350x10", "TCAR 350x12", "TCAR 350x8",
  "TRON 21x2.3", "TRON 26x2.3", "TRON 26x2.5", "TRON 26x3.2",
  "TRON 28x2.5", "TRON 30x2.5", "TRON 32x2.5",
  "TRON 33x2.6", "TRON 33x3.2", "TRON 33x4",
  "TRON 35x2.5", "TRON 38x2.5", "TRON 40x2.5",
  "TRON 42x2.6", "TRON 42x3.2", "TRON 42x4",
  "TRON 48x2.5", "TRON 48x2.9", "TRON 48x3.2", "TRON 48x4",
  "TRON 50x2.5", "TRON 51x2.5", "TRON 55x2.5", "TRON 57x2.5",
  "TRON 60x2.5", "TRON 60x2.9", "TRON 60x3.2", "TRON 60x4", "TRON 60x5",
  "TRON 61x2.5", "TRON 62x2.5", "TRON 70x2.5", "TRON 70x2.9",
  "TRON 76x2.5", "TRON 76x2.9", "TRON 76x3.6", "TRON 76x4", "TRON 76x5",
  "TRON 88x2.5", "TRON 88x3.2", "TRON 88x4", "TRON 88x5",
  "TRON 101x10", "TRON 101x3.6", "TRON 101x4", "TRON 101x5", "TRON 101x8",
  "TRON 114x10", "TRON 114x3.6", "TRON 114x5", "TRON 114x6.3", "TRON 114x8",
  "TRON 139x10", "TRON 139x12.5", "TRON 139x4", "TRON 139x5", "TRON 139x6.3", "TRON 139x8",
  "TRON 168x10", "TRON 168x12.5", "TRON 168x4.5", "TRON 168x6.3", "TRON 168x7.1", "TRON 168x8",
  "TRON 219x4.5", "TRON 219x5.6", "TRON 219x6.3",
  "TRON 273x5", "TRON 273x6.3",
  "TRON 323x5.6", "TRON 323x6.3", "TRON 323x7.1",
  "TRON 355x6.3", "TRON 355x8",
  "TRON 406x6.3", "TRON 406x8"
];

export default function NDCPortailTest() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'variables' | 'document'>('document');

  // Form states
  const [region, setRegion] = useState<number>(2);
  const [terrainType, setTerrainType] = useState<string>('0');
  const [mastHeight, setMastHeight] = useState<number>(4.0);
  const [mastSection, setMastSection] = useState<string>('TRON 139x6.3');
  const [materialName, setMaterialName] = useState<string>('ACIER E24');

  // Antenna weights
  const [weight4G, setWeight4G] = useState<number>(49.5);
  const [weight5G, setWeight5G] = useState<number>(22.0);

  // Section states
  const [plotSection, setPlotSection] = useState<string>('TCAR 200x5');
  const [brasSection, setBrasSection] = useState<string>('TCAR 50x5');
  const [mast5gSection, setMast5gSection] = useState<string>('TRON 76x5');

  // Modal and structure state
  const [showModal, setShowModal] = useState(false);
  const [siteType, setSiteType] = useState<'nouveau' | 'existant' | null>('nouveau');
  const [ancrage, setAncrage] = useState<'metallique' | 'beton' | 'encastre' | null>('metallique');
  const [casId, setCasId] = useState<string>('cas_1');

  const apiBaseUrl = import.meta.env.VITE_API_URL || '';

  const handleLaunchTest = async () => {
    setLoading(true);
    setStatus('Création du job...');
    setResultData(null);
    setPdfUrl(null);
    setJobId(null);


    const payload: Payload = {
      schema_version: "1.0",
      site: {
        ancrage: ancrage || "metallique"
      },
      environment: {
        region: region,
        terrain_type: terrainType
      },
      structure: {
        hauteur_mat_m: mastHeight,
        montage_id: casId,
        is_custom_montage: false,
        mat_principal: "Tube S235",
        plot_metallique: ancrage === 'metallique' ? "Standard" : "None",
        mat_secondaire: "None",
        mast_section: mastSection,
        material_name: materialName,
        plot_section: plotSection,
        bras_section: brasSection,
        mast_5g_section: mast5gSection
      },
      antenna_4g: {
        model: "Antenna_4G_Type_A",
        hauteur_mm: 2000.0,
        largeur_mm: 400.0,
        epaisseur_mm: 150.0,
        poids_kg: weight4G
      },
      antenna_5g: {
        model: "Antenna_5G_Type_B",
        hauteur_mm: 1500.0,
        largeur_mm: 300.0,
        epaisseur_mm: 120.0,
        poids_kg: weight5G
      }
    };

    try {
      const response = await axios.post(`${apiBaseUrl}/api/calculations/`, payload);
      const newJobId = response.data.data.id;
      setJobId(newJobId);
      setStatus(response.data.data.status);

      // Envoi de la requête au worker (push) puisqu'il ne poll plus
      try {
        const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://127.0.0.1:8001';
        await axios.post(`${workerUrl}/api/jobs`, {
          id: newJobId,
          input_data: payload
        });
        console.log("Requête envoyée au worker avec succès.");
      } catch (workerError) {
        console.error("Erreur lors de l'envoi au worker:", workerError);
      }

    } catch (error) {
      console.error(error);
      setStatus('Erreur lors de la création du job.');
      setLoading(false);
    }
  };

  const [workerStatus, setWorkerStatus] = useState<'IDLE' | 'BUSY' | 'OFFLINE'>('OFFLINE');
  const [workerLogs, setWorkerLogs] = useState<{time: string, message: string}[]>([]);

  // Poll for job status and worker control
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchWorkerControl = async () => {
      try {
        const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://127.0.0.1:8001';
        const statusResponse = await axios.get(`${workerUrl}/api/status`);
        setWorkerStatus(statusResponse.data.status);
      } catch (error) {
        setWorkerStatus('OFFLINE');
      }

      try {
        const response = await axios.get(`${apiBaseUrl}/api/worker/control/`);
        setWorkerLogs(response.data.logs);
      } catch (error) {
        // ignore
      }
    };

    interval = setInterval(() => {
      fetchWorkerControl();
      
      // Also poll job status if pending
      if (jobId && (status === 'PENDING' || status === 'Création du job...')) {
        axios.get(`${apiBaseUrl}/api/calculations/${jobId}/`)
          .then(response => {
            const currentStatus = response.data.status;
            setStatus(currentStatus);
            if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED') {
              setLoading(false);
              setResultData(response.data.result_data);
              setScreenshotUrl(response.data.screenshot || null);
            }
          })
          .catch(error => {
            console.error(error);
            setStatus('Erreur de polling.');
            setLoading(false);
          });
      }
    }, 2000);
    
    // Initial fetch
    fetchWorkerControl();

    return () => clearInterval(interval);
  }, [jobId, status, apiBaseUrl]);

  const handleGeneratePdf = async () => {
    if (!jobId) return;
    try {
      const response = await axios.post(`${apiBaseUrl}/api/calculations/${jobId}/generate_pdf/`, {
        photo_url: 'dummy' // using dummy or empty to bypass
      });
      const url = response.data.ndc_pdf_url;
      setPdfUrl(`${apiBaseUrl}${url}`);
    } catch (error) {
      console.error(error);
      alert('Erreur lors de la génération du PDF');
    }
  };


  const renderVariablesPreview = () => {
    const vars = resultData?.note_de_calcul_vars;
    if (!vars) return null;
    
    const grouped: Record<string, any[]> = {};
    Object.keys(vars).forEach(key => {
      const info = VARIABLE_DESCRIPTIONS[key] || { label: key, category: 'Autres', unit: '' };
      if (!grouped[info.category]) grouped[info.category] = [];
      grouped[info.category].push({ key, value: vars[key], ...info });
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <div className="bg-slate-50 border-b border-gray-200 p-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Aperçu du Mapping PDF (Génie Civil)
          </h3>
          <p className="text-sm text-slate-500 mt-1">Vérification des variables qui seront injectées dans le rapport officiel.</p>
        </div>
        
        <div className="max-h-[500px] overflow-y-auto p-4 space-y-6 bg-slate-50/50">
          {Object.keys(grouped).map(category => (
            <div key={category}>
              <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-3 border-b border-indigo-100 pb-1">{category}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {grouped[category].map(item => (
                  <div key={item.key} className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col hover:border-indigo-300 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-semibold text-slate-400">{item.key}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">{item.unit || '-'}</span>
                    </div>
                    <span className="text-sm text-slate-800 font-medium leading-tight mb-2 flex-grow">{item.label}</span>
                    <div className="text-sm font-bold text-indigo-700 font-mono bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100 inline-block self-start break-all">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {screenshotUrl && (
          <div className="border-t border-gray-200 p-4 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Capture 3D Robot
            </h3>
            <div className="rounded-lg overflow-hidden border border-gray-300 shadow-sm bg-white p-2">
              <img src={screenshotUrl} alt="Capture 3D Robot" className="w-full h-auto object-contain rounded" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDocumentPreview = () => {
    const vars = resultData?.note_de_calcul_vars;
    if (!vars) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <div className="bg-slate-50 border-b border-gray-200 p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Aperçu de la Note de Calcul
            </h3>
            <p className="text-sm text-slate-500 mt-1">Prévisualisation du document final basé sur les variables calculées.</p>
          </div>
          <button 
            onClick={handleGeneratePdf}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Générer le PDF Officiel
          </button>
        </div>

        {pdfUrl ? (
          <div className="w-full h-[600px] bg-slate-100 p-4 flex flex-col gap-2">
            <div className="text-right">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">Ouvrir dans un nouvel onglet</a>
            </div>
            <iframe src={pdfUrl} className="w-full h-full rounded border border-gray-300 shadow-inner bg-white" title="PDF Preview" />
          </div>
        ) : (
          <div className="p-8 bg-slate-100 flex justify-center max-h-[600px] overflow-y-auto">
            <div className="bg-white w-full max-w-2xl shadow-lg border border-gray-200 p-10 relative">
              {/* Header */}
              <div className="border-b-2 border-indigo-900 pb-4 mb-6 text-center">
                <h1 className="text-2xl font-black text-indigo-900 uppercase tracking-widest mb-1">Note de Calcul</h1>
                <h2 className="text-sm font-bold text-gray-500 uppercase">Vérification Structurelle de Support d'Antennes</h2>
              </div>
              
              {/* Site Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100 pb-1">Informations du Site</h4>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Nom du Site:</span> Tour de Test Alpha</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Client:</span> Client Test</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Adresse:</span> Site Test Portail, Paris</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Type:</span> {siteType === 'nouveau' ? 'Neuf' : 'Existant'}</div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100 pb-1">Caractéristiques</h4>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Montage:</span> {casId.toUpperCase()}</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Ancrage:</span> {ancrage === 'metallique' ? 'Plot Métallique' : ancrage === 'beton' ? 'Plot Béton' : 'Encastré'}</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Matériau:</span> {materialName}</div>
                  <div className="text-xs text-gray-700"><span className="font-semibold w-24 inline-block">Date:</span> {new Date().toLocaleDateString('fr-FR')}</div>
                </div>
              </div>

              {/* Environment & Hypotheses */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100 pb-1 mb-3">1. Hypothèses Environnementales</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-gray-500 block">Région de Vent</span>
                    <span className="text-sm font-semibold text-gray-800">{vars.var_12 || region}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-gray-500 block">Catégorie de Terrain</span>
                    <span className="text-sm font-semibold text-gray-800">{vars.var_13 || terrainType}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-gray-500 block">Vitesse de base (V_b0)</span>
                    <span className="text-sm font-semibold text-gray-800">{vars.var_15 || '24.0'} m/s</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-[10px] text-gray-500 block">Pression dynamique (qp)</span>
                    <span className="text-sm font-semibold text-gray-800">{vars.var_23 || '-'} daN/m²</span>
                  </div>
                </div>
              </div>

              {/* Structure Geometrie */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100 pb-1 mb-3">2. Géométrie de la Structure</h4>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-50/50">
                      <th className="border border-indigo-100 p-1.5 font-semibold text-indigo-900">Élément</th>
                      <th className="border border-indigo-100 p-1.5 font-semibold text-indigo-900">Dimension (mm)</th>
                      <th className="border border-indigo-100 p-1.5 font-semibold text-indigo-900">Épaisseur (mm)</th>
                      <th className="border border-indigo-100 p-1.5 font-semibold text-indigo-900">Hauteur (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-indigo-100 p-1.5 text-gray-700">Mât Principal</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_1 || (mastSection.match(/(\d+)\s*[xX]\s*(\d+)/)?.[1] || '139')}</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_2 || (mastSection.match(/(\d+)\s*[xX]\s*(\d+)/)?.[2] || '4')}</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_3 || (mastHeight*1000).toFixed(0)}</td>
                    </tr>
                    {vars.var_6 && vars.var_6 !== '0.0' && (
                    <tr>
                      <td className="border border-indigo-100 p-1.5 text-gray-700">Tube 5G</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_6}</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_7}</td>
                      <td className="border border-indigo-100 p-1.5 text-gray-800 font-medium">{vars.var_8}</td>
                    </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Resultats et Verdict */}
              <div className="mb-8">
                <h4 className="text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100 pb-1 mb-3">3. Résultats des Calculs</h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white border-l-2 border-blue-500 shadow-sm p-2 rounded-r">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Effort Tranchant</div>
                    <div className="text-sm font-bold text-gray-800">{resultData.reaction_forces_dan?.fx?.toFixed(2) || '-'} <span className="text-[10px] text-gray-500 font-normal">daN</span></div>
                  </div>
                  <div className="bg-white border-l-2 border-green-500 shadow-sm p-2 rounded-r">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Moment Féchissant</div>
                    <div className="text-sm font-bold text-gray-800">{resultData.reaction_forces_dan?.my?.toFixed(2) || '-'} <span className="text-[10px] text-gray-500 font-normal">daN.m</span></div>
                  </div>
                  <div className="bg-white border-l-2 border-purple-500 shadow-sm p-2 rounded-r">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Déplacement Max</div>
                    <div className="text-sm font-bold text-gray-800">{resultData.max_deflection_mm?.toFixed(2) || '-'} <span className="text-[10px] text-gray-500 font-normal">mm</span></div>
                  </div>
                </div>

                <div className={`p-3 rounded border ${resultData.verdict === 'PASSED' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5">
                    {resultData.verdict === 'PASSED' ? (
                      <><span className="text-green-600">✓</span> <span className="text-green-800">Conclusion Favorable</span></>
                    ) : (
                      <><span className="text-red-600">✗</span> <span className="text-red-800">Conclusion Défavorable</span></>
                    )}
                  </h4>
                  <p className={`text-[11px] ${resultData.verdict === 'PASSED' ? 'text-green-700' : 'text-red-700'}`}>
                    Les vérifications de résistance des éléments structurels et de déformation ont été effectuées conformément aux Eurocodes en vigueur. {resultData.verdict === 'PASSED' ? "La structure est apte à supporter les charges." : "La structure présente des non-conformités."}
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between text-[9px] text-gray-400">
                <span>Document généré automatiquement par NDC Portail</span>
                <span>Page 1/1 (Aperçu)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="border-b border-gray-100 pb-4 mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Portail de Test Robot SDK</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${workerStatus === 'IDLE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : workerStatus === 'BUSY' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
                <span className="text-sm font-medium text-gray-600">
                  {workerStatus === 'IDLE' ? 'Worker en ligne (En attente)' : workerStatus === 'BUSY' ? 'Worker en ligne (Calcul en cours...)' : 'Worker hors ligne'}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Environnement de Validation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Région de Vent</label>
              <select 
                value={region} 
                onChange={e => setRegion(Number(e.target.value))}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                <option value={1}>Région 1 (V_B0 = 22 m/s)</option>
                <option value={2}>Région 2 (V_B0 = 24 m/s)</option>
                <option value={3}>Région 3 (V_B0 = 26 m/s)</option>
                <option value={4}>Région 4 (V_B0 = 28 m/s)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de Terrain (Eurocode)</label>
              <select 
                value={terrainType} 
                onChange={e => setTerrainType(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                <option value="0">Catégorie 0 (Mer/Côtier - Mult: 1.4)</option>
                <option value="I">Catégorie I (Lac/Plat - Mult: 1.3)</option>
                <option value="II">Catégorie II (Campagne - Mult: 1.15)</option>
                <option value="III">Catégorie III (Bocage/Sub - Mult: 1.0)</option>
                <option value="IV">Catégorie IV (Ville/Forêt - Mult: 0.8)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hauteur du Mât (m)</label>
              <input 
                type="number" 
                step="0.5"
                value={mastHeight}
                onChange={e => setMastHeight(Number(e.target.value))}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Mât Principal</label>
              <select 
                value={mastSection}
                onChange={e => setMastSection(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                {COMMON_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Matériau (Robot DB)</label>
              <select 
                value={materialName}
                onChange={e => setMaterialName(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                <optgroup label="Acier (Eurocode)">
                  {EUROCODE_STEEL.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Béton (Eurocode)">
                  {EUROCODE_CONCRETE.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Acier (France)">
                  {FRENCH_STEEL.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
                <optgroup label="Béton (France)">
                  {FRENCH_CONCRETE.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              </select>
            </div>
          </div>



          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Plot</label>
              <select 
                value={plotSection}
                onChange={e => setPlotSection(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                {COMMON_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Bras</label>
              <select 
                value={brasSection}
                onChange={e => setBrasSection(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                {COMMON_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Mât 5G</label>
              <select 
                value={mast5gSection}
                onChange={e => setMast5gSection(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              >
                {COMMON_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <h3 className="text-md font-medium text-gray-800 mb-4 border-b pb-2">Poids des Équipements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Poids Antenne 4G (kg)</label>
              <input 
                type="number" 
                step="0.1"
                value={weight4G}
                onChange={e => setWeight4G(Number(e.target.value))}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Poids Antenne 5G (kg)</label>
              <input 
                type="number" 
                step="0.1"
                value={weight5G}
                onChange={e => setWeight5G(Number(e.target.value))}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-blue-900 mb-1">Configuration Structurelle Active</h3>
              <p className="text-sm text-blue-700">
                Site: <span className="font-semibold">{siteType === 'nouveau' ? 'Neuf' : 'Existant'}</span> | 
                Ancrage: <span className="font-semibold">{ancrage === 'metallique' ? 'Plot Métallique' : ancrage === 'beton' ? 'Plot Béton' : 'Encastré'}</span> | 
                Cas: <span className="font-semibold">{casId.toUpperCase()}</span>
              </p>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold shadow-sm"
            >
              Modifier
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleLaunchTest} 
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-semibold text-white shadow-md transition-all
                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark active:scale-95'}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Simulation en cours...
                </span>
              ) : 'Lancer le Calcul Robot'}
            </button>

            {status && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Statut:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                  ${status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                    status === 'FAILED' ? 'bg-red-100 text-red-700' : 
                    'bg-yellow-100 text-yellow-700 animate-pulse'}`}>
                  {status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Worker Terminal View */}
        <div className="bg-gray-900 rounded-xl shadow-lg p-4 mb-8 border border-gray-800">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
            <h3 className="text-gray-300 font-mono text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Console Worker Robot SDK
            </h3>
            <span className="text-xs text-gray-500">Live Stream</span>
          </div>
          <div className="h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-1 p-2 flex flex-col-reverse">
            {[...workerLogs].reverse().map((log, i) => (
              <div key={i} className="flex gap-3 hover:bg-gray-800 rounded px-1">
                <span className="text-gray-500 shrink-0">[{log.time}]</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
            {workerLogs.length === 0 && (
              <div className="text-gray-500 italic">En attente de connexion du worker...</div>
            )}
          </div>
        </div>

        {/* Results Modal (Nouvelle Fenêtre) */}
        {resultData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-center z-10">
                <h2 className="text-2xl font-bold text-gray-800">Résultats Robot Structural Analysis</h2>
                <button 
                  onClick={() => { setResultData(null); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Metrics */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                      Valeurs Calculées
                    </h3>
                    <dl className="space-y-4">
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <dt className="text-gray-600">Force de Vent Appliquée (FX)</dt>
                        <dd className="font-semibold text-gray-900">{resultData.wind_force_applied_dan?.toFixed(2)} daN</dd>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <dt className="text-gray-600">Déplacement Max (UX)</dt>
                        <dd className="font-semibold text-gray-900">{resultData.max_deflection_mm?.toFixed(2)} mm</dd>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <dt className="text-gray-600">Réaction Base (FX)</dt>
                        <dd className="font-semibold text-gray-900">{resultData.reaction_forces_dan?.fx?.toFixed(2)} daN</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Moment Renversement (MY)</dt>
                        <dd className="font-semibold text-gray-900">{resultData.reaction_forces_dan?.my?.toFixed(2)} daN.m</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Verdicts */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Avis de Faisabilité & Export
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <span className="text-gray-700 font-medium">Verdict Global</span>
                        <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${resultData.verdict === 'PASSED' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                          {resultData.verdict === 'PASSED' ? 'Favorable' : 'Défavorable'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <span className="text-gray-700 font-medium">Variables NDC (Export)</span>
                        <span className="px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide bg-blue-100 text-blue-800 border-blue-200">
                          {resultData.note_de_calcul_vars ? Object.keys(resultData.note_de_calcul_vars).length + ' prêtes' : '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-2 flex gap-6 border-b border-gray-200">
                  <button 
                    onClick={() => setActiveTab('document')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'document' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    Aperçu Document
                  </button>
                  <button 
                    onClick={() => setActiveTab('variables')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'variables' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    Variables Mappées (Brut)
                  </button>
                </div>

                {activeTab === 'document' ? renderDocumentPreview() : renderVariablesPreview()}
              </div>
            </div>
          </div>
        )}

        <MontageSelectionModal 
          show={showModal} 
          onClose={() => setShowModal(false)}
          selectedSiteType={siteType}
          selectedFoundationType={ancrage}
          onSiteTypeSelect={setSiteType}
          onFoundationTypeSelect={setAncrage}
          onCasSelect={(cas) => setCasId(cas.toLowerCase())}
        />
      </div>
    </div>
  );
}
