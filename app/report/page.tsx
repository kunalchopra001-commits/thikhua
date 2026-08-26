import { ReportFlow } from "./report-flow";
import { ReportProvider } from "./report-context";

export default function ReportPage() {
  return (
    <ReportProvider>
      <ReportFlow />
    </ReportProvider>
  );
}
