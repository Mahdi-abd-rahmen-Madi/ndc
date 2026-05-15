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
        <p>No classification result available</p>
        <p className="text-sm mt-2">Click on the map to analyze terrain</p>
      </div>
    );
  }

  // Generate process steps based on the classification result
  const processSteps = [
    {
      number: 1,
      title: 'Spatial Analysis',
      description: 'Analyze spatial composition within analysis radius',
      status: 'completed' as const,
      details: `Detected ${classificationResult.detected_clc_codes.length} CLC codes`,
      result: {
        type: 'success' as const,
        text: 'Analysis complete',
      },
    },
    {
      number: 2,
      title: 'Rule Evaluation',
      description: 'Evaluate classification rules based on spatial data',
      status: 'completed' as const,
      details: `${classificationResult.applicable_rules.length} rules applied`,
      result: {
        type: 'success' as const,
        text: 'Rules evaluated',
      },
    },
    {
      number: 3,
      title: 'Terrain Classification',
      description: 'Determine final terrain type based on rule priorities',
      status: 'completed' as const,
      details: `Classified as ${classificationResult.terrain_type}`,
      result: {
        type: 'success' as const,
        text: 'Classification complete',
      },
    },
  ];

  // Generate decision branches based on applicable rules
  const decisionBranches = classificationResult.applicable_rules.map(rule => ({
    condition: rule.name,
    result: true,
    explanation: `Rule with priority ${rule.priority} was applied`,
  }));

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Classification Process</h2>
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
          <div className="decision-tree-title font-semibold text-gray-800 mb-3">Decision Tree</div>
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
