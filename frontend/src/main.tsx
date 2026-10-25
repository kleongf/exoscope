import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

function render(node: ReactNode) {
  createRoot(root as HTMLElement).render(<StrictMode>{node}</StrictMode>);
}

// DEV-only feature previews (?preview=<name>). The branch, and the preview code it imports,
// is removed from production builds.
if (import.meta.env.DEV && location.search.includes("preview=")) {
  void import("./dev/DevPreview").then((m) => {
    render(m.devPreview(location.search) ?? <App />);
  });
} else {
  render(<App />);
}
