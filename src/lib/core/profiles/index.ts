import type { BaseProfile } from "../segments";
import bloomJson from "./bloom.json";
import threadrushJson from "./threadrush.json";
import fanvaultJson from "./fanvault.json";
import glowlabJson from "./glowlab.json";
import edgecraftJson from "./edgecraft.json";
import slumbercoJson from "./slumberco.json";

const bloom = bloomJson as BaseProfile;
const threadrush = threadrushJson as BaseProfile;
const fanvault = fanvaultJson as BaseProfile;
const glowlab = glowlabJson as BaseProfile;
const edgecraft = edgecraftJson as BaseProfile;
const slumberco = slumbercoJson as BaseProfile;

/** Scenario base profiles keyed by scenario slug. */
export const PROFILES: Record<string, BaseProfile> = {
  bloom,
  threadrush,
  fanvault,
  glowlab,
  edgecraft,
  slumberco,
};
