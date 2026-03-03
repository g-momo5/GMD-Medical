import type { FHAssessment, FHRiskClassification } from '$lib/db/types';

function getClassification(total: number): FHRiskClassification {
  if (total > 8) return 'Definita';
  if (total >= 6) return 'Probabile';
  if (total >= 3) return 'Possibile';
  return 'Improbabile';
}

function getUntreatedLdlScore(data: FHAssessment): number {
  if (data.untreatedLdlRange === '155-189') return 1;
  if (data.untreatedLdlRange === '190-249') return 3;
  if (data.untreatedLdlRange === '250-329') return 5;
  if (data.untreatedLdlRange === '>=330') return 8;
  return 0;
}

export function getDutchLipidScoreBreakdown(data: FHAssessment): {
  familyHistory: number;
  clinicalHistory: number;
  physicalExam: number;
  untreatedLdl: number;
  genetics: number;
  total: number;
  classification: FHRiskClassification;
} {
  const familyHistory = Math.max(
    data.familyHistoryOnePoint ? 1 : 0,
    data.familyHistoryTwoPoints ? 2 : 0
  );

  const clinicalHistory = Math.max(
    data.clinicalPrematureCAD ? 2 : 0,
    data.clinicalPrematureCerebralOrPeripheral ? 1 : 0
  );

  const physicalExam = Math.max(
    data.physicalTendonXanthomas ? 6 : 0,
    data.physicalCornealArcusBefore45 ? 4 : 0
  );

  const untreatedLdl = getUntreatedLdlScore(data);
  const genetics = data.geneticMutation ? 8 : 0;
  const total = familyHistory + clinicalHistory + physicalExam + untreatedLdl + genetics;

  return {
    familyHistory,
    clinicalHistory,
    physicalExam,
    untreatedLdl,
    genetics,
    total,
    classification: getClassification(total)
  };
}

export function calculateDutchLipidScore(
  data: FHAssessment
): { total: number; classification: FHRiskClassification } {
  const { total, classification } = getDutchLipidScoreBreakdown(data);

  return {
    total,
    classification
  };
}
