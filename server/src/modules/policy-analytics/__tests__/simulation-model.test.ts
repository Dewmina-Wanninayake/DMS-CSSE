import { describe, expect, it } from 'vitest';
import { RiskLevel } from '@dms/shared';
import {
  RuleBasedSimulationModel,
  type SimulationDistrictInput,
  type SimulationProfile,
} from '../domain/simulation-model';

const profile: SimulationProfile = {
  footprintRatio: 0.2,
  evacuationRatePerTeamHour: 150,
  waterLitresPerPersonDay: 15,
  foodKgPerPersonDay: 0.6,
  medicineKitsPer100People: 5,
  planningDays: 3,
  avgShelterCapacity: 400,
};

const district = (overrides: Partial<SimulationDistrictInput> = {}): SimulationDistrictInput => ({
  districtId: 1,
  name: 'Kegalle',
  riskLevel: RiskLevel.High,
  latitude: 7.25,
  longitude: 80.35,
  population: 100_000,
  areaKm2: 1_000,
  ...overrides,
});

const model = new RuleBasedSimulationModel();
const input = { intensity: 5, teamsDeployed: 10, sheltersActivated: 20 };

describe('RuleBasedSimulationModel (assumption A4)', () => {
  it('should compute exposure, area and evacuation time from the stated formulas', () => {
    // exposure = 5/10 × 1.0 × 0.2 = 0.1
    const { districts, totals } = model.run([district()], profile, input);
    expect(districts[0]).toMatchObject({
      affectedAreaKm2: 100,
      exposedPopulation: 10_000,
      evacuationHours: 6.7, // 10 000 / (10 × 150)
      radiusKm: 5.6, // sqrt(100/π)
    });
    expect(totals).toEqual({
      exposedPopulation: 10_000,
      affectedAreaKm2: 100,
      evacuationHours: 6.7,
      shelterCoverage: 0.8, // 20 × 400 / 10 000
      waterLitres: 450_000,
      foodKg: 18_000,
      medicineKits: 500,
    });
  });

  it('should weight lower risk levels less than High', () => {
    const [high, medium, low] = model.run(
      [
        district({ riskLevel: RiskLevel.High }),
        district({ districtId: 2, riskLevel: RiskLevel.Medium }),
        district({ districtId: 3, riskLevel: RiskLevel.Low }),
      ],
      profile,
      input,
    ).districts;
    expect(high?.exposedPopulation).toBe(10_000);
    expect(medium?.exposedPopulation).toBe(6_000);
    expect(low?.exposedPopulation).toBe(3_000);
  });

  it('should scale linearly with intensity', () => {
    const low = model.run([district()], profile, { ...input, intensity: 1 }).totals;
    const max = model.run([district()], profile, { ...input, intensity: 10 }).totals;
    expect(max.exposedPopulation).toBe(low.exposedPopulation * 10);
  });

  it('should shorten evacuation when more teams are deployed', () => {
    const few = model.run([district()], profile, { ...input, teamsDeployed: 5 }).totals;
    const many = model.run([district()], profile, { ...input, teamsDeployed: 20 }).totals;
    expect(few.evacuationHours).toBeGreaterThan(many.evacuationHours);
  });

  it('should report full shelter coverage when nobody is exposed', () => {
    const empty = model.run([district({ population: 0 })], profile, input).totals;
    expect(empty).toMatchObject({ exposedPopulation: 0, shelterCoverage: 1, evacuationHours: 0 });
  });

  it('should return empty totals for no districts', () => {
    expect(model.run([], profile, input).totals.exposedPopulation).toBe(0);
  });

  it('should be deterministic', () => {
    expect(model.run([district()], profile, input)).toEqual(
      model.run([district()], profile, input),
    );
  });
});
