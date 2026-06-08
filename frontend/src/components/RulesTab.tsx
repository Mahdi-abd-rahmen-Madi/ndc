// RulesTab component

import type { TerrainClassificationResponse, TerrainConfig } from '../utils/types';
import { formatRuleExplanation } from '../utils/formatters';

interface RulesTabProps {
  classificationResult: TerrainClassificationResponse | null;
  config: TerrainConfig | null;
}

export default function RulesTab({ classificationResult, config }: RulesTabProps) {
  if (!classificationResult) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>Aucun résultat de classification disponible</p>
        <p className="text-sm mt-2">Cliquez sur la carte pour analyser le terrain</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>Chargement de la configuration...</p>
      </div>
    );
  }

  const rules = config.classification_rules;
  const applicableRuleNames = new Set(classificationResult.applicable_rules.map(r => r.name));

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Règles de classification</h2>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Toutes les règles
        </h3>

        {Object.entries(rules).map(([ruleKey, rule]) => {
          const isApplied = applicableRuleNames.has(ruleKey);
          const explanation = classificationResult.rule_explanations[ruleKey];

          return (
            <div
              key={ruleKey}
              className={`rule-visual flex items-center gap-4 p-4 mb-3 bg-white rounded-lg border-l-4 shadow-sm transition-all ${
                isApplied
                  ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100'
                  : 'border-gray-300 opacity-60'
              }`}
            >
              <div className="rule-priority bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {rule.priority}
              </div>
              <div className="rule-details flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rule-name font-bold text-gray-800">{ruleKey.replace(/_/g, ' ')}</div>
                  <div
                    className={`rule-application-status inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isApplied
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isApplied ? 'Appliquée' : 'Non appliquée'}
                  </div>
                </div>
                <div className="rule-description text-sm text-gray-600 mb-2">{rule.description}</div>
                
                {rule.enabled && (
                  <div className="rule-conditions text-xs text-gray-500 mt-2 leading-relaxed">
                    <div className="font-medium mb-1">Conditions :</div>
                    {Object.entries(rule.conditions).map(([key, value]) => (
                      <div key={key} className="rule-condition-item flex justify-between items-center py-0.5 border-b border-gray-100 last:border-0">
                        <span className="rule-condition-label font-medium text-gray-600">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="rule-condition-value font-semibold text-primary">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {explanation && (
                  <div className="rule-explanation text-xs text-gray-600 italic mt-2 p-2 bg-gray-50 rounded">
                    {formatRuleExplanation(explanation)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
