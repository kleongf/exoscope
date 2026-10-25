import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

function render(node: ReactNode) {
  createRoot(root as HTMLElement).render(<StrictMode>{node}</StrictMode>);
}

// Dev-only component previews (e.g. /?preview=orbits); dynamic import keeps them out of builds.
if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "orbits"
) {
  void import("./dev/preview-orbits").then(({ PreviewOrbits }) => {
    render(<PreviewOrbits />);
  });
} else {
  render(<App />);
}
