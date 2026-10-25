import { sendTurn, type TurnRequest } from "../../api/client";
import { useExoStore, type ExoState } from "../../store/store";

/** What the backend needs besides the question: the System on screen and the Project to save to. */
function turnContext(state: ExoState) {
  return { current_system: state.system?.hostname ?? null, project_id: state.project?.id ?? null };
}

export class TurnController {
  private request: AbortController | undefined;
  async submit(input: TurnRequest) {
    if (this.request) return;
    const request = new AbortController();
    this.request = request;
    const state = useExoStore.getState();
    state.beginTurn(input.text ?? "");
    const timer = setTimeout(() => {
      request.abort();
    }, 90_000);
    try {
      const response = await sendTurn({ ...input, ...turnContext(state) }, request.signal);
      if (this.request === request) useExoStore.getState().acceptTurn(response);
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
  dispose() {
    const request = this.request;
    this.request = undefined;
    request?.abort();
    useExoStore.getState().setStatus("idle");
  }
}

/** One in-flight turn is shared by chat and Project explorer actions. */
export const projectTurnController = new TurnController();
