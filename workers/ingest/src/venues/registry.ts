import type { IngestEnv } from "@/env";
import { config as bigFairConfig, run as runBigFair } from "@/venues/big-fresno-fair/run";
import { config as chaffeeConfig, run as runChaffee } from "@/venues/chaffee-zoo/run";
import { config as downtownConfig, run as runDowntown } from "@/venues/downtown-fresno/run";
import { config as conventionConfig, run as runConvention } from "@/venues/fresno-convention-center/run";
import { config as fultonConfig, run as runFulton } from "@/venues/fulton-55/run";
import { config as gobulldogsConfig, run as runGobulldogs } from "@/venues/gobulldogs/run";
import { config as milbConfig, run as runMilb } from "@/venues/milb-grizzlies/run";
import { config as rainbowConfig, run as runRainbow } from "@/venues/rainbow-ballroom/run";
import { config as saveMartConfig, run as runSaveMart } from "@/venues/save-mart/run";
import { config as strummersConfig, run as runStrummers } from "@/venues/strummers/run";
import { config as towerConfig, run as runTower } from "@/venues/tower-theatre/run";
import { config as visitConfig, run as runVisit } from "@/venues/visit-fresno-county/run";
import { venueConfigSchema, type VenueConfig, type VenueRunContext, type VenueRunResult } from "@/venues/venue.types";

type VenueModule = {
  config: VenueConfig;
  run: (env: IngestEnv, ctx: VenueRunContext) => Promise<VenueRunResult>;
};

const MODULES: VenueModule[] = [
  { config: venueConfigSchema.parse(towerConfig), run: runTower },
  { config: venueConfigSchema.parse(saveMartConfig), run: runSaveMart },
  { config: venueConfigSchema.parse(conventionConfig), run: runConvention },
  { config: venueConfigSchema.parse(chaffeeConfig), run: runChaffee },
  { config: venueConfigSchema.parse(fultonConfig), run: runFulton },
  { config: venueConfigSchema.parse(strummersConfig), run: runStrummers },
  { config: venueConfigSchema.parse(rainbowConfig), run: runRainbow },
  { config: venueConfigSchema.parse(bigFairConfig), run: runBigFair },
  { config: venueConfigSchema.parse(gobulldogsConfig), run: runGobulldogs },
  { config: venueConfigSchema.parse(visitConfig), run: runVisit },
  { config: venueConfigSchema.parse(downtownConfig), run: runDowntown },
  { config: venueConfigSchema.parse(milbConfig), run: runMilb }
];

export function allVenueConfigs(): VenueConfig[] {
  return MODULES.map((m) => m.config);
}

export function loadEnabledVenues(venueFilter?: string[]): VenueConfig[] {
  const filter = venueFilter?.map((k) => k.trim()).filter(Boolean);
  return allVenueConfigs()
    .filter((c) => c.enabled)
    .filter((c) => !filter?.length || filter.includes(c.key))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function findVenueModule(key: string): VenueModule | undefined {
  return MODULES.find((m) => m.config.key === key);
}

export async function runVenue(
  env: IngestEnv,
  config: VenueConfig,
  ctx: VenueRunContext
): Promise<VenueRunResult> {
  const mod = findVenueModule(config.key);
  if (!mod) {
    throw new Error(`No venue module registered for key: ${config.key}`);
  }
  return mod.run(env, ctx);
}

/** Fail fast if two modules share the same key. */
export function assertUniqueVenueKeys(): void {
  const keys = allVenueConfigs().map((c) => c.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) {
    throw new Error(`Duplicate venue key in registry: ${dup}`);
  }
}

assertUniqueVenueKeys();
