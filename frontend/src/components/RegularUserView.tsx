import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Download, Compass, Layers, CheckCircle2, Shield, Sparkles, AlertCircle, Bell, Send, Map as MapIcon } from 'lucide-react';
import { useGeocoding } from '../hooks/useGeocoding';
import TerrainMap from './TerrainMap';
import type { GeocodingAddress } from '../utils/types';
import maplibregl from 'maplibre-gl';
import jsPDF from 'jspdf';


interface RegularUserViewProps {
  apiBaseUrl: string;
  initialMontage?: string | null;
  initialSiteType?: 'nouveau' | 'existant' | null;
  initialFoundationType?: 'metallique' | 'beton' | 'encastre' | null;
}

const MONTAGES = [
  {
    id: 'A1',
    name: 'Montage A1',
    dimensions: '4G: 2100x470x210 | 5G: 1010x500x250',
    weight: '4G: 45daN | 5G: 50daN',
    abbreviation: 'A1a / A1b'
  },
  {
    id: 'A2',
    name: 'Montage A2',
    dimensions: '4G: 2800x500x250 | 5G: 1010x500x240',
    weight: '4G: 60daN | 5G: 50daN',
    abbreviation: 'A2a / A2b'
  },
  {
    id: 'A3',
    name: 'Montage A3',
    dimensions: '4G: 2100x500x250 | 5G: 1000x500x240',
    weight: '4G: 50daN | 5G: 50daN',
    abbreviation: 'A3a / A3b'
  },
  {
    id: 'A4',
    name: 'Montage A4',
    dimensions: '4G: 1509x469x206 | 5G: 730x395x180',
    weight: '4G: 34daN | 5G: 28daN',
    abbreviation: 'A4a / A4b'
  },
  {
    id: 'A5',
    name: 'Montage A5',
    dimensions: '4G: 2800x540x240 | 5G: 1000x500x240',
    weight: '4G: 110daN | 5G: 50daN',
    abbreviation: 'A5a / A5b'
  },
  {
    id: 'A6',
    name: 'Montage A6',
    dimensions: '4G: 2688x369x166 | 5G: 750x450x240',
    weight: '4G: 33.5daN | 5G: 45daN',
    abbreviation: 'A6a / A6b'
  },
  {
    id: 'A7',
    name: 'Montage A7',
    dimensions: '4G: 2249x469x206 | 5G: 730x395x180',
    weight: '4G: 45daN | 5G: 28.5daN',
    abbreviation: 'A7a / A7b'
  },
  {
    id: 'A8',
    name: 'Montage A8',
    dimensions: '4G: 2769x469x206 | 5G: 750x430x240',
    weight: '4G: 51daN | 5G: 45daN',
    abbreviation: 'A8a / A8b'
  }
];

const MONTAGES_SPECS = [
  {
    id: 'A1',
    name: 'Antenne A1',
    ant4g: { height: 2100, width: 470, thickness: 210, weight: 45 },
    ant5g: { height: 1010, width: 500, thickness: 250, weight: 50 }
  },
  {
    id: 'A2',
    name: 'Antenne A2',
    ant4g: { height: 2800, width: 500, thickness: 250, weight: 60 },
    ant5g: { height: 1010, width: 500, thickness: 240, weight: 50 }
  },
  {
    id: 'A3',
    name: 'Antenne A3',
    ant4g: { height: 2100, width: 500, thickness: 250, weight: 50 },
    ant5g: { height: 1000, width: 500, thickness: 240, weight: 50 }
  },
  {
    id: 'A4',
    name: 'Antenne A4',
    ant4g: { height: 1509, width: 469, thickness: 206, weight: 34 },
    ant5g: { height: 730, width: 395, thickness: 180, weight: 28 }
  },
  {
    id: 'A5',
    name: 'Antenne A5',
    ant4g: { height: 2800, width: 540, thickness: 240, weight: 110 },
    ant5g: { height: 1000, width: 500, thickness: 240, weight: 50 }
  },
  {
    id: 'A6',
    name: 'Antenne A6',
    ant4g: { height: 2688, width: 369, thickness: 166, weight: 33.5 },
    ant5g: { height: 750, width: 450, thickness: 240, weight: 45 }
  },
  {
    id: 'A7',
    name: 'Antenne A7',
    ant4g: { height: 2249, width: 469, thickness: 206, weight: 45 },
    ant5g: { height: 730, width: 395, thickness: 180, weight: 28.5 }
  },
  {
    id: 'A8',
    name: 'Antenne A8',
    ant4g: { height: 2769, width: 469, thickness: 206, weight: 51 },
    ant5g: { height: 750, width: 430, thickness: 240, weight: 45 }
  }
];

export default function RegularUserView({
  apiBaseUrl,
  initialMontage,
  initialSiteType,
  initialFoundationType
}: RegularUserViewProps) {
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedHeight, setSelectedHeight] = useState<number>(3); // Default to 3m
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number>(15); // Default to 15m
  const [selectedMontage, setSelectedMontage] = useState<string>(initialMontage || ''); // Default to unselected or initialMontage
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFhEquipment, setHasFhEquipment] = useState<boolean>(false);
  const [fhWeight, setFhWeight] = useState<number>(30); // Default to 30kg
  const [showMap, setShowMap] = useState<boolean>(false); // Hidden map, toggled via Ctrl+M
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Sync initialMontage from parent
  useEffect(() => {
    if (initialMontage && initialMontage !== 'custom') {
      setSelectedMontage(initialMontage);
      const spec = MONTAGES_SPECS.find(m => m.id === initialMontage);
      if (spec) {
        setAnt4gModel(initialMontage);
        setAnt4gHeight(spec.ant4g.height);
        setAnt4gWidth(spec.ant4g.width);
        setAnt4gThickness(spec.ant4g.thickness);
        setAnt4gWeight(spec.ant4g.weight);

        setAnt5gModel(initialMontage);
        setAnt5gHeight(spec.ant5g.height);
        setAnt5gWidth(spec.ant5g.width);
        setAnt5gThickness(spec.ant5g.thickness);
        setAnt5gWeight(spec.ant5g.weight);
      }
    }
  }, [initialMontage]);

  // 4G Antenna Specifications
  const [ant4gModel, setAnt4gModel] = useState<string>('A1');
  const [ant4gHeight, setAnt4gHeight] = useState<number>(2100);
  const [ant4gWidth, setAnt4gWidth] = useState<number>(470);
  const [ant4gThickness, setAnt4gThickness] = useState<number>(210);
  const [ant4gWeight, setAnt4gWeight] = useState<number>(45);

  // 5G Antenna Specifications
  const [ant5gModel, setAnt5gModel] = useState<string>('A1');
  const [ant5gHeight, setAnt5gHeight] = useState<number>(1010);
  const [ant5gWidth, setAnt5gWidth] = useState<number>(500);
  const [ant5gThickness, setAnt5gThickness] = useState<number>(250);
  const [ant5gWeight, setAnt5gWeight] = useState<number>(50);

  // Catalogue Results State
  const [lookupResult, setLookupResult] = useState<{
    detected_terrain_type: string | null;
    detected_region: number | null;
    equipment: any[];
  } | null>(null);

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingAddress[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { search, loading: searchLoading } = useGeocoding();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // Height Request & Notifications State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState({ name: '', email: '', phone: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string, filename: string, isConverting?: boolean, conversionFailed?: boolean, originalUrl?: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Connection for Notifications
  useEffect(() => {
    // We only connect if we have an email (e.g. from a submitted request)
    const storedEmail = localStorage.getItem('ndc_user_email');
    if (!storedEmail) return;

    const connectWs = () => {
      // Use wss:// or ws:// depending on protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev, assuming the backend runs on localhost:8000 if not using vite proxy directly
      // Use the apiBaseUrl and strip http(s)
      const wsBase = apiBaseUrl ? apiBaseUrl.replace(/^http(s)?:\/\//, protocol + '//') : `${protocol}//${window.location.host}`;
      const wsUrl = `${wsBase}/ws/notifications/${encodeURIComponent(storedEmail)}/`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            setNotifications(prev => [data.notification, ...prev]);
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 5s...');
        setTimeout(connectWs, 5000);
      };

      wsRef.current = ws;
    };

    connectWs();

    // Fetch initial notifications
    fetch(`${apiBaseUrl}/api/geodata/notifications/?email=${encodeURIComponent(storedEmail)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch(console.error);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [apiBaseUrl, requestSuccess]); // Re-run when requestSuccess changes to connect after first submit

  const handleMarkAsRead = async (notifId: number) => {
    try {
      await fetch(`${apiBaseUrl}/api/geodata/notifications/${notifId}/mark_read/`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRequest(true);
    try {
      // Save email to local storage for future visits
      localStorage.setItem('ndc_user_email', requestFormData.email);

      let fullDescription = requestFormData.description;
      const configDetails = [];
      if (initialSiteType) {
        configDetails.push(`Type de site : ${initialSiteType === 'nouveau' ? 'Nouveau' : 'Existant'}`);
      }
      if (initialFoundationType) {
        configDetails.push(`Type d'ancrage : ${initialFoundationType === 'metallique' ? 'Plot métallique' : initialFoundationType === 'beton' ? 'Plot Béton' : 'Encastré'}`);
      }
      if (hasFhEquipment) {
        configDetails.push(`Équipement FH sélectionné : Oui, Poids: ${fhWeight} kg`);
      }
      if (configDetails.length > 0) {
        fullDescription += `\n\n[Configuration de conception] :\n- ${configDetails.join('\n- ')}`;
      }

      const payload = {
        requester_name: requestFormData.name,
        requester_email: requestFormData.email,
        requester_phone: requestFormData.phone,
        description: fullDescription,
        requested_building_height: selectedBuildingHeight,
        mast_height: selectedHeight,
        montage_type: selectedMontage,
        terrain_type: lookupResult?.detected_terrain_type || '',
        region: lookupResult?.detected_region || null,
        latitude: selectedCoords?.latitude,
        longitude: selectedCoords?.longitude,
        address: selectedAddress?.name || ''
      };

      const response = await fetch(`${apiBaseUrl}/api/geodata/height-requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to submit request');

      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestForm(false);
        setRequestSuccess(false);
      }, 3000);
    } catch (err) {
      console.error(err);
      alert('Une erreur est survenue lors de la soumission de la demande.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Close search suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+M keyboard shortcut to toggle the full interactive map
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setShowMap(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mini-map initialization & update for inline location preview
  useEffect(() => {
    if (!miniMapContainerRef.current || !selectedCoords || showMap) {
      // Cleanup if conditions not met
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
      return;
    }

    if (!miniMapRef.current) {
      const miniMap = new maplibregl.Map({
        container: miniMapContainerRef.current,
        attributionControl: false,
        preserveDrawingBuffer: true,
        interactive: false,
        style: {
          version: 8,
          sources: {
            'google-satellite': {
              type: 'raster',
              tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
              tileSize: 256,
            },
          },
          layers: [
            {
              id: 'google-satellite',
              type: 'raster',
              source: 'google-satellite',
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        center: [selectedCoords.longitude, selectedCoords.latitude],
        zoom: 15,
      });

      miniMap.on('load', () => {
        // Add a marker dot at center
        const el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;background:radial-gradient(circle,#f43f5e 40%,transparent 70%);border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(244,63,94,0.6);';
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([selectedCoords.longitude, selectedCoords.latitude])
          .addTo(miniMap);
      });

      miniMapRef.current = miniMap;
    } else {
      miniMapRef.current.setCenter([selectedCoords.longitude, selectedCoords.latitude]);
    }

    return () => {
      // Don't destroy on every coords change — only when unmounting or conditions change
    };
  }, [selectedCoords, showMap]);

  // Cleanup mini-map on full unmount
  useEffect(() => {
    return () => {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, []);

  // Precalculated building heights range
  const precalculatedHeights = [10, 15, 20, 25, 30, 35, 40, 45];

  const getClosestPrecalculatedHeight = (height: number): number => {
    const val = Number(height);
    if (isNaN(val) || val <= 0) return 15; // default fallback
    return precalculatedHeights.reduce((prev, curr) =>
      Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
    );
  };

  const recommendedBuildingHeight = getClosestPrecalculatedHeight(selectedBuildingHeight);
  const isPrecalculatedBuildingHeight = precalculatedHeights.includes(selectedBuildingHeight);

  // Antenna specs matching
  const current4g = { height: ant4gHeight, width: ant4gWidth, thickness: ant4gThickness, weight: ant4gWeight };
  const current5g = { height: ant5gHeight, width: ant5gWidth, thickness: ant5gThickness, weight: ant5gWeight };

  const matchingMontage = MONTAGES_SPECS.find(m =>
    m.ant4g.height === current4g.height &&
    m.ant4g.width === current4g.width &&
    m.ant4g.thickness === current4g.thickness &&
    m.ant4g.weight === current4g.weight &&
    m.ant5g.height === current5g.height &&
    m.ant5g.width === current5g.width &&
    m.ant5g.thickness === current5g.thickness &&
    m.ant5g.weight === current5g.weight
  );

  const matching4gMontage = MONTAGES_SPECS.find(m =>
    m.ant4g.height === current4g.height &&
    m.ant4g.width === current4g.width &&
    m.ant4g.thickness === current4g.thickness &&
    m.ant4g.weight === current4g.weight
  );

  const hitPredefinedMontage = !!matchingMontage;
  const queryMontage = matchingMontage ? matchingMontage.id : (matching4gMontage ? matching4gMontage.id : '');

  // Fetch catalogue data from backend
  const fetchCatalogueData = useCallback(async (lat: number, lng: number, height: number, buildingHeight: number, montage: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${apiBaseUrl}/api/geodata/antenna-equipment/public_lookup/?latitude=${lat}&longitude=${lng}&mast_height=${height}&building_height=${buildingHeight}`;
      if (montage) {
        url += `&montage=${montage}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to retrieve catalogue data: status ${response.status}`);
      }
      const data = await response.json();
      setLookupResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred while matching catalog data.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Convert DOCX to PDF for preview
  useEffect(() => {
    if (previewDoc && !previewDoc.conversionFailed && !previewDoc.url.toLowerCase().endsWith('.pdf') && (previewDoc.filename.toLowerCase().endsWith('.docx') || previewDoc.filename.toLowerCase().endsWith('.doc'))) {
      // Guard to prevent multiple simultaneous requests for the same URL
      if (previewDoc.originalUrl === previewDoc.url) {
        return;
      }

      let isMounted = true;
      setPreviewDoc(prev => prev ? { ...prev, isConverting: true, originalUrl: prev.url } : null);

      fetch(`${apiBaseUrl}/api/geodata/preview-document/?url=${encodeURIComponent(previewDoc.url)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (isMounted && data.preview_url) {
            setPreviewDoc(prev => prev ? { ...prev, url: data.preview_url, isConverting: false, conversionFailed: false } : null);
          } else if (isMounted) {
            setPreviewDoc(prev => prev ? { ...prev, isConverting: false, conversionFailed: true } : null);
          }
        })
        .catch(() => {
          if (isMounted) setPreviewDoc(prev => prev ? { ...prev, isConverting: false, conversionFailed: true } : null);
        });

      return () => { isMounted = false; };
    }
  }, [previewDoc?.url, previewDoc?.filename, apiBaseUrl]);

  // Handle PDF summary generation and download
  const handleDownloadPdf = async () => {
    if (!lookupResult) return;
    setPdfGenerating(true);
    try {
      // 1. Capture a high-resolution satellite map screenshot in the background
      let mapImgData: string | null = null;
      if (selectedCoords) {
        mapImgData = await new Promise<string | null>((resolve) => {
          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '-9999px';
          container.style.top = '0';
          container.style.width = '800px';
          container.style.height = '420px';
          document.body.appendChild(container);

          try {
            const map = new maplibregl.Map({
              container: container,
              attributionControl: false,
              preserveDrawingBuffer: true,
              interactive: false,
              style: {
                version: 8,
                sources: {
                  'google-satellite': {
                    type: 'raster',
                    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                    tileSize: 256,
                  },
                },
                layers: [
                  {
                    id: 'google-satellite',
                    type: 'raster',
                    source: 'google-satellite',
                    minzoom: 0,
                    maxzoom: 22,
                  },
                ],
              },
              center: [selectedCoords.longitude, selectedCoords.latitude],
              zoom: 18,
            });

            map.once('load', () => {
              // Add a highly visible red pin marker pointing exactly at the coordinate
              const el = document.createElement('div');
              el.style.cssText = 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));';
              el.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              `;
              new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([selectedCoords.longitude, selectedCoords.latitude])
                .addTo(map);
            });

            map.once('idle', () => {
              const canvas = container.querySelector('canvas');
              const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
              map.remove();
              document.body.removeChild(container);
              resolve(dataUrl);
            });

            // Timeout fallback
            setTimeout(() => {
              const canvas = container.querySelector('canvas');
              const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
              try { map.remove(); } catch(e){}
              try { document.body.removeChild(container); } catch(e){}
              resolve(dataUrl);
            }, 3500);

          } catch (e) {
            console.error('Failed to render high-res map screenshot:', e);
            try { document.body.removeChild(container); } catch(_){}
            resolve(null);
          }
        });
      }

      // 2. Generate A4 PDF using jsPDF (Single Page Layout)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor = [15, 23, 42]; // Slate-900
      const accentColor = [79, 70, 229]; // Indigo-600
      const successColor = [16, 185, 129]; // Emerald-500
      const textColor = [51, 65, 85]; // Slate-700
      const lightBgColor = [248, 250, 252]; // Slate-50

      // Header Banner (Reduced height to 20mm)
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 20, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text("RAPPORT DE SYNTHÈSE DE PROJET", 15, 12);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 15, 17);
      
      // Right header flag (Reduced height to 20mm)
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(185, 0, 25, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text("NDC", 192, 12);
      
      let y = 26;

      // 1. Location & Map Section (Combined in a single box)
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.rect(15, y, 180, 52, 'FD');

      // Left Column: Text Info
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("1. Localisation & Environnement", 20, y + 6);

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text("Adresse :", 20, y + 13);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedAddress?.name || 'Coordonnées sélectionnées', 36, y + 13);
      
      doc.setFont('helvetica', 'bold');
      doc.text("Ville :", 20, y + 19);
      doc.setFont('helvetica', 'normal');
      doc.text(`${selectedAddress?.postcode || ''} ${selectedAddress?.city || ''} ${selectedAddress?.context ? `• ${selectedAddress.context}` : ''}`, 30, y + 19);

      doc.setFont('helvetica', 'bold');
      doc.text("Coordonnées :", 20, y + 25);
      doc.setFont('helvetica', 'normal');
      doc.text(`Lat : ${selectedCoords?.latitude.toFixed(6)}, Lng : ${selectedCoords?.longitude.toFixed(6)}`, 42, y + 25);

      // Environment badges layout inside left column
      doc.setFont('helvetica', 'bold');
      doc.text("Vent :", 20, y + 34);
      doc.setFont('helvetica', 'normal');
      doc.text(`Région ${lookupResult.detected_region || 'N/A'}`, 30, y + 34);

      doc.setFont('helvetica', 'bold');
      doc.text("Terrain :", 20, y + 40);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(successColor[0], successColor[1], successColor[2]);
      doc.text(`Terrain ${lookupResult.detected_terrain_type || 'IIIb'}`, 33, y + 40);

      // Right Column: Map Screenshot
      if (mapImgData) {
        doc.addImage(mapImgData, 'PNG', 105, y + 4, 86, 44);

        // Draw pin using vector graphics in jsPDF at the exact center of the map image
        const pinCenterX = 105 + (86 / 2);
        const pinBottomY = y + 4 + (44 / 2);
        const pinHeight = 7;
        const pinBubbleRadius = 2.2;
        const bubbleCenterY = pinBottomY - pinHeight + pinBubbleRadius;

        doc.setFillColor(244, 63, 94); // #f43f5e
        doc.setDrawColor(255, 255, 255); // White outline
        doc.setLineWidth(0.4);

        doc.circle(pinCenterX, bubbleCenterY, pinBubbleRadius, 'FD');
        doc.triangle(
          pinCenterX - 1.4, bubbleCenterY + 0.8,
          pinCenterX + 1.4, bubbleCenterY + 0.8,
          pinCenterX, pinBottomY,
          'FD'
        );

        doc.setFillColor(255, 255, 255);
        doc.circle(pinCenterX, bubbleCenterY, 0.8, 'F');
      } else {
        doc.setDrawColor(203, 213, 225); // Slate-300
        doc.rect(105, y + 4, 86, 44);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text("Aperçu cartographique indisponible", 125, y + 26);
      }

      y += 58;

      // 2. Technical results (Without "Entrée correspondante du catalogue")
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("2. Caractéristiques Techniques du Catalogue", 15, y);
      y += 5;

      const eq = lookupResult.equipment && lookupResult.equipment[0];
      const montageId = eq ? (eq.item_id || eq.id) : `montage_${selectedMontage.toLowerCase()}`;
      const { material } = eq ? (getTerrainDetails(eq) as any) : { material: '139x4mm' };

      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, y, 180, 26, 'FD');

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text("Profil de mât requis :", 20, y + 6);
      doc.setTextColor(successColor[0], successColor[1], successColor[2]);
      doc.text(material, 52, y + 6);

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text("Équipement FH requis :", 20, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(hasFhEquipment ? `Faisceau Hertzien (${fhWeight} kg)` : "Aucun", 55, y + 12);

      doc.setFont('helvetica', 'bold');
      doc.text("Justification :", 20, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const justificationText = eq?.comments || "Section structurelle vérifiée calculée sous les contraintes de l'Eurocode pour la catégorie de terrain sélectionnée.";
      const splitComments = doc.splitTextToSize(justificationText, 148);
      doc.text(splitComments, 40, y + 18);

      y += 32;

      // 3. Antenna Specifications
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text("3. Spécifications de Charge d'Antennes", 15, y);
      y += 5;

      // 4G Specs Card
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(15, y, 87, 30, 'FD');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text("Modèle d'antenne 4G", 20, y + 5);

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Hauteur : ${ant4gHeight} mm`, 20, y + 11);
      doc.text(`Largeur : ${ant4gWidth} mm`, 20, y + 16);
      doc.text(`Épaisseur : ${ant4gThickness} mm`, 20, y + 21);
      doc.setFont('helvetica', 'bold');
      doc.text(`Poids : ${ant4gWeight} daN`, 20, y + 26);

      // 5G Specs Card
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(108, y, 87, 30, 'FD');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text("Modèle d'antenne 5G", 113, y + 5);

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Hauteur : ${ant5gHeight} mm`, 113, y + 11);
      doc.text(`Largeur : ${ant5gWidth} mm`, 113, y + 16);
      doc.text(`Épaisseur : ${ant5gThickness} mm`, 113, y + 21);
      doc.setFont('helvetica', 'bold');
      doc.text(`Poids : ${ant5gWeight} daN`, 113, y + 26);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Document généré automatiquement - Projet NDC", 105, 287, { align: 'center' });

      doc.save(`ndc_synthese_${montageId}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Une erreur est survenue lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Re-trigger catalog lookup when height, building height or montage changes (if address selected)
  useEffect(() => {
    if (selectedCoords) {
      fetchCatalogueData(selectedCoords.latitude, selectedCoords.longitude, selectedHeight, recommendedBuildingHeight, queryMontage);
    } else {
      setLookupResult(null);
    }
  }, [selectedHeight, recommendedBuildingHeight, selectedCoords, queryMontage, fetchCatalogueData]);

  // Handle address selection from dropdown
  const handleSelectSuggestion = (address: GeocodingAddress) => {
    setSelectedAddress(address);
    setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
    setSearchQuery(address.label);
    setSuggestions([]);
    setIsSearchOpen(false);

    if (mapInstance) {
      mapInstance.flyTo({
        center: [address.longitude, address.latitude],
        zoom: 15,
        essential: true,
      });
    }
  };

  // Handle map click
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setSelectedCoords({ latitude: lat, longitude: lng });

    // Reverse geocode to get address details
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          const coords = data.features[0].geometry.coordinates;
          const address: GeocodingAddress = {
            label: props.label || '',
            name: props.name || '',
            postcode: props.postcode || '',
            city: props.city || '',
            context: props.context || '',
            type: props.type || '',
            importance: props.importance || 0,
            longitude: coords[0],
            latitude: coords[1],
            target_terrain: null
          };
          setSelectedAddress(address);
          setSearchQuery(address.label);
        } else {
          setSelectedAddress({
            label: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            name: 'Selected Point',
            postcode: '',
            city: '',
            context: '',
            type: 'point',
            importance: 0,
            longitude: lng,
            latitude: lat,
            target_terrain: null
          });
          setSearchQuery(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      }
    } catch (e) {
      console.error('Failed to reverse geocode clicked point:', e);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearchOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await search(value);
      setSuggestions(results);
    }, 300);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    setSelectedAddress(null);
    setSelectedCoords(null);
    setLookupResult(null);
    setIsSearchOpen(false);
    setHasFhEquipment(false);
    setFhWeight(30);
  };

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    setMapInstance(map);
  }, []);

  // Get the document list and section material for the classified terrain category
  const getTerrainDetails = (eq: any) => {
    const terrain = lookupResult?.detected_terrain_type || 'IIIa'; // Default to IIIa if not detected

    // Find matching calculation for detected terrain
    const calc = eq.terrain_calculations?.find((c: any) => c.terrain_type === terrain);
    const material = calc?.material_specification || calc?.section_material || 'N/A';

    // Extract document URLs
    let docList: { url: string; localUrl?: string; filename: string; ext: string }[] = [];

    // Parse original Monday.com URLs
    const mondayUrls = calc?.documentation?.document_urls
      ? calc.documentation.document_urls.split(',').map((u: string) => u.trim())
      : [];

    // Parse local URLs
    const localUrls = calc?.documentation?.local_document_urls
      ? calc.documentation.local_document_urls.split(',').map((u: string) => u.trim())
      : [];

    if (mondayUrls.length > 0) {
      docList = mondayUrls
        .filter((url: string) => !url.toLowerCase().endsWith('.rtd'))
        .map((url: string) => {
          const parts = url.split('/');
          const filename = parts[parts.length - 1] || 'Document';
          const decodedFilename = decodeURIComponent(filename);
          const ext = decodedFilename.split('.').pop()?.toUpperCase() || 'DOC';

          // Find corresponding local URL if it exists
          const localUrl = localUrls.find((lu: string) => decodeURIComponent(lu).endsWith(decodedFilename));

          return {
            url,
            localUrl,
            filename: decodedFilename,
            ext
          };
        });
    }

    return { material, docList, terrain };
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full bg-slate-900 text-slate-100">

      {/* Left Pane - Search, Info & Map */}
      <div className="w-full md:w-5/12 xl:w-4/12 flex flex-col border-r border-slate-800 bg-slate-950 p-6 overflow-y-auto space-y-6">

        {/* Title & Introduction & Notifications */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              Catalogue de Conception d'Antennes
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors relative"
              >
                <Bell className="w-4 h-4 text-slate-300" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 text-[8px] font-bold text-white items-center justify-center">
                      {notifications.filter(n => !n.is_read).length}
                    </span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[2000] overflow-hidden">
                  <div className="p-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-200">Notifications</h4>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-medium">
                        {notifications.filter(n => !n.is_read).length} non lues
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Aucune notification
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                          className={`p-3 text-xs transition-colors cursor-pointer ${notif.is_read ? 'opacity-60 bg-transparent' : 'bg-indigo-500/5 hover:bg-indigo-500/10'}`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <span className="font-bold text-slate-200">{notif.title}</span>
                            {!notif.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1"></span>}
                          </div>
                          <p className="text-slate-400 leading-relaxed">{notif.message}</p>
                          <div className="text-[10px] text-slate-500 mt-2">
                            {new Date(notif.created_at).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold mt-1 text-white">Recherche de Conception Publique</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Déterminez le profil de structure de mât requis et téléchargez les modèles de calcul pour votre site. Recherchez par adresse et spécifiez la hauteur de mât souhaitée.
          </p>

          {/* Configuration Summary Badge */}
          {(initialSiteType || initialFoundationType) && (
            <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs animate-fade-in">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Configuration</span>
                <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
                  <span>Site: <strong className="text-indigo-400">{initialSiteType === 'nouveau' ? 'Nouveau' : 'Existant'}</strong></span>
                  <span className="text-slate-700">•</span>
                  <span>Fondation: <strong className="text-indigo-400">{initialFoundationType === 'metallique' ? 'Plot métallique' : initialFoundationType === 'beton' ? 'Plot Béton' : 'Encastré'}</strong></span>
                </div>
              </div>
              <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full shrink-0">
                {initialMontage ? `Cas 1 Active` : 'Non configuré'}
              </span>
            </div>
          )}
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          {/* Address Search Field */}
          <div className="flex flex-col space-y-1.5" ref={searchContainerRef}>
            <label className="text-xs font-semibold text-slate-300">1. Sélectionner l'emplacement</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Entrez une adresse en France..."
                className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              {searchLoading && (
                <div className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {!searchLoading && searchQuery && (
                <button
                  onClick={handleClear}
                  className="absolute inset-y-0 right-2 px-1 flex items-center text-slate-500 hover:text-white transition-colors"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* suggestions dropdown */}
            {isSearchOpen && (suggestions.length > 0 || (searchQuery.trim() && !searchLoading && suggestions.length === 0)) && (
              <div className="absolute mt-14 w-[calc(100%-3rem)] md:w-[350px] bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[2000] divide-y divide-slate-800">
                {suggestions.length > 0 ? (
                  suggestions.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(addr)}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-indigo-950 transition-colors flex items-start gap-2"
                      type="button"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">{addr.name}</div>
                        <div className="text-slate-400 mt-0.5">{addr.postcode} {addr.city}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">Aucune adresse trouvée</div>
                )}
              </div>
            )}
          </div>

          {/* Height Selection */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">2. Sélectionner la hauteur du mât (m)</label>
            <input
              type="number"
              value={selectedHeight || ''}
              onChange={(e) => setSelectedHeight(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="Ex: 3 ou 4"
              className="w-full py-2.5 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              min={1}
              max={50}
              step={0.5}
            />
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Recommandé :</span>
              {[3, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHeight(h)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-all ${selectedHeight === h
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  type="button"
                >
                  {h}m
                </button>
              ))}
            </div>
          </div>

          {/* Building Height Selection */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">3. Saisir la hauteur du bâtiment (m)</label>
            <input
              type="number"
              value={selectedBuildingHeight || ''}
              onChange={(e) => setSelectedBuildingHeight(e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="Ex: 15"
              className="w-full py-2.5 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              min={1}
              max={100}
              step={0.5}
            />
          </div>

          {/* Montage Selection */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">4. Sélectionner le type de montage</label>
            <select
              value={selectedMontage}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMontage(val);
                if (val && val !== 'custom') {
                  const spec = MONTAGES_SPECS.find(m => m.id === val);
                  if (spec) {
                    setAnt4gModel(val);
                    setAnt4gHeight(spec.ant4g.height);
                    setAnt4gWidth(spec.ant4g.width);
                    setAnt4gThickness(spec.ant4g.thickness);
                    setAnt4gWeight(spec.ant4g.weight);

                    setAnt5gModel(val);
                    setAnt5gHeight(spec.ant5g.height);
                    setAnt5gWidth(spec.ant5g.width);
                    setAnt5gThickness(spec.ant5g.thickness);
                    setAnt5gWeight(spec.ant5g.weight);
                  }
                }
              }}
              className="w-full py-2.5 px-3 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">-- Choisir le type de montage --</option>
              {MONTAGES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="custom">⚙️ Configuration sur-mesure (Personnalisée)</option>
            </select>
          </div>

          {/* Antenna Configuration Panels */}
          {selectedMontage && (
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                <span>Configuration des Antennes</span>
                {selectedMontage === 'custom' && (
                  <span className="text-[10px] text-amber-400 bg-amber-400/15 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-semibold animate-pulse">
                    Personnalisée
                  </span>
                )}
              </div>

              {/* 4G Antenna Configuration Card */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-xs font-semibold text-slate-200">Antenne 4G</span>
                  {selectedMontage !== 'custom' ? (
                    <button
                      onClick={() => setSelectedMontage('custom')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                      type="button"
                    >
                      Personnaliser
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] font-medium text-slate-500">Modèle type</span>
                    <select
                      value={ant4gModel}
                      disabled={selectedMontage !== 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnt4gModel(val);
                        if (val !== 'custom') {
                          const spec = MONTAGES_SPECS.find(m => m.id === val);
                          if (spec) {
                            setAnt4gHeight(spec.ant4g.height);
                            setAnt4gWidth(spec.ant4g.width);
                            setAnt4gThickness(spec.ant4g.thickness);
                            setAnt4gWeight(spec.ant4g.weight);
                          }
                        }
                      }}
                      className="w-full py-1.5 px-2.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {MONTAGES_SPECS.map(m => (
                        <option key={m.id} value={m.id}>Standard {m.name} ({m.ant4g.height}x{m.ant4g.width}x{m.ant4g.thickness} mm)</option>
                      ))}
                      <option value="custom">-- Dimensions personnalisées --</option>
                    </select>
                  </div>

                  {/* 4G Custom Dimensions inputs */}
                  {(selectedMontage === 'custom' || ant4gModel === 'custom') && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/30">
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Hauteur (mm)</label>
                        <input
                          type="number"
                          value={ant4gHeight || ''}
                          disabled={ant4gModel !== 'custom'}
                          onChange={(e) => setAnt4gHeight(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Largeur (mm)</label>
                        <input
                          type="number"
                          value={ant4gWidth || ''}
                          disabled={ant4gModel !== 'custom'}
                          onChange={(e) => setAnt4gWidth(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Épaisseur (mm)</label>
                        <input
                          type="number"
                          value={ant4gThickness || ''}
                          disabled={ant4gModel !== 'custom'}
                          onChange={(e) => setAnt4gThickness(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Poids (daN)</label>
                        <input
                          type="number"
                          value={ant4gWeight || ''}
                          disabled={ant4gModel !== 'custom'}
                          onChange={(e) => setAnt4gWeight(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5G Antenna Configuration Card */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-xs font-semibold text-slate-200">Antenne 5G</span>
                  {selectedMontage !== 'custom' ? (
                    <button
                      onClick={() => setSelectedMontage('custom')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                      type="button"
                    >
                      Personnaliser
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] font-medium text-slate-500">Modèle type</span>
                    <select
                      value={ant5gModel}
                      disabled={selectedMontage !== 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnt5gModel(val);
                        if (val !== 'custom') {
                          const spec = MONTAGES_SPECS.find(m => m.id === val);
                          if (spec) {
                            setAnt5gHeight(spec.ant5g.height);
                            setAnt5gWidth(spec.ant5g.width);
                            setAnt5gThickness(spec.ant5g.thickness);
                            setAnt5gWeight(spec.ant5g.weight);
                          }
                        }
                      }}
                      className="w-full py-1.5 px-2.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {MONTAGES_SPECS.map(m => (
                        <option key={m.id} value={m.id}>Standard {m.name} ({m.ant5g.height}x{m.ant5g.width}x{m.ant5g.thickness} mm)</option>
                      ))}
                      <option value="custom">-- Dimensions personnalisées --</option>
                    </select>
                  </div>

                  {/* 5G Custom Dimensions inputs */}
                  {(selectedMontage === 'custom' || ant5gModel === 'custom') && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/30">
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Hauteur (mm)</label>
                        <input
                          type="number"
                          value={ant5gHeight || ''}
                          disabled={ant5gModel !== 'custom'}
                          onChange={(e) => setAnt5gHeight(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Largeur (mm)</label>
                        <input
                          type="number"
                          value={ant5gWidth || ''}
                          disabled={ant5gModel !== 'custom'}
                          onChange={(e) => setAnt5gWidth(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Épaisseur (mm)</label>
                        <input
                          type="number"
                          value={ant5gThickness || ''}
                          disabled={ant5gModel !== 'custom'}
                          onChange={(e) => setAnt5gThickness(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500">Poids (daN)</label>
                        <input
                          type="number"
                          value={ant5gWeight || ''}
                          disabled={ant5gModel !== 'custom'}
                          onChange={(e) => setAnt5gWeight(Number(e.target.value))}
                          className="w-full py-1.5 px-2 bg-slate-950 border border-slate-850 rounded-md text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FH Equipment Selection */}
          <div className="flex flex-col space-y-2.5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label htmlFor="fh-checkbox" className="text-xs font-semibold text-slate-350 cursor-pointer flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>5. Ajouter un équipement FH (Optionnel)</span>
              </label>
              <input
                id="fh-checkbox"
                type="checkbox"
                checked={hasFhEquipment}
                onChange={(e) => setHasFhEquipment(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 text-indigo-650 focus:ring-indigo-500 focus:ring-offset-slate-950 bg-slate-900 focus:ring-2 cursor-pointer"
              />
            </div>

            {hasFhEquipment && (
              <div className="flex flex-col space-y-1.5 animate-fadeIn">
                <span className="text-[10px] text-slate-500 font-medium">Sélectionner le poids du Faisceau Hertzien</span>
                <select
                  value={fhWeight}
                  onChange={(e) => setFhWeight(Number(e.target.value))}
                  className="w-full py-2 px-3 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  {[30, 35, 40, 45, 50, 55, 60, 65, 70].map((w) => (
                    <option key={w} value={w}>
                      {w} kg
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Full Interactive Map Container — hidden by default, toggle via Ctrl+M */}
        {showMap && (
          <div className="flex-1 min-h-[220px] rounded-xl border border-slate-800 overflow-hidden relative bg-slate-900 animate-fadeIn">
            <TerrainMap
              onMapClick={handleMapClick}
              onMapLoad={handleMapLoad}
              selectedCoordinates={selectedCoords}
              analysisRadius={0.5}
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-sm border border-slate-800/80 rounded-full py-1.5 px-3 text-[10px] text-slate-300 pointer-events-none flex items-center gap-1.5 whitespace-nowrap shadow-lg z-10">
              <Compass className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
              <span>Cliquez pour sélectionner un point</span>
            </div>
            <div className="absolute top-2 right-2 bg-slate-950/90 backdrop-blur-sm border border-indigo-500/30 rounded-lg py-1 px-2 text-[9px] text-indigo-300 font-semibold z-10 flex items-center gap-1">
              <MapIcon className="w-3 h-3" />
              Ctrl+M pour masquer
            </div>
          </div>
        )}
      </div>

      {/* Right Pane - Results Catalogue Dashboard */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 lg:p-8 space-y-6">

        {/* Loading / Empty States */}
        {!selectedCoords && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Aucun emplacement sélectionné</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Utilisez la barre de recherche d'adresse à gauche pour déterminer les règles de terrain locales et récupérer les données du catalogue.
            </p>
          </div>
        )}

        {selectedCoords && !selectedMontage && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4">
              <Layers className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Sélectionner le type de montage</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Veuillez choisir un type de montage dans le menu déroulant à gauche pour récupérer les spécifications de conception spécifiques et les documents Monday.com.
            </p>
          </div>
        )}

        {selectedCoords && selectedMontage && loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <h3 className="text-base font-semibold text-white">Correspondance des fichiers du catalogue...</h3>
            <p className="text-xs text-slate-400 mt-1">Classification du terrain et récupération de l'analyse structurelle</p>
          </div>
        )}

        {selectedCoords && selectedMontage && error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-rose-400">
            <AlertCircle className="w-10 h-10 mb-3" />
            <h3 className="text-base font-bold">Erreur de catalogue</h3>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        )}

        {/* Dashboard Content */}
        {selectedCoords && selectedMontage && !loading && !error && lookupResult && (
          <div className="space-y-6">

            {/* Header: Location & Classified Metadata */}
            <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Mini Map Preview — shown when the full map is hidden */}
                {!showMap && selectedCoords && (
                  <div
                    ref={miniMapContainerRef}
                    className="w-[72px] h-[72px] rounded-xl border-2 border-slate-700 overflow-hidden shrink-0 shadow-lg relative"
                    title={`${selectedCoords.latitude.toFixed(5)}, ${selectedCoords.longitude.toFixed(5)}`}
                    style={{ cursor: 'default' }}
                  >
                    {/* Gradient overlay for polish */}
                    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none z-10" />
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Détails de l'emplacement classé</span>
                  <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    {selectedAddress?.name || 'Coordonnées sélectionnées'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedAddress?.postcode} {selectedAddress?.city} {selectedAddress?.context && `• ${selectedAddress.context}`}
                  </p>
                </div>
              </div>

              {/* Geographic Constraints badges */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfGenerating}
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-70 text-white border border-indigo-500/30 px-4 py-2.5 rounded-xl text-center flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25 transition-all text-xs font-semibold h-11"
                >
                  {pdfGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Génération...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger Fiche PDF</span>
                    </>
                  )}
                </button>

                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[100px] h-11 flex flex-col justify-center">
                  <div className="text-[9px] uppercase font-semibold text-slate-550 leading-none">Région de vent</div>
                  <div className="text-xs font-bold text-white mt-1 leading-none">
                    Région {lookupResult.detected_region || 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[120px] h-11 flex flex-col justify-center">
                  <div className="text-[9px] uppercase font-semibold text-slate-550 leading-none">Catégorie de terrain</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1 leading-none">
                    <Layers className="w-3 h-3 text-emerald-500" />
                    Terrain {lookupResult.detected_terrain_type || 'IIIa'}
                  </div>
                </div>
              </div>
            </div>

            {/* Building Height Recommendation Warning */}
            {!isPrecalculatedBuildingHeight && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-amber-400">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 animate-bounce" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">Hauteur de bâtiment recommandée</div>
                  <p className="text-xs mt-1 leading-relaxed text-slate-300">
                    La hauteur de bâtiment saisie (<strong>{selectedBuildingHeight}m</strong>) ne fait pas partie du catalogue de calcul standard.
                    Nous recommandons d'utiliser l'étude de structure précalculée pour <strong>{recommendedBuildingHeight}m</strong>.
                    Les résultats ci-dessous correspondent à cette recommandation.
                  </p>
                </div>
              </div>
            )}

            {/* Main Catalogue Search Result */}
            {(!queryMontage || lookupResult.equipment.length === 0) ? (
              <div className="p-8 border border-slate-800 bg-slate-950/40 rounded-2xl text-center text-slate-400">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="font-semibold text-white">Aucune correspondance exacte dans le catalogue</h4>
                <p className="text-xs mt-1">
                  {!queryMontage
                    ? "Les dimensions de l'antenne 4G saisie ne correspondent à aucun profil type standard du catalogue. Le profil de mât requis ne peut pas être déterminé automatiquement."
                    : `Aucun catalogue enregistré ne correspond à la hauteur de mât sélectionnée (${selectedHeight}m), à la hauteur de bâtiment recommandée (${recommendedBuildingHeight}m) et à la région (${lookupResult.detected_region || 'N/A'}).`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Loop matching models (usually there's one exact match per height/region) */}
                {lookupResult.equipment.map((eq: any) => {
                  const { material, docList, terrain } = getTerrainDetails(eq);

                  return (
                    <div key={eq.id} className="col-span-1 xl:col-span-2 bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">

                      {/* Ribbon / Top header bar */}
                      <div className="bg-gradient-to-r from-indigo-950 to-indigo-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-900/60 gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-indigo-300 tracking-wider uppercase">Entrée correspondante du catalogue de conception</div>
                          <h4 className="text-xl font-extrabold text-white mt-0.5">{eq.name}</h4>
                        </div>
                        <span className="self-start sm:self-auto bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold">
                          ID : {eq.item_id || eq.id}
                        </span>
                      </div>

                      {/* Details & calculations Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 flex-1">

                        {/* Column 1: Technical & Structural Specs */}
                        <div className="lg:col-span-7 p-6 space-y-6">

                          {/* Structural Profile Alert / Callout */}
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-semibold">Profil de mât requis</div>
                              <div className="text-lg font-bold text-emerald-400 mt-0.5">{material}</div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Section structurelle vérifiée calculée sous les contraintes de l'Eurocode pour la catégorie de terrain {terrain}.
                              </p>
                            </div>
                          </div>

                          {/* FH Equipment Callout */}
                          {hasFhEquipment && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                              <Compass className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-xs text-slate-400 uppercase font-semibold">Équipement FH requis</div>
                                <div className="text-lg font-bold text-indigo-400 mt-0.5">Faisceau Hertzien ({fhWeight} kg)</div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Équipement supplémentaire pris en compte dans le calcul de charge technique de la structure.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 4G & 5G Antenna Specs */}
                          <div className="space-y-3">
                            <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              Spécifications de charge d'antenne
                            </h5>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* 4G specifications */}
                              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                                <div className="text-xs font-bold text-indigo-400 uppercase flex justify-between items-center">
                                  <span>Modèle d'antenne 4G</span>
                                  {ant4gModel === 'custom' && <span className="text-[10px] text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-500/20">Sur-mesure</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-xs">
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Hauteur</div>
                                    <div className="font-semibold text-slate-200">{ant4gHeight} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Largeur</div>
                                    <div className="font-semibold text-slate-200">{ant4gWidth} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Épaisseur</div>
                                    <div className="font-semibold text-slate-200">{ant4gThickness} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Poids</div>
                                    <div className="font-semibold text-emerald-400">{ant4gWeight} daN</div>
                                  </div>
                                </div>
                              </div>

                              {/* 5G specifications */}
                              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5">
                                <div className="text-xs font-bold text-indigo-400 uppercase flex justify-between items-center">
                                  <span>Modèle d'antenne 5G</span>
                                  {ant5gModel === 'custom' && <span className="text-[10px] text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-500/20">Sur-mesure</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-xs">
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Hauteur</div>
                                    <div className="font-semibold text-slate-200">{ant5gHeight} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Largeur</div>
                                    <div className="font-semibold text-slate-200">{ant5gWidth} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Épaisseur</div>
                                    <div className="font-semibold text-slate-200">{ant5gThickness} mm</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 text-[10px]">Poids</div>
                                    <div className="font-semibold text-emerald-400">{ant5gWeight} daN</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Extra info: Responsible person & comments */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-800/80">
                            <div>
                              <div className="text-slate-500">Propriétaire de la conception</div>
                              <div className="font-medium text-slate-300 mt-0.5">{eq.responsible_person || 'Dépt Ingénierie'}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Sous-éléments</div>
                              <div className="font-medium text-slate-300 mt-0.5">{eq.sub_elements || 'Montage Standard'}</div>
                            </div>
                            {eq.comments && (
                              <div className="col-span-2">
                                <div className="text-slate-500">Remarques / Notes</div>
                                <p className="text-slate-400 mt-0.5 leading-relaxed">{eq.comments}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Column 2: Documents Download */}
                        <div className="lg:col-span-5 p-6 bg-slate-900/30 flex flex-col justify-between">
                          <div className="space-y-4">
                            <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Download className="w-3.5 h-3.5 text-indigo-400" />
                              Fichier de calculs techniques
                            </h5>

                            {!isPrecalculatedBuildingHeight ? (
                              <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-5 flex flex-col items-center text-center shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                                <AlertCircle className="w-8 h-8 text-indigo-400 mb-3" />
                                <div className="text-sm font-bold text-white mb-1">Hauteur personnalisée ({selectedBuildingHeight}m)</div>
                                <p className="text-[11px] text-slate-400 leading-relaxed mb-4 max-w-[200px] mx-auto">
                                  Le fichier de calcul technique pour cette hauteur exacte n'existe pas encore dans le catalogue standard.
                                  {hasFhEquipment && (
                                    <span className="block mt-1.5 font-semibold text-indigo-300">
                                      (Inclut un équipement FH de {fhWeight}kg)
                                    </span>
                                  )}
                                </p>
                                <button
                                  onClick={() => setShowRequestForm(true)}
                                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
                                >
                                  Créer une demande pour cette hauteur
                                  <Send className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {docList.length === 0 && !hasFhEquipment ? (
                                  <div className="text-center py-8 text-slate-500 text-xs">
                                    Aucun document de calcul disponible pour cette configuration.
                                  </div>
                                ) : (
                                  <>
                                    {docList.map((doc, dIdx) => {
                                      const downloadUrl = doc.localUrl ? doc.localUrl : doc.url;
                                      const isLocal = !!doc.localUrl;

                                      return (
                                        <button
                                          key={dIdx}
                                          onClick={() => {
                                            const isDoc = doc.filename.toLowerCase().endsWith('.docx') || doc.filename.toLowerCase().endsWith('.doc');
                                            setPreviewDoc({
                                              url: downloadUrl,
                                              filename: doc.filename,
                                              isConverting: isDoc
                                            });
                                          }}
                                          className="w-full flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-indigo-500 hover:bg-slate-900 group transition-all text-left"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${doc.ext === 'RTD'
                                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                                              : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                                              }`}>
                                              {doc.ext}
                                            </div>
                                            <div className="text-left">
                                              <div className="text-xs font-bold text-slate-300 group-hover:text-indigo-400 transition-colors line-clamp-1 max-w-[150px] sm:max-w-none">
                                                {doc.filename}
                                              </div>
                                              <div className="text-[10px] text-slate-500 mt-0.5">
                                                {isLocal ? (
                                                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                                    Note de Calcul
                                                  </span>
                                                ) : (
                                                  <span className="text-amber-500 flex items-center gap-0.5">
                                                    🔒 Connexion Monday.com requise
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <Download className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                                        </button>
                                      );
                                    })}

                                    {hasFhEquipment && (
                                      <button
                                        onClick={() => alert("Fiche de calcul technique FH (Faisceau Hertzien) non disponible actuellement (Placeholder).")}
                                        className="w-full flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 border-dashed rounded-xl hover:border-indigo-500/50 hover:bg-slate-900/50 group transition-all text-left relative overflow-hidden"
                                        type="button"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold bg-indigo-950 text-indigo-400 border border-indigo-900/30">
                                            PDF
                                          </div>
                                          <div className="text-left">
                                            <div className="text-xs font-bold text-slate-300 group-hover:text-indigo-400 transition-colors line-clamp-1">
                                              Calcul FH
                                            </div>
                                            <div className="text-[10px] text-indigo-400 mt-0.5 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                              Fiche Technique
                                            </div>
                                          </div>
                                        </div>
                                        <Download className="w-4 h-4 text-slate-600 cursor-not-allowed group-hover:text-slate-400 transition-colors" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick validation badge */}
                          <div className="mt-6 border-t border-slate-800/80 pt-4 flex items-center gap-2 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              {hitPredefinedMontage ? "Prêt pour soumission aux achats" : "Profil structurel validé"}
                            </span>
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>
            )}
          </div>
        )}
      </div>

      {/* Height Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                Demande de Calcul Technique
              </h3>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {requestSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Demande Envoyée !</h4>
                  <p className="text-sm text-slate-400">
                    Votre demande a été transmise au département Génie Civil.
                    Vous recevrez une notification lorsque les calculs seront disponibles.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="space-y-6">
                  {/* Summary of what is being requested */}
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-2 text-sm">
                    <p className="text-indigo-300 font-medium mb-2 text-xs uppercase tracking-wider">Configuration technique :</p>
                    <ul className="grid grid-cols-2 gap-2 text-slate-300 text-xs">
                      <li>• Bâtiment : <span className="font-bold text-white">{selectedBuildingHeight}m</span></li>
                      <li>• Mât : <span className="font-bold text-white">{selectedHeight}m</span></li>
                      <li>• Montage : <span className="font-bold text-white">{selectedMontage}</span></li>
                      <li>• Terrain : <span className="font-bold text-white">{lookupResult?.detected_terrain_type || 'N/A'}</span></li>
                      {hasFhEquipment && (
                        <li className="col-span-2">• Équipement FH : <span className="font-bold text-white">Oui ({fhWeight}kg)</span></li>
                      )}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Nom complet <span className="text-rose-500">*</span></label>
                      <input
                        required
                        type="text"
                        value={requestFormData.name}
                        onChange={e => setRequestFormData({ ...requestFormData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Adresse Email <span className="text-rose-500">*</span></label>
                      <input
                        required
                        type="email"
                        value={requestFormData.email}
                        onChange={e => setRequestFormData({ ...requestFormData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="jean.dupont@entreprise.com"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Nécessaire pour recevoir les notifications sur cette demande.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Téléphone (Optionnel)</label>
                      <input
                        type="tel"
                        value={requestFormData.phone}
                        onChange={e => setRequestFormData({ ...requestFormData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="+33 6 12 34 56 78"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Description / Justification</label>
                      <textarea
                        rows={3}
                        value={requestFormData.description}
                        onChange={e => setRequestFormData({ ...requestFormData, description: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none custom-scrollbar"
                        placeholder="Précisez le contexte de cette demande de hauteur spécifique..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-slate-900 pb-2">
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRequest}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingRequest ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Soumettre</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center z-10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 line-clamp-1">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Aperçu : {previewDoc.filename}
              </h3>
              <div className="flex items-center gap-3">
                <a
                  href={previewDoc.originalUrl || previewDoc.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950/50 p-2 overflow-hidden flex items-center justify-center">
              {previewDoc.isConverting ? (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                  <p className="text-sm font-semibold">Génération de l'aperçu PDF...</p>
                  <p className="text-xs mt-1">Cela peut prendre quelques secondes.</p>
                </div>
              ) : previewDoc.conversionFailed ? (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                  <AlertCircle className="w-12 h-12 text-amber-400" />
                  <p className="text-sm font-semibold text-slate-200">Aperçu non disponible</p>
                  <p className="text-xs text-slate-400 text-center max-w-sm">
                    La conversion du document a échoué. Vous pouvez toujours télécharger le fichier original.
                  </p>
                  <a
                    href={previewDoc.originalUrl || previewDoc.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger le fichier original
                  </a>
                </div>
              ) : (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full rounded-xl bg-white border-0 shadow-inner"
                  title={`Aperçu de ${previewDoc.filename}`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
