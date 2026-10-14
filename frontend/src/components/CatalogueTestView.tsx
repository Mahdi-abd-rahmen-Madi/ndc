import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, RefreshCw, Download, Copy, Check, Filter, 
  Layers, Database, FileText, ArrowUpDown, ChevronRight,
  Radio, Cpu, Box, Activity, AlertCircle, X, ExternalLink, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface EquipmentItem {
  category: string;
  operator: string;
  id: string;
  reference: string;
  vendor?: string;
  montage_id?: string;
  specs: string;
}

interface FileMetadata {
  full_path: string;
  relative_path: string;
  file_size_kb: number;
  last_modified: string;
  updated_at: string;
}

interface OperatorStats {
  total: number;
  antennes: number;
  rru: number;
  rrh: number;
  coffrets: number;
  fh: number;
  td: number;
  montages: number;
  categories: Record<string, number>;
}

interface ApiResponse {
  file_metadata: FileMetadata;
  total_count: number;
  stats_by_operator: {
    orange: OperatorStats;
    bouygues: OperatorStats;
    free: OperatorStats;
    sfr?: OperatorStats;
    all: OperatorStats;
  };
  stats_by_category: Record<string, number>;
  vendors: string[];
  items: EquipmentItem[];
}

export default function CatalogueTestView() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'table' | 'grouped' | 'matrix' | 'json'>('table');
  const [sortColumn, setSortColumn] = useState<keyof EquipmentItem>('operator');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const API_URL = `${import.meta.env.VITE_API_URL || ''}/api/geodata/test-catalogue/?format=json`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        throw new Error(`Erreur lors du chargement: HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les données du catalogue');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Keyboard shortcut '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input-box')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      // Operator filter
      if (selectedOperator) {
        const op = (item.operator || 'all').toLowerCase();
        if (op !== selectedOperator.toLowerCase()) return false;
      }

      // Category filter
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }

      // Vendor filter
      if (selectedVendor && (item.vendor || '').toLowerCase() !== selectedVendor.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOp = (item.operator || '').toLowerCase().includes(q);
        const matchesCat = (item.category || '').toLowerCase().includes(q);
        const matchesRef = (item.reference || '').toLowerCase().includes(q);
        const matchesId = (item.id || '').toLowerCase().includes(q);
        const matchesVendor = (item.vendor || '').toLowerCase().includes(q);
        const matchesSpecs = (item.specs || '').toLowerCase().includes(q);
        if (!matchesOp && !matchesCat && !matchesRef && !matchesId && !matchesVendor && !matchesSpecs) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const valA = (a[sortColumn] || '').toString().toLowerCase();
      const valB = (b[sortColumn] || '').toString().toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data?.items, selectedOperator, selectedCategory, selectedVendor, searchQuery, sortColumn, sortAsc]);

  const handleSort = (col: keyof EquipmentItem) => {
    if (sortColumn === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
  };

  const resetFilters = () => {
    setSelectedOperator('');
    setSelectedCategory('');
    setSelectedVendor('');
    setSearchQuery('');
  };

  // CSV Export
  const exportCSV = () => {
    if (!filteredItems.length) return;
    const headers = ['Operateur', 'Categorie', 'Reference_Nom', 'Constructeur', 'ID_Technique', 'Specifications'];
    const rows = filteredItems.map((it) => [
      it.operator || 'all',
      it.category,
      `"${(it.reference || '').replace(/"/g, '""')}"`,
      it.vendor || '',
      it.id || '',
      `"${(it.specs || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalogue_equipements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Operator badge helper
  const renderOperatorBadge = (operator?: string) => {
    const op = (operator || 'all').toLowerCase();
    switch (op) {
      case 'orange':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Orange
          </span>
        );
      case 'bouygues':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Bouygues
          </span>
        );
      case 'free':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Free
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
            Commun
          </span>
        );
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
        <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Chargement du catalogue d'équipements...</h2>
        <p className="text-sm text-slate-500 mt-1">Lecture directe depuis catalogue_config.json</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-600">
        <div className="bg-white border border-rose-200 p-8 rounded-2xl max-w-md w-full text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Erreur de chargement</h2>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
          <button
            onClick={fetchData}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats_by_operator;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Toast Alert */}
      {copiedText && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2 text-sm font-semibold animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Copié dans le presse-papier !</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header */}
        <header className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Catalogue Équipements & Opérateurs
              </h1>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                Mode Test
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 mt-2 flex-wrap">
              <span>Validation des associations équipements / opérateurs</span>
              <span>•</span>
              <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                📁 {data?.file_metadata.relative_path}
              </span>
              <span>•</span>
              <span>
                🕒 Modifié le {data?.file_metadata.last_modified} ({data?.file_metadata.file_size_kb} KB)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/engineer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              title="Retourner à l'espace ingénieur"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              Espace Ingénieur
            </Link>

            <a
              href={API_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              title="Consulter le flux JSON brut"
            >
              <ExternalLink className="w-4 h-4" />
              Format JSON
            </a>

            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
              title="Recharger directement depuis le fichier JSON"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Recharger
            </button>
          </div>
        </header>

        {/* Operator KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Orange */}
          <div
            onClick={() => setSelectedOperator(selectedOperator === 'orange' ? '' : 'orange')}
            className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all border-l-4 border-l-orange-500 shadow-sm hover:shadow-md ${
              selectedOperator === 'orange' ? 'ring-2 ring-orange-500 border-orange-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                Orange
              </span>
              <span className="text-xs text-slate-400 font-semibold">Opérateur</span>
            </div>
            <div className="text-3xl font-extrabold text-orange-600 mb-2">
              {stats?.orange.total ?? 0}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Antennes: <strong className="text-slate-900">{stats?.orange.antennes ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                RRU: <strong className="text-slate-900">{stats?.orange.rru ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                RRH: <strong className="text-slate-900">{stats?.orange.rrh ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Bouygues */}
          <div
            onClick={() => setSelectedOperator(selectedOperator === 'bouygues' ? '' : 'bouygues')}
            className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all border-l-4 border-l-sky-500 shadow-sm hover:shadow-md ${
              selectedOperator === 'bouygues' ? 'ring-2 ring-sky-500 border-sky-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                Bouygues
              </span>
              <span className="text-xs text-slate-400 font-semibold">Opérateur</span>
            </div>
            <div className="text-3xl font-extrabold text-sky-600 mb-2">
              {stats?.bouygues.total ?? 0}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Antennes: <strong className="text-slate-900">{stats?.bouygues.antennes ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                RRU: <strong className="text-slate-900">{stats?.bouygues.rru ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                RRH: <strong className="text-slate-900">{stats?.bouygues.rrh ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Free */}
          <div
            onClick={() => setSelectedOperator(selectedOperator === 'free' ? '' : 'free')}
            className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all border-l-4 border-l-rose-500 shadow-sm hover:shadow-md ${
              selectedOperator === 'free' ? 'ring-2 ring-rose-500 border-rose-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Free
              </span>
              <span className="text-xs text-slate-400 font-semibold">Opérateur</span>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 mb-2">
              {stats?.free.total ?? 0}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Antennes: <strong className="text-slate-900">{stats?.free.antennes ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                RRH: <strong className="text-slate-900">{stats?.free.rrh ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                TD: <strong className="text-slate-900">{stats?.free.td ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* SFR */}
          <div
            onClick={() => setSelectedOperator(selectedOperator === 'sfr' ? '' : 'sfr')}
            className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all border-l-4 border-l-red-500 shadow-sm hover:shadow-md ${
              selectedOperator === 'sfr' ? 'ring-2 ring-red-500 border-red-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                SFR
              </span>
              <span className="text-xs text-slate-400 font-semibold">Opérateur</span>
            </div>
            <div className="text-3xl font-extrabold text-red-600 mb-2">
              {stats?.sfr?.total ?? 0}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Coffrets: <strong className="text-slate-900">{stats?.sfr?.coffrets ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Commun / Multiopérateur */}
          <div
            onClick={() => setSelectedOperator(selectedOperator === 'all' ? '' : 'all')}
            className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all border-l-4 border-l-violet-500 shadow-sm hover:shadow-md ${
              selectedOperator === 'all' ? 'ring-2 ring-violet-500 border-violet-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                Commun / Multiopérateur
              </span>
              <span className="text-xs text-slate-400 font-semibold">Général</span>
            </div>
            <div className="text-3xl font-extrabold text-violet-600 mb-2">
              {stats?.all.total ?? 0}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Montages: <strong className="text-slate-900">{stats?.all.montages ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                FH: <strong className="text-slate-900">{stats?.all.fh ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Coffrets: <strong className="text-slate-900">{stats?.all.coffrets ?? 0}</strong>
              </span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                TD: <strong className="text-slate-900">{stats?.all.td ?? 0}</strong>
              </span>
            </div>
          </div>
        </section>

        {/* Controls Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-input-box"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher référence, modèle, constructeur, ID... (Touche /)"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Vendor Select */}
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-sm cursor-pointer"
            >
              <option value="">Tous les constructeurs</option>
              {data?.vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {(selectedOperator || selectedCategory || selectedVendor || searchQuery) && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Effacer filtres
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            {/* Operator Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                Opérateur :
              </span>
              <button
                onClick={() => setSelectedOperator('')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  !selectedOperator
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Tous <span className="opacity-75 text-[10px]">({data?.total_count})</span>
              </button>
              <button
                onClick={() => setSelectedOperator(selectedOperator === 'orange' ? '' : 'orange')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  selectedOperator === 'orange'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                }`}
              >
                Orange <span className="text-[10px]">({stats?.orange.total})</span>
              </button>
              <button
                onClick={() => setSelectedOperator(selectedOperator === 'bouygues' ? '' : 'bouygues')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  selectedOperator === 'bouygues'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200'
                }`}
              >
                Bouygues <span className="text-[10px]">({stats?.bouygues.total})</span>
              </button>
              <button
                onClick={() => setSelectedOperator(selectedOperator === 'free' ? '' : 'free')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  selectedOperator === 'free'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
              >
                Free <span className="text-[10px]">({stats?.free.total})</span>
              </button>
              <button
                onClick={() => setSelectedOperator(selectedOperator === 'sfr' ? '' : 'sfr')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  selectedOperator === 'sfr'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                }`}
              >
                SFR <span className="text-[10px]">({stats?.sfr?.total ?? 0})</span>
              </button>
              <button
                onClick={() => setSelectedOperator(selectedOperator === 'all' ? '' : 'all')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  selectedOperator === 'all'
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
                }`}
              >
                Commun <span className="text-[10px]">({stats?.all.total})</span>
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                Catégorie :
              </span>
              <button
                onClick={() => setSelectedCategory('')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                  !selectedCategory ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Toutes
              </button>
              {Object.entries(data?.stats_by_category || {}).map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat} <span className="opacity-75 text-[10px]">({count})</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* View Switcher Tabs */}
        <nav className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('table')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'table'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              Tableau Détaillé
            </button>
            <button
              onClick={() => setActiveTab('grouped')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'grouped'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Box className="w-4 h-4" />
              Vue par Opérateur
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'matrix'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Matrice Synthétique
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'json'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Aperçu JSON
            </button>
          </div>

          {activeTab === 'table' && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 shadow-sm"
              title="Exporter les lignes affichées au format CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Exporter CSV
            </button>
          )}
        </nav>

        {/* TAB 1: Main Detailed Table */}
        {activeTab === 'table' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Affichage de <strong className="text-slate-900">{filteredItems.length}</strong> équipements sur{' '}
                <strong className="text-slate-900">{data?.total_count}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[680px]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 w-12 text-slate-400">#</th>
                    <th
                      onClick={() => handleSort('operator')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Opérateur
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('category')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Catégorie
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('reference')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Référence / Nom
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('vendor')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Constructeur
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('id')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Identifiant (ID)
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Spécifications & Caractéristiques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700">Aucun équipement trouvé</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Modifiez vos critères de recherche ou réinitialisez les filtres.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{renderOperatorBadge(item.operator)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium px-2 py-0.5 rounded">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.reference}</span>
                            <button
                              onClick={() => copyToClipboard(item.reference)}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                              title="Copier la référence"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.vendor ? (
                            <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded tracking-wide">
                              {item.vendor}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(item.id)}
                            className="font-mono text-xs bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                            title="Cliquer pour copier l'identifiant"
                          >
                            {item.id}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                          {item.specs || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Grouped by Operator View */}
        {activeTab === 'grouped' && (
          <div className="space-y-6">
            {(['orange', 'bouygues', 'free', 'all'] as const).map((op) => {
              const opItems = filteredItems.filter((i) => (i.operator || 'all').toLowerCase() === op);
              if (opItems.length === 0) return null;

              const opNames: Record<string, string> = {
                orange: 'Orange',
                bouygues: 'Bouygues Telecom',
                free: 'Free Mobile',
                all: 'Commun / Multiopérateur'
              };

              // Group by category
              const byCategory: Record<string, EquipmentItem[]> = {};
              opItems.forEach((it) => {
                byCategory[it.category] = byCategory[it.category] || [];
                byCategory[it.category].push(it);
              });

              return (
                <div key={op} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                    <div className="flex items-center gap-3">
                      {renderOperatorBadge(op)}
                      <h3 className="text-lg font-bold text-slate-900">{opNames[op]}</h3>
                      <span className="text-xs font-semibold text-slate-400">
                        ({opItems.length} équipements)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {Object.entries(byCategory).map(([category, items]) => (
                      <div key={category}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                          <span>{category}</span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full text-[10px]">
                            {items.length}
                          </span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items.map((it) => (
                            <div
                              key={it.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h5 className="text-sm font-bold text-slate-900">{it.reference}</h5>
                                {it.vendor && (
                                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                    {it.vendor}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-xs text-slate-500 mb-2 truncate">
                                {it.id}
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{it.specs || '-'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Matrix View */}
        {activeTab === 'matrix' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Répartition des équipements par Opérateur et par Catégorie
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse border border-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-700 font-bold text-xs uppercase">
                  <tr>
                    <th className="py-3 px-4 text-left border border-slate-200">Catégorie</th>
                    <th className="py-3 px-4 border border-slate-200 text-orange-700 bg-orange-50/50">Orange</th>
                    <th className="py-3 px-4 border border-slate-200 text-sky-700 bg-sky-50/50">Bouygues</th>
                    <th className="py-3 px-4 border border-slate-200 text-rose-700 bg-rose-50/50">Free</th>
                    <th className="py-3 px-4 border border-slate-200 text-red-700 bg-red-50/50">SFR</th>
                    <th className="py-3 px-4 border border-slate-200 text-violet-700 bg-violet-50/50">Commun</th>
                    <th className="py-3 px-4 border border-slate-200 font-extrabold text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.keys(data?.stats_by_category || {}).sort().map((cat) => {
                    const orangeCount = data?.items.filter((i) => i.category === cat && i.operator === 'orange').length || 0;
                    const bouyguesCount = data?.items.filter((i) => i.category === cat && i.operator === 'bouygues').length || 0;
                    const freeCount = data?.items.filter((i) => i.category === cat && i.operator === 'free').length || 0;
                    const sfrCount = data?.items.filter((i) => i.category === cat && i.operator === 'sfr').length || 0;
                    const allCount = data?.items.filter((i) => i.category === cat && i.operator === 'all').length || 0;
                    const total = orangeCount + bouyguesCount + freeCount + sfrCount + allCount;

                    return (
                      <tr key={cat} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-left font-semibold text-slate-800 border border-slate-200">
                          {cat}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-bold text-slate-700">
                          {orangeCount > 0 ? (
                            <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
                              {orangeCount}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-bold text-slate-700">
                          {bouyguesCount > 0 ? (
                            <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-xs">
                              {bouyguesCount}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-bold text-slate-700">
                          {freeCount > 0 ? (
                            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-xs">
                              {freeCount}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-bold text-slate-700">
                          {sfrCount > 0 ? (
                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                              {sfrCount}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-bold text-slate-700">
                          {allCount > 0 ? (
                            <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded text-xs">
                              {allCount}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 border border-slate-200 font-extrabold text-slate-900 bg-slate-50">
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-extrabold text-slate-900">
                    <td className="py-3 px-4 text-left border border-slate-200">TOTAL GÉNÉRAL</td>
                    <td className="py-3 px-4 border border-slate-200 text-orange-700">
                      {stats?.orange.total ?? 0}
                    </td>
                    <td className="py-3 px-4 border border-slate-200 text-sky-700">
                      {stats?.bouygues.total ?? 0}
                    </td>
                    <td className="py-3 px-4 border border-slate-200 text-rose-700">
                      {stats?.free.total ?? 0}
                    </td>
                    <td className="py-3 px-4 border border-slate-200 text-red-700">
                      {stats?.sfr?.total ?? 0}
                    </td>
                    <td className="py-3 px-4 border border-slate-200 text-violet-700">
                      {stats?.all.total ?? 0}
                    </td>
                    <td className="py-3 px-4 border border-slate-200 text-indigo-700 text-base">
                      {data?.total_count ?? 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: JSON Code Viewer */}
        {activeTab === 'json' && (
          <div className="bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl p-6 font-mono text-xs overflow-x-auto max-h-[650px] shadow-sm leading-relaxed">
            <pre>{JSON.stringify(data?.items, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
