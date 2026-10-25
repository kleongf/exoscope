import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TurnVariants } from "./features/turn/PROTOTYPE-TurnVariants";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
// PROTOTYPE (prototype/turn-ui): in dev, the workbench route shows the turn variants.
// `?variant=off` shows the real workbench.
const showPrototype =
  !import.meta.env.PROD && new URLSearchParams(window.location.search).get("variant") !== "off";
createRoot(root).render(<StrictMode>{showPrototype ? <TurnVariants /> : <App />}</StrictMode>);
