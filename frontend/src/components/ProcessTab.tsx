// ProcessTab component

import type { TerrainClassificationResponse } from '../utils/types';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ProcessTabProps {
  classificationResult: TerrainClassificationResponse | null;
}

export default function ProcessTab({ classificationResult }: ProcessTabProps) {
  if (!classificationResult) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>Aucun résultat de classification disponible</p>
        <p className="text-sm mt-2">Cliquez sur la carte pour analyser le terrain</p>
      </div>
    );
  }

  // Generate process steps based on the classification result
  const processSteps = [
    {
      number: 1,
      title: 'Analyse spatiale',
      description: 'Analyse de la composition spatiale dans le rayon d\'analyse',
      status: 'completed' as const,
      details: `${classificationResult.detected_clc_codes.length} codes CLC détectés`,
      result: {
        type: 'success' as 'success' | 'failure' | 'info',
        text: 'Analyse terminée',
      },
    },
    {
      number: 2,
      title: 'Évaluation des règles',
      description: 'Évaluation des règles de classification basées sur les données spatiales',
      status: 'completed' as const,
      details: `${classificationResult.applicable_rules.length} règles appliquées`,
      result: {
        type: 'success' as 'success' | 'failure' | 'info',
        text: 'Règles évaluées',
      },
    },
    {
      number: 3,
      title: 'Classification du terrain',
      description: 'Détermination du type de terrain final basé sur les priorités des règles',
      status: 'completed' as const,
      details: `Classé comme ${classificationResult.terrain_type}`,
      result: {
        type: 'success' as 'success' | 'failure' | 'info',
        text: 'Classification terminée',
      },
    },
  ];

  // Generate decision branches based on applicable rules
  const decisionBranches = classificationResult.applicable_rules.map(rule => ({
    condition: rule.name,
    result: true,
    explanation: `La règle avec la priorité ${rule.priority} a été appliquée`,
  }));

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Processus de classification</h2>
      </div>

      <div className="process-flow flex flex-col gap-4">
        {processSteps.map(step => (
          <div
            key={step.number}
            className={`process-step flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 shadow-sm transition-all ${
              step.status === 'completed'
                ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100'
                : step.status === 'current'
                ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100 animate-currentStepPulse'
                : step.status === 'skipped'
                ? 'border-gray-400 opacity-60'
                : 'border-primary'
            }`}
          >
            <div
              className={`step-number w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                step.status === 'completed'
                  ? 'bg-green-500 text-white'
                  : step.status === 'current'
                  ? 'bg-yellow-500 text-gray-900'
                  : step.status === 'skipped'
                  ? 'bg-gray-400 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step.number}
            </div>
            <div className="step-content flex-1">
              <div className="step-title font-semibold text-gray-800 mb-1 flex items-center gap-2">
                {step.title}
              </div>
              <div className="step-description text-sm text-gray-600 mb-2">{step.description}</div>
              {step.details && (
                <div className="step-details text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                  {step.details}
                </div>
              )}
              {step.result && (
                <div
                  className={`step-result inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-2 ${
                    step.result.type === 'success'
                      ? 'bg-green-100 text-green-800'
                      : step.result.type === 'failure'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {step.result.type === 'success' && <CheckCircle className="w-3 h-3" />}
                  {step.result.type === 'failure' && <XCircle className="w-3 h-3" />}
                  {step.result.type === 'info' && <AlertCircle className="w-3 h-3" />}
                  {step.result.text}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {decisionBranches.length > 0 && (
        <div className="decision-tree mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="decision-tree-title font-semibold text-gray-800 mb-3">Arbre de décision</div>
          {decisionBranches.map((branch, index) => (
            <div
              key={index}
              className={`decision-branch flex items-center gap-2 p-2 mb-1 rounded text-sm ${
                branch.result
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-medium">{branch.condition}</span>
              <span className="ml-auto">{branch.result ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
