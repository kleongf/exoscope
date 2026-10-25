import { sendTurn, type TurnRequest } from "../../api/client";
import { projectController } from "../project/persistence";
import { useExoStore } from "../../store/store";

async function flushCurrentProject() {
  if (useExoStore.getState().currentProject) await projectController.flush();
}

export class TurnController {
  private request: AbortController | undefined;
  async submit(input: TurnRequest) {
    if (this.request) return;
    const request = new AbortController();
    this.request = request;
    if (!(await this.prepare(request))) return;
    const state = useExoStore.getState();
    state.beginTurn(input.text ?? "");
    const timer = setTimeout(() => {
      request.abort();
    }, 90_000);
    try {
      const response = await sendTurn(
        { ...input, current_system: state.system?.hostname ?? null },
        request.signal,
      );
      if (this.request === request) {
        useExoStore.getState().acceptTurn(response);
        await flushCurrentProject();
      }
    } catch {
      if (this.request === request)
        useExoStore
          .getState()
          .fail("The turn could not be completed. Please try again or type your question.");
    } finally {
      clearTimeout(timer);
      if (this.request === request) this.request = undefined;
    }
  }
  private async prepare(request: AbortController) {
    await projectController.ready;
    if (this.request !== request) return false;
    if (!useExoStore.getState().currentProject) {
      useExoStore
        .getState()
        .fail("Open a Project before asking a question. Your saved work could not be restored.");
      this.request = undefined;
      return false;
    }
    useExoStore.getState().setStatus("processing");
    await flushCurrentProject();
    return this.request === request;
  }
  dispose() {
    const request = this.request;
    this.request = undefined;
    request?.abort();
    useExoStore.getState().setStatus("idle");
  }
}

/** One in-flight turn is shared by chat and Project explorer actions. */
export const projectTurnController = new TurnController();
