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
    ],
  },
  {
    id: 'fh',
    name: 'Faisceau Hertzien (FH)',
    enabled: false, // Controlled by toggle
    icon: 'Activity',
    color: 'amber',
    fields: [
      { label: 'Référence', value: 'N/A' },
      { label: 'Quantité', value: 1 },
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
    ],
  },
  {
    id: 'td',
    name: 'Équipement TD',
    enabled: false, // Controlled by toggle
    icon: 'Activity',
    color: 'amber',
    fields: [
      { label: 'Type', value: 'N/A' },
      { label: 'Référence', value: 'N/A' },
      { label: 'TGBT', value: 'N/A' },
    ],
  },
  {
    id: 'gps',
    name: 'GPS',
    enabled: false,
    icon: 'Activity',
    color: 'blue',
    fields: [
      { label: 'Référence', value: 'N/A' },
    ],
  },
  {
    id: 'boitier_lovage',
    name: 'Boitier de lovage',
    enabled: false,
    icon: 'Activity',
    color: 'purple',
    fields: [
      { label: 'Référence', value: 'N/A' },
    ],
  },
  {
    id: 'coffrets_fibre',
    name: 'Coffrets fibre',
    enabled: false,
    icon: 'Activity',
    color: 'pink',
    fields: [
      { label: 'Référence', value: 'N/A' },
    ],
  },
  {
    id: 'coffrets_hybride',
    name: 'Coffrets hybride',
    enabled: false,
    icon: 'Activity',
    color: 'orange',
    fields: [
      { label: 'Référence', value: 'N/A' },
      { label: 'Quantité', value: 1 },
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
