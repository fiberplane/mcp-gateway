import { api } from "../lib/api";
import { useHandler } from "../lib/use-handler";

interface ExportButtonProps {
  serverName?: string;
  sessionId?: string;
  method?: string;
}

export function ExportButton({
  serverName,
  sessionId,
  method,
}: ExportButtonProps) {
  const handleExport = useHandler(() => {
    const url = api.getExportUrl({ serverName, sessionId, method });

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = ""; // Filename comes from Content-Disposition header
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  return (
    <button
      type="button"
      onClick={handleExport}
      style={{
        background: "#0066cc",
        color: "white",
        border: "none",
        fontWeight: 500,
      }}
    >
      Export Logs
    </button>
  );
}
