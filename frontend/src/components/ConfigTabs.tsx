// ConfigTabs component

import type { ConfigTabsProps } from '../utils/types';
import DetailsTab from './DetailsTab';
import RulesTab from './RulesTab';
import ProcessTab from './ProcessTab';
import TestingTab from './TestingTab';
import ConfigTab from './ConfigTab';

export default function ConfigTabs({
  activeTab,
  onTabChange,
  classificationResult,
  config,
  currentAnalysisRadius,
  onRadiusChange,
}: ConfigTabsProps) {
  const tabs = [
    { id: 'details', label: 'Détails' },
    { id: 'rules', label: 'Règles' },
    { id: 'process', label: 'Processus' },
    { id: 'testing', label: 'Tests' },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div className="config-tabs">
      <div className="config-tabs flex bg-gray-50 border-b border-gray-200 sticky top-[70px] z-[1002]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`config-tab flex-1 p-3 text-center cursor-pointer border-none bg-transparent transition-all font-medium ${
              activeTab === tab.id
                ? 'bg-white border-b-3 border-primary text-primary'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="config-content p-6">
        {activeTab === 'details' && (
          <DetailsTab classificationResult={classificationResult} />
        )}
        {activeTab === 'rules' && (
          <RulesTab classificationResult={classificationResult} config={config} />
        )}
        {activeTab === 'process' && (
          <ProcessTab classificationResult={classificationResult} />
        )}
        {activeTab === 'testing' && (
          <TestingTab
            classificationResult={classificationResult}
            currentAnalysisRadius={currentAnalysisRadius}
            onRadiusChange={onRadiusChange}
          />
        )}
        {activeTab === 'config' && (
          <ConfigTab config={config} />
        )}
      </div>
    </div>
  );
}
