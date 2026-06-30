export interface EquipmentConfig {
  id: string;
  name: string;
  enabled: boolean;
  icon: string;
  color: string;
  fields: {
    label: string;
    value: string | number;
  }[];
}

export const equipmentConfigs: EquipmentConfig[] = [
  {
    id: '4g',
    name: 'Antenne 4G',
    enabled: false, // Temporarily disabled
    icon: 'Radio',
    color: 'blue',
    fields: [
      { label: 'Modèle', value: 'A1' },
      { label: 'Dimensions', value: '2100×470×210 mm' },
      { label: 'Poids', value: '45 daN' },
    ],
  },
  {
    id: '5g',
    name: 'Antenne 5G',
    enabled: false, // Temporarily disabled
    icon: 'Radio',
    color: 'purple',
    fields: [
      { label: 'Modèle', value: 'A1' },
      { label: 'Dimensions', value: '1010×500×250 mm' },
      { label: 'Poids', value: '50 daN' },
    ],
  },
  {
    id: 'fh',
    name: 'Faisceau Hertzien (FH)',
    enabled: false, // Controlled by toggle
    icon: 'Activity',
    color: 'amber',
    fields: [
      { label: 'Poids', value: '30 kg' },
      { label: 'Référence', value: 'N/A' },
    ],
  },
  {
    id: 'rru',
    name: 'RRU',
    enabled: false, // Controlled by toggle
    icon: 'Activity',
    color: 'emerald',
    fields: [
      { label: 'Modèle', value: 'RRU-001' },
      { label: 'Dimensions', value: '500×300×200 mm' },
      { label: 'Poids', value: '15 kg' },
      { label: 'Puissance', value: '100 W' },
    ],
  },
  {
    id: 'rrh',
    name: 'RRH',
    enabled: false, // Controlled by toggle
    icon: 'Activity',
    color: 'rose',
    fields: [
      { label: 'Modèle', value: 'RRH-001' },
      { label: 'Dimensions', value: '600×400×250 mm' },
      { label: 'Poids', value: '20 kg' },
      { label: 'Puissance', value: '150 W' },
    ],
  },
];

export const getEnabledConfigs = (enabledToggles?: Record<string, boolean>): EquipmentConfig[] => {
  return equipmentConfigs.filter(config => {
    // If toggle is provided, use it; otherwise use the config's enabled flag
    if (enabledToggles && config.id in enabledToggles) {
      return enabledToggles[config.id];
    }
    return config.enabled;
  });
};
