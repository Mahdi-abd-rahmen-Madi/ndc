// ConfigTabs component

import type { ConfigTabsProps } from '../utils/types';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import DetailsTab from './DetailsTab';
import RulesTab from './RulesTab';
import ProcessTab from './ProcessTab';
import TestingTab from './TestingTab';
import ConfigTab from './ConfigTab';

export default function ConfigTabs({
  classificationResult,
  config,
}: Omit<ConfigTabsProps, 'activeTab' | 'onTabChange' | 'currentAnalysisRadius' | 'onRadiusChange'>) {
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const currentAnalysisRadius = useAppStore(state => state.currentAnalysisRadius);
  const setCurrentAnalysisRadius = useAppStore(state => state.setCurrentAnalysisRadius);

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
            className={cn(
              "config-tab flex-1 p-3 text-center cursor-pointer border-none bg-transparent transition-all font-medium",
              activeTab === tab.id
                ? "bg-white border-b-3 border-primary text-primary"
                : "hover:bg-gray-100 text-gray-600"
            )}
            onClick={() => setActiveTab(tab.id)}
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
            onRadiusChange={setCurrentAnalysisRadius}
          />
        )}
        {activeTab === 'config' && (
          <ConfigTab config={config} />
        )}
      </div>
    </div>
  );
}
