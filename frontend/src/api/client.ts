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
export type Comparison = components["schemas"]["Comparison"];
export type Sample = components["schemas"]["Sample"];
export type SamplePlanet = Sample["planets"][number];
export type Interpretation = Sample["interpretations"][number];
export type WebSearchResult = NonNullable<NonNullable<TurnResponse["data"]>["web_search"]>;
export type WebSource = NonNullable<WebSearchResult["sources"]>[number];
export type ToolStep = NonNullable<TurnResponse["steps"]>[number];
export type AudioInput = NonNullable<TurnRequest["audio"]>;
export type ReplyAudio = NonNullable<TurnResponse["reply_audio"]>;
export type Project = components["schemas"]["Project"];
export type ProjectSummary = components["schemas"]["ProjectSummary"];

export async function sendTurn(body: TurnRequest, signal: AbortSignal) {
  const { data, response } = await api.POST("/turn", { body, signal });
  if (!response.ok || !data) throw new Error("The turn could not be completed. Try typing again.");
  return data;
}

/** The backend's own message (404 missing, 409 damaged), or a generic one if it sent none. */
function projectError(error: unknown, fallback: string): Error {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  return new Error(typeof detail === "string" ? detail : fallback);
}

export async function listProjects() {
  const { data, error } = await api.GET("/projects");
  if (!data) throw projectError(error, "Projects could not be listed. Is the backend running?");
  return data;
}

export async function createProject(name?: string) {
  const { data, error } = await api.POST("/projects", { body: { name: name ?? null } });
  if (!data) throw projectError(error, "A new Project could not be created.");
  return data;
}

export async function loadProject(id: string) {
  const { data, error } = await api.GET("/projects/{project_id}", {
    params: { path: { project_id: id } },
  });
  if (!data) throw projectError(error, `Project ${id} could not be opened.`);
  return data;
}
