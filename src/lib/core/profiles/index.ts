import type { BaseProfile } from "../segments.js";
import bloomJson from "./bloom.json" with { type: "json" };
import threadrushJson from "./threadrush.json" with { type: "json" };
import fanvaultJson from "./fanvault.json" with { type: "json" };
import glowlabJson from "./glowlab.json" with { type: "json" };
import edgecraftJson from "./edgecraft.json" with { type: "json" };
import slumbercoJson from "./slumberco.json" with { type: "json" };

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
