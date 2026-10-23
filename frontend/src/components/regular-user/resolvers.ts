import { SelectedBaieItem } from './types';
import { DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';

export function createResolvers(config: any, operator: string) {
  const resolveRru = (id: string) => {
    if (operator === 'free') {
      const rfmModels = [
        { id: 'ARGA', vendor: 'NOKIA', reference: 'ARGA' },
        { id: 'ARDB', vendor: 'NOKIA', reference: 'ARDB' },
        { id: 'ARHA', vendor: 'NOKIA', reference: 'ARHA' },
        { id: 'AREA', vendor: 'NOKIA', reference: 'AREA' },
        { id: 'ARPA', vendor: 'NOKIA', reference: 'ARPA' },
      ];
      const opt = rfmModels.find(r => r.id === id);
      return opt ? `${opt.vendor} ${opt.reference}` : id;
    }
    const opt = config?.rru_references?.find((r: any) => r.id === id);
    return opt ? `${opt.vendor} ${opt.reference}` : id;
  };

  const resolveRrh = (id: string) => {
    const opt = config?.rrh_references?.find((r: any) => r.id === id);
    return opt ? `${opt.vendor} ${opt.reference}` : id;
  };

  const resolveTd = (id: string) => {
    const opt = config?.td_references?.find((r: any) => r.id === id);
    return opt ? `${opt.vendor} ${opt.name} (${opt.reference})` : id;
  };

  const resolveBaieItems = (items: SelectedBaieItem[]) => {
    const options = config?.baie_references && config.baie_references.length > 0
      ? config.baie_references
      : DEFAULT_ORANGE_BAIES;
    return items.map(item => {
      const ref = options.find((o: any) => o.id === item.referenceId);
      return {
        id: item.id,
        referenceId: item.referenceId,
        name: ref?.name || item.referenceId,
        reference: ref?.reference || '',
        category: ref?.category || '',
        category_label: ref?.category_label || '',
        dimensions: ref?.dimensions || '',
        weight: ref?.weight ?? null,
        quantity: item.quantity || 1,
        totalWeight: ref?.weight ? ref.weight * (item.quantity || 1) : null
      };
    });
  };

  return {
    resolveRru,
    resolveRrh,
    resolveTd,
    resolveBaieItems
  };
}
