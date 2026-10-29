import React from 'react';
import { Radio, Server, Activity } from 'lucide-react';
import { EquipmentConfig } from '../../../config/equipmentConfig';
import { EquipmentPreviewCard } from '../../ui/EquipmentPreviewCard';

export interface EquipmentPreviewRendererProps {
  config: EquipmentConfig;
  operator?: string;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
}

export function renderEquipmentPreviewCard({
  config,
  operator = 'bouygues',
  nombreSecteurs = 1,
  equipmentValues = {}
}: EquipmentPreviewRendererProps): React.ReactNode {
  const IconComponent = config.icon === 'Radio' ? Radio : config.icon === 'Server' ? Server : Activity;

  // 1. Faisceau Hertzien (FH)
  if (config.id === 'fh') {
    const fhVal = equipmentValues.fh || {};
    const qVal = fhVal.quantité || 1;
    const ref = fhVal.référence || 'N/A';
    const vendor = fhVal.marque;
    let model = ref;
    if (vendor && model.startsWith(vendor)) {
      model = model.substring(vendor.length).trim();
    }

    return (
      <EquipmentPreviewCard
        key={config.id}
        title={config.name || 'Faisceau Hertzien (FH)'}
        icon={IconComponent}
        color="amber"
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-amber-50',
          textCol: 'text-amber-700',
          border: 'border-amber-200'
        }}
        quantityInfo={{
          label: `x${qVal}`,
          total: qVal
        }}
        marque={vendor}
        modele={model}
      />
    );
  }

  // 2. RRH
  if (config.id === 'rrh') {
    if (operator === 'bouygues') return null;
    if (equipmentValues.rrhItems && Array.isArray(equipmentValues.rrhItems)) {
      return equipmentValues.rrhItems.map((item: any, index: number) => {
        const qty = item.quantity || 1;
        const totalQty = qty * (nombreSecteurs || 1);
        const typeName = 'RRH';
        const vendor = item.vendor;
        const model = vendor && item.reference && item.reference.startsWith(vendor)
          ? item.reference.substring(vendor.length).trim()
          : item.reference;

        return (
          <EquipmentPreviewCard
            key={`${config.id}-${index}`}
            title={typeName}
            icon={IconComponent}
            color="rose"
            typeBadge={{
              text: typeName,
              bg: 'bg-rose-50',
              textCol: 'text-rose-700',
              border: 'border-rose-200'
            }}
            scopeBadge={{
              text: 'Par secteur',
              bg: 'bg-violet-50',
              textCol: 'text-violet-700',
              border: 'border-violet-200'
            }}
            quantityInfo={{
              perSector: qty,
              total: totalQty
            }}
            marque={vendor}
            modele={model || 'N/A'}
          />
        );
      });
    }
  }

  // 3. RRU / RF NSN
  if (config.id === 'rru' && equipmentValues.rruItems && Array.isArray(equipmentValues.rruItems)) {
    return equipmentValues.rruItems.map((item: any, index: number) => {
      const qty = item.quantity || 1;
      const totalQty = qty * (nombreSecteurs || 1);
      const typeName = operator === 'free' ? 'RF NSN' : 'RRU';
      const vendor = item.vendor;
      const model = vendor && item.reference && item.reference.startsWith(vendor)
        ? item.reference.substring(vendor.length).trim()
        : item.reference;

      return (
        <EquipmentPreviewCard
          key={`${config.id}-${index}`}
          title={typeName}
          icon={IconComponent}
          color="emerald"
          typeBadge={{
            text: typeName,
            bg: 'bg-emerald-50',
            textCol: 'text-emerald-700',
            border: 'border-emerald-200'
          }}
          scopeBadge={{
            text: 'Par secteur',
            bg: 'bg-violet-50',
            textCol: 'text-violet-700',
            border: 'border-violet-200'
          }}
          quantityInfo={{
            perSector: qty,
            total: totalQty
          }}
          marque={vendor}
          modele={model || 'N/A'}
        />
      );
    });
  }

  // 4. Coffrets fibre
  if (config.id === 'coffrets_fibre') {
    const coffretVal = equipmentValues.coffrets_fibre || {};
    const totalQty = nombreSecteurs || 1;
    return (
      <EquipmentPreviewCard
        key={config.id}
        title={config.name || 'Coffrets fibre'}
        icon={IconComponent}
        color="emerald"
        scopeBadge={{
          text: 'Par secteur',
          bg: 'bg-violet-50',
          textCol: 'text-violet-700',
          border: 'border-violet-200'
        }}
        quantityInfo={{
          perSector: 1,
          total: totalQty
        }}
        modele={coffretVal.référence || 'Standard'}
      />
    );
  }

  // 5. Baies radio & énergie
  if (config.id === 'baie') {
    const items = equipmentValues.baie?.items;
    if (Array.isArray(items) && items.length > 0) {
      return items.map((item: any, index: number) => {
        const qty = item.quantity || 1;
        const isRadio = item.category === 'radio' || item.category === 'radio_trans';
        const cardTitle = isRadio ? 'Baie radio' : 'Baie énergie';
        const modelOrRef = item.reference || item.name || 'N/A';

        return (
          <EquipmentPreviewCard
            key={`${config.id}-${index}`}
            title={cardTitle}
            icon={IconComponent}
            color="orange"
            typeBadge={{
              text: item.category_label || (isRadio ? 'Radio & Trans' : 'Énergie'),
              bg: 'bg-orange-50',
              textCol: 'text-orange-700',
              border: 'border-orange-200'
            }}
            scopeBadge={{
              text: '1x par site',
              bg: 'bg-orange-50',
              textCol: 'text-orange-700',
              border: 'border-orange-200'
            }}
            quantityInfo={{
              label: `x${qty}`,
              total: qty
            }}
            modele={modelOrRef}
          />
        );
      });
    }

    const types = [];
    if (equipmentValues.baie?.baieRadio) types.push('Baie radio');
    if (equipmentValues.baie?.baieEnergie) types.push('Baie énergie');
    return (
      <EquipmentPreviewCard
        key={config.id}
        title={config.name}
        icon={IconComponent}
        color="orange"
        modele={types.join(', ') || 'Sélectionnée'}
      />
    );
  }

  // 6. TD
  if (config.id === 'td') {
    const tdVal = equipmentValues.td || {};
    const typeLabel = tdVal.type || 'TD Tétraphasé';
    const refLabel = tdVal.référence || 'N/A';

    return (
      <EquipmentPreviewCard
        key={config.id}
        title={config.name || 'Équipement TD'}
        icon={IconComponent}
        color="amber"
        typeBadge={{
          text: typeLabel,
          bg: 'bg-amber-50',
          textCol: 'text-amber-700',
          border: 'border-amber-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-amber-50',
          textCol: 'text-amber-700',
          border: 'border-amber-200'
        }}
        quantityInfo={{
          label: 'x1',
          total: 1
        }}
        modele={refLabel}
      />
    );
  }

  // 7. GPS
  if (config.id === 'gps') {
    const gpsVal = equipmentValues.gps || {};
    const marque = gpsVal.marque && gpsVal.marque !== 'N/A' ? gpsVal.marque : undefined;
    const modele = gpsVal.référence || 'N/A';

    return (
      <EquipmentPreviewCard
        key={config.id}
        title="GPS"
        icon={IconComponent}
        color="blue"
        typeBadge={{
          text: 'GPS',
          bg: 'bg-blue-50',
          textCol: 'text-blue-700',
          border: 'border-blue-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-blue-50',
          textCol: 'text-blue-700',
          border: 'border-blue-200'
        }}
        quantityInfo={{
          label: 'x1',
          total: 1
        }}
        marque={marque}
        modele={modele}
      />
    );
  }

  // 8. Boîtier lovage
  if (config.id === 'boitier_lovage') {
    const lovageVal = equipmentValues.boitier_lovage || {};
    const qVal = lovageVal.quantité || 1;
    const modele = lovageVal.référence || 'N/A';

    return (
      <EquipmentPreviewCard
        key={config.id}
        title={config.name || 'Boîtier de lovage'}
        icon={IconComponent}
        color="purple"
        typeBadge={{
          text: 'Lovage',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        quantityInfo={{
          label: `x${qVal}`,
          total: qVal
        }}
        modele={modele}
      />
    );
  }

  // 9. CAB
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

    return (
      <EquipmentPreviewCard
        key={config.id}
        title="Baie CAB"
        icon={IconComponent}
        color="rose"
        typeBadge={{
          text: 'Baie CAB',
          bg: 'bg-rose-50',
          textCol: 'text-rose-700',
          border: 'border-rose-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-rose-50',
          textCol: 'text-rose-700',
          border: 'border-rose-200'
        }}
        quantityInfo={{
          label: 'x1',
          total: 1
        }}
        modele={types.join(', ') || 'Sélectionnée'}
        extraSpecs={{ support: supportLabel }}
      />
    );
  }

  // 10. Atelier d'énergie / BCube
  if (config.id === 'atelier_energie') {
    if (operator === 'bouygues') {
      const bcube = equipmentValues.atelier_energie?.bcube;
      return (
        <EquipmentPreviewCard
          key={config.id}
          title="BCube (TD + AE)"
          icon={IconComponent}
          color="amber"
          typeBadge={{
            text: 'BCube',
            bg: 'bg-amber-50',
            textCol: 'text-amber-700',
            border: 'border-amber-200'
          }}
          scopeBadge={{
            text: '1x par site',
            bg: 'bg-amber-50',
            textCol: 'text-amber-700',
            border: 'border-amber-200'
          }}
          quantityInfo={{
            label: 'x1',
            total: 1
          }}
          marque={bcube?.supplier || undefined}
          modele={bcube?.name || 'BCube (TD + AE)'}
          extraSpecs={[bcube?.power, bcube?.phase].filter(Boolean).length > 0 ? {
            puissance: [bcube?.power, bcube?.phase].filter(Boolean).join(' ')
          } : undefined}
        />
      );
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

    return (
      <EquipmentPreviewCard
        key={config.id}
        title="Atelier d'énergie"
        icon={IconComponent}
        color="amber"
        typeBadge={{
          text: 'Énergie',
          bg: 'bg-amber-50',
          textCol: 'text-amber-700',
          border: 'border-amber-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-amber-50',
          textCol: 'text-amber-700',
          border: 'border-amber-200'
        }}
        quantityInfo={{
          label: 'x1',
          total: 1
        }}
        modele={modules.join(', ') || 'Sélectionné'}
      />
    );
  }

  // 11. Convertisseur MDEA
  if (config.id === 'convertisseur_mdea') {
    const mdea = equipmentValues.convertisseur_mdea;
    const qty = mdea?.quantité || 1;
    return (
      <EquipmentPreviewCard
        key={config.id}
        title="Convertisseur MDEA"
        icon={IconComponent}
        color="purple"
        typeBadge={{
          text: 'MDEA',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        scopeBadge={{
          text: '1x par site',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        quantityInfo={{
          label: `x${qty}`,
          total: qty
        }}
        modele="MDEA"
      />
    );
  }

  // 12. TGBT (Bouygues)
  if (config.id === 'tgbt') {
    const tgbtVal = equipmentValues.tgbt || {};
    return (
      <EquipmentPreviewCard
        key={config.id}
        title="TGBT"
        icon={IconComponent}
        color="purple"
        typeBadge={{
          text: 'TGBT',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        scopeBadge={{
          text: 'Bouygues',
          bg: 'bg-purple-50',
          textCol: 'text-purple-700',
          border: 'border-purple-200'
        }}
        quantityInfo={{
          label: 'x1',
          total: 1
        }}
        modele={tgbtVal.modèle || 'TGBT ACTIA'}
        extraSpecs={{
          Dimensions: tgbtVal.dimensions || '500x400x230mm',
          Poids: tgbtVal.poids || '15 kg'
        }}
      />
    );
  }

  return null;
}
