import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportUrl, type Project } from "@/api/client";
import { useExoStore } from "@/store/store";
import { ExplorerSection } from "@/features/project/ExplorerSection";
import { ReportComposer } from "./ReportComposer";
function ReportLink({ report }: { report: NonNullable<Project["reports"]>[number] }) {
  return (
    <div className="space-y-1" data-testid="report-item">
      <Button
        asChild
        variant="ghost"
        className="h-auto w-full justify-start whitespace-normal text-left text-xs"
      >
        <a
          href={reportUrl(report.file)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open Report ${report.title}`}
        >
          <FileText className="size-3 shrink-0" />
          {report.title}
        </a>
      </Button>
      <a
        href={reportUrl(report.file, true)}
        download
        className="px-2 text-xs text-muted-foreground underline"
        aria-label={`Download Report ${report.title}`}
      >
        Download HTML
      </a>
    </div>
  );
}
export function ReportsSection() {
  const project = useExoStore((s) => s.project);
  const error = useExoStore((s) => s.reportError);
  const reports = project?.reports ?? [];
  return (
    <div aria-label="Project Reports">
      <ExplorerSection
        title="Reports"
        count={reports.length}
        empty="None yet"
        footer={
          <>
            <ReportComposer key={project?.id ?? "none"} />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </>
        }
      >
        {reports.length ? (
          reports.map((report) => <ReportLink key={report.id} report={report} />)
        ) : (
          <p className="px-1 text-xs text-muted-foreground">None yet</p>
        )}
      </ExplorerSection>
    </div>
  );
}
