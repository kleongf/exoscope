import { FileText } from "lucide-react";
import { useExoStore } from "@/store/store";
import type { Project } from "@/api/client";
import { ExplorerSection } from "./ExplorerSection";

const NONE: NonNullable<Project["reports"]> = [];

/** The Project's Reports, newest last. Opening one in a new tab arrives with Report export (#11). */
export function ReportList() {
  const reports = useExoStore((s) => s.project?.reports ?? NONE);
  return (
    <ExplorerSection title="Reports" count={reports.length} empty="None yet">
      {reports.map((report) => (
        <div
          key={report.id}
          className="flex items-start gap-2 px-2 py-1.5 text-xs"
          data-testid="report-item"
        >
          <FileText className="mt-0.5 size-3.5 shrink-0" />
          {report.title}
        </div>
      ))}
    </ExplorerSection>
  );
}
