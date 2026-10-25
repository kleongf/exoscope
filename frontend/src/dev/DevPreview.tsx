import { lazy, Suspense, type ReactNode } from "react";

const PREVIEWS = {
  compare: lazy(() => import("./preview-compare").then((m) => ({ default: m.PreviewCompare }))),
};

/** The DEV preview named by `?preview=<name>`, or null when the URL names none. */
export function devPreview(search: string): ReactNode {
  const name = new URLSearchParams(search).get("preview");
  if (name === null || !(name in PREVIEWS)) return null;
  const Preview = PREVIEWS[name as keyof typeof PREVIEWS];
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
