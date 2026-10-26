import { exportReport, type ReportRequest, type ReportSnapshot } from "@/api/client";
import { useExoStore } from "@/store/store";
async function renderedFrames() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}
export async function captureSystemView(): Promise<ReportSnapshot | undefined> {
  if (typeof document === "undefined") return;
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = useExoStore.getState().system;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="system-view"] canvas');
    if (!canvas || !system) return;
    await renderedFrames();
    if (
      useExoStore.getState().system !== system ||
      document.querySelector('[data-testid="system-view"] canvas') !== canvas
    )
      continue;
    return {
      data_url: canvas.toDataURL("image/png"),
      hostname: system.hostname,
      captured_at: new Date().toISOString(),
    };
  }
}
export async function writeReport(report: ReportRequest) {
  const state = useExoStore.getState();
  if (state.status !== "idle" || !state.project) return false;
  useExoStore.setState({ reportWriting: true, reportError: null, status: "processing" });
  try {
    const snapshot = await captureSystemView();
    const project = await exportReport(state.project.id, {
      ...report,
      ...(snapshot ? { snapshot } : {}),
    });
    useExoStore.setState({ project });
    return true;
  } catch (error) {
    useExoStore.setState({
      reportError: error instanceof Error ? error.message : "The Report could not be written.",
    });
    return false;
  } finally {
    useExoStore.setState({ reportWriting: false, status: "idle" });
  }
}
