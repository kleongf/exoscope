// PROTOTYPE data — copied from backend/exoscope/catalog/snapshots/trappist-1.json (Snapshot
// 2026-10-25), ω normalised mod 360. Throwaway: the real app gets this via load_system.
import type { ProtoSystem } from "./PROTOTYPE_orbits";
import data from "./PROTOTYPE_trappist1.json";

export const TRAPPIST1 = data as ProtoSystem;
