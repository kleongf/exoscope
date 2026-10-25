import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/** The only way the frontend talks to the backend. Types are generated: run `pnpm gen:api`. */
export const api = createClient<paths>({ baseUrl: "/api" });

export type TurnResponse = components["schemas"]["TurnResponse"];
export type TurnRequest = components["schemas"]["TurnRequest"];
export type UiCommand = NonNullable<TurnResponse["ui_commands"]>[number];
export type System = components["schemas"]["System"];
export type Planet = System["planets"][number];
export type Quantity = Planet["radius"];
export type ToolStep = NonNullable<TurnResponse["steps"]>[number];
export type AudioInput = NonNullable<TurnRequest["audio"]>;
export type ReplyAudio = NonNullable<TurnResponse["reply_audio"]>;

export async function sendTurn(body: TurnRequest, signal: AbortSignal) {
  const { data, response } = await api.POST("/turn", { body, signal });
  if (!response.ok || !data) throw new Error("The turn could not be completed. Try typing again.");
  return data;
}
