import { create } from 'zustand';
import type { GeocodingAddress } from '../utils/types';

interface AppState {
  // Auth State
  token: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  setAuth: (token: string | null, email: string | null, isAdmin: boolean) => void;
  logout: () => void;

  // Engineer UI State
  engineerSubTab: 'map' | 'catalogue';
  setEngineerSubTab: (tab: 'map' | 'catalogue') => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showConfigPanel: boolean;
  setShowConfigPanel: (show: boolean) => void;
  regionsVisible: boolean;
  setRegionsVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;

  // Map & Analysis State
  currentAnalysisRadius: number;
  setCurrentAnalysisRadius: (radius: number) => void;
  selectedCoords: { latitude: number; longitude: number } | null;
  setSelectedCoords: (coords: { latitude: number; longitude: number } | null) => void;
  selectedAddress: GeocodingAddress | null;
  setSelectedAddress: (address: GeocodingAddress | null) => void;

  // Montage Selection State
  showMontageModal: boolean;
  setShowMontageModal: (show: boolean) => void;
  selectedCivilMontage: string | null;
  setSelectedCivilMontage: (montage: string | null) => void;
  selectedSiteType: 'nouveau' | 'existant' | null;
  setSelectedSiteType: (type: 'nouveau' | 'existant' | null) => void;
  selectedFoundationType: 'metallique' | 'beton' | 'encastre' | null;
  setSelectedFoundationType: (type: 'metallique' | 'beton' | 'encastre' | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth State
  token: localStorage.getItem('ndc_auth_token'),
  userEmail: localStorage.getItem('ndc_user_email'),
  isAdmin: localStorage.getItem('ndc_is_admin') === 'true',
  setAuth: (token, email, isAdmin) => {
    if (token) localStorage.setItem('ndc_auth_token', token);
    else localStorage.removeItem('ndc_auth_token');
    
    if (email) localStorage.setItem('ndc_user_email', email);
    else localStorage.removeItem('ndc_user_email');
    
    localStorage.setItem('ndc_is_admin', isAdmin ? 'true' : 'false');
    
    set({ token, userEmail: email, isAdmin });
  },
  logout: () => {
    localStorage.removeItem('ndc_auth_token');
    localStorage.removeItem('ndc_user_email');
    localStorage.removeItem('ndc_is_admin');
    set({ token: null, userEmail: null, isAdmin: false });
  },

  // Engineer UI State
  engineerSubTab: 'map',
  setEngineerSubTab: (tab) => set({ engineerSubTab: tab }),
  activeTab: 'details',
  setActiveTab: (tab) => set({ activeTab: tab }),
  showConfigPanel: false,
  setShowConfigPanel: (show) => set({ showConfigPanel: show }),
  regionsVisible: false,
  setRegionsVisible: (updater) => set((state) => ({ 
    regionsVisible: typeof updater === 'function' ? updater(state.regionsVisible) : updater 
  })),

  // Map & Analysis State
  currentAnalysisRadius: 0.5,
  setCurrentAnalysisRadius: (radius) => set({ currentAnalysisRadius: radius }),
  selectedCoords: null,
  setSelectedCoords: (coords) => set({ selectedCoords: coords }),
  selectedAddress: null,
  setSelectedAddress: (address) => set({ selectedAddress: address }),

  // Montage Selection State
  showMontageModal: true,
  setShowMontageModal: (show) => set({ showMontageModal: show }),
  selectedCivilMontage: null,
  setSelectedCivilMontage: (montage) => set({ selectedCivilMontage: montage }),
  selectedSiteType: null,
  setSelectedSiteType: (type) => set({ selectedSiteType: type }),
  selectedFoundationType: null,
  setSelectedFoundationType: (type) => set({ selectedFoundationType: type }),
}));
