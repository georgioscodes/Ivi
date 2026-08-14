import { useMutation, useQuery } from '@tanstack/react-query';

import { request } from '@/api/http';
import type {
  ActivityLevelResponse,
  CoefficientRequirementRequest,
  EnergyRequirementRequest,
  EnergyRequirementResponse,
  MacroDistributionRequest,
  MacroDistributionResponse,
} from '@/api/types';

/**
 * The calculations are POSTs even though they read nothing and change nothing — the request is
 * too structured for a query string. They are modelled as mutations here for the same reason:
 * each one is fired deliberately when the inputs settle, not re-run whenever React re-renders.
 */
const nutrition = {
  activityLevels: () => request<ActivityLevelResponse[]>('/nutrition/activity-level'),

  energyRequirement: (body: EnergyRequirementRequest) =>
    request<EnergyRequirementResponse>('/nutrition/energy-requirement', {
      method: 'POST',
      body,
    }),

  macroDistribution: (body: MacroDistributionRequest) =>
    request<MacroDistributionResponse>('/nutrition/macro-distribution', {
      method: 'POST',
      body,
    }),

  coefficientRequirement: (body: CoefficientRequirementRequest) =>
    request<MacroDistributionResponse>('/nutrition/coefficient-requirement', {
      method: 'POST',
      body,
    }),
};

/**
 * Suggested activity factors, with their Greek labels.
 *
 * Reference data that never changes within a deployment. Note the endpoint offers *suggestions*:
 * the calculation accepts any factor between 1.0 and 3.0, and the UI must not reduce that to a
 * six-item menu — a practitioner with a reason to use 1.45 should be able to.
 */
export function useActivityLevels() {
  return useQuery({
    queryKey: ['nutrition', 'activity-level'],
    queryFn: nutrition.activityLevels,
    staleTime: Infinity,
  });
}

export function useEnergyRequirement() {
  return useMutation({ mutationFn: nutrition.energyRequirement });
}

export function useMacroDistribution() {
  return useMutation({ mutationFn: nutrition.macroDistribution });
}

export function useCoefficientRequirement() {
  return useMutation({ mutationFn: nutrition.coefficientRequirement });
}
