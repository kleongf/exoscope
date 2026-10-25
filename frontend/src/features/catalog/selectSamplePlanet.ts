import { projectTurnController } from "@/features/voice/turnController";
import { useExoStore } from "@/store/store";

/**
 * Select a Sample planet. A System already in the Project switches instantly; any other is
 * opened through a normal turn ("Open <hostname>") so the live load shows in the chat, then
 * the planet is selected once that System is actually in view.
 */
export async function selectSamplePlanet(hostname: string, planet: string) {
  const state = useExoStore.getState();
  const known =
    state.system?.hostname === hostname ||
    state.loadedSystems.some((system) => system.hostname === hostname);
  if (known) {
    state.selectPlanetIn(hostname, planet);
    return;
  }
  await projectTurnController.submit({ text: `Open ${hostname}` });
  const after = useExoStore.getState();
  if (after.system?.hostname === hostname) after.selectPlanet(planet);
}
