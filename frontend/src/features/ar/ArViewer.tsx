import type { ModelViewerElement } from "@google/model-viewer";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { arUnavailableReason } from "./arSupport";
import { planetGlb } from "./planetModel";

type ViewerState =
  | { kind: "building" }
  | { kind: "ready"; arSupported: boolean }
  | { kind: "failed"; message: string };

function configure(viewer: ModelViewerElement, src: string, alt: string) {
  viewer.src = src;
  viewer.alt = alt;
  viewer.ar = true;
  // Scene Viewer needs a public model URL; our model is a local blob, so it is left out.
  viewer.arModes = "webxr quick-look";
  viewer.arScale = "auto";
  viewer.cameraControls = true;
  viewer.autoRotate = true;
  viewer.className = "h-full w-full";
  viewer.style.setProperty("--poster-color", "transparent");
  // Our own button starts AR; hide model-viewer's default one.
  const slot = document.createElement("span");
  slot.slot = "ar-button";
  slot.hidden = true;
  viewer.append(slot);
}

/** Builds the planet's model and shows it in <model-viewer>, which hands off to the phone's AR. */
export function ArViewer({ color, lines }: { color: string; lines: string[] }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ModelViewerElement | null>(null);
  const [state, setState] = useState<ViewerState>({ kind: "building" });

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const fail = (message: string) => {
      if (!cancelled) setState({ kind: "failed", message });
    };
    void Promise.all([planetGlb(color, lines), import("@google/model-viewer")])
      .then(([blob]) => {
        if (cancelled || !host.current) return;
        url = URL.createObjectURL(blob);
        const element = document.createElement("model-viewer");
        configure(element, url, `Schematic model of ${lines[0] ?? "the planet"}`);
        element.addEventListener("load", () => {
          if (!cancelled) setState({ kind: "ready", arSupported: element.canActivateAR });
        });
        element.addEventListener("error", () => {
          fail("The 3D model could not be displayed.");
        });
        element.addEventListener("ar-status", (event) => {
          if ((event as CustomEvent<{ status: string }>).detail.status === "failed") {
            fail("AR could not start on this device.");
          }
        });
        host.current.replaceChildren(element);
        viewer.current = element;
      })
      .catch(() => {
        fail("The 3D model could not be built.");
      });
    return () => {
      cancelled = true;
      viewer.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [color, lines]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={host} className="h-72 rounded-md bg-[#05060a]" data-testid="ar-model" />
      <ArStatus
        state={state}
        onStart={() => {
          void viewer.current?.activateAR();
        }}
      />
    </div>
  );
}

function ArStatus({ state, onStart }: { state: ViewerState; onStart: () => void }) {
  if (state.kind === "building") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="ar-status">
        <Loader2 className="size-4 animate-spin" /> Building the model…
      </p>
    );
  }
  if (state.kind === "failed") {
    return (
      <p className="text-sm text-destructive" data-testid="ar-status">
        {state.message}
      </p>
    );
  }
  if (!state.arSupported) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="ar-status">
        {arUnavailableReason(window.isSecureContext)} You can still rotate the model here.
      </p>
    );
  }
  return (
    <Button onClick={onStart} data-testid="ar-start">
      Place it in your room
    </Button>
  );
}
