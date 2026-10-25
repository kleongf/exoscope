import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/** The only way the frontend talks to the backend. Types are generated: run `pnpm gen:api`. */
export const api = createClient<paths>({ baseUrl: "/api" });

export type TurnResponse = components["schemas"]["TurnResponse"];
export type UiCommand = TurnResponse["ui_commands"][number];
