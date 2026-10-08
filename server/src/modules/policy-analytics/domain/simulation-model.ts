import { RiskLevel, type SimulationRequest } from '@dms/shared';

/** How strongly each risk level scales a district's exposure (part of the model definition, A4). */
export const RISK_WEIGHT: Record<RiskLevel, number> = {
  [RiskLevel.High]: 1,
  [RiskLevel.Medium]: 0.6,
  [RiskLevel.Low]: 0.3,
};

const MAX_INTENSITY = 10;

export interface SimulationDistrictInput {
  districtId: number;
  name: string;
  riskLevel: RiskLevel;
  latitude: number;
  longitude: number;
  population: number;
  areaKm2: number;
}

export interface SimulationProfile {
  footprintRatio: number;
  evacuationRatePerTeamHour: number;
  waterLitresPerPersonDay: number;
  foodKgPerPersonDay: number;
  medicineKitsPer100People: number;
  planningDays: number;
  avgShelterCapacity: number;
}

export interface SimulationDistrictOutput {
  districtId: number;
  name: string;
  riskLevel: RiskLevel;
  latitude: number;
  longitude: number;
  affectedAreaKm2: number;
  exposedPopulation: number;
  evacuationHours: number;
  radiusKm: number;
}

export interface SimulationOutput {
  totals: {
    exposedPopulation: number;
    affectedAreaKm2: number;
    evacuationHours: number;
    shelterCoverage: number;
    waterLitres: number;
    foodKg: number;
    medicineKits: number;
  };
  districts: SimulationDistrictOutput[];
}

/** Strategy: swap the model without touching the service (e.g. a hydrological model later). */
export interface SimulationModel {
  run(
    districts: SimulationDistrictInput[],
    profile: SimulationProfile,
    input: SimulationRequest,
  ): SimulationOutput;
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Deterministic, parameterised planning model (assumption A4, critique DA #4):
 *  exposure_d      = intensity/10 × riskWeight_d × footprintRatio
 *  affectedArea_d  = area_d × exposure_d          exposedPopulation_d = population_d × exposure_d
 *  evacuationHours = exposedPopulation / (teamsDeployed × evacuationRatePerTeamHour)
 *  resources       = exposedPopulation × per-person rates × planningDays
 *  shelterCoverage = sheltersActivated × avgShelterCapacity / exposedPopulation
 * It is a planning aid, not a forecast, and the UI says so. `teamsDeployed` must be ≥ 1
 * (enforced by the request schema).
 */
export class RuleBasedSimulationModel implements SimulationModel {
  run(
    districts: SimulationDistrictInput[],
    profile: SimulationProfile,
    input: SimulationRequest,
  ): SimulationOutput {
    const teamCapacity = input.teamsDeployed * profile.evacuationRatePerTeamHour;
    const outputs = districts.map((d) => {
      const exposure =
        (input.intensity / MAX_INTENSITY) * RISK_WEIGHT[d.riskLevel] * profile.footprintRatio;
      const affectedArea = d.areaKm2 * exposure;
      const exposed = Math.round(d.population * exposure);
      return {
        districtId: d.districtId,
        name: d.name,
        riskLevel: d.riskLevel,
        latitude: d.latitude,
        longitude: d.longitude,
        affectedAreaKm2: round(affectedArea, 1),
        exposedPopulation: exposed,
        evacuationHours: round(exposed / teamCapacity, 1),
        radiusKm: round(Math.sqrt(affectedArea / Math.PI), 1),
      };
    });

    const exposedPopulation = outputs.reduce((total, d) => total + d.exposedPopulation, 0);
    const shelterSpaces = input.sheltersActivated * profile.avgShelterCapacity;
    return {
      districts: outputs,
      totals: {
        exposedPopulation,
        affectedAreaKm2: round(
          outputs.reduce((total, d) => total + d.affectedAreaKm2, 0),
          1,
        ),
        evacuationHours: round(exposedPopulation / teamCapacity, 1),
        shelterCoverage: exposedPopulation === 0 ? 1 : round(shelterSpaces / exposedPopulation, 2),
        waterLitres: Math.round(
          exposedPopulation * profile.waterLitresPerPersonDay * profile.planningDays,
        ),
        foodKg: Math.round(exposedPopulation * profile.foodKgPerPersonDay * profile.planningDays),
        medicineKits: Math.ceil((exposedPopulation / 100) * profile.medicineKitsPer100People),
      },
    };
  }
}
