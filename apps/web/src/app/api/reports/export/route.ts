import { requireUser } from "@/server/auth";
import { apiRoute, getSearchParams } from "@/server/http";
import { reportService } from "@/server/services/reportService";
import { renderReportPdf, renderReportXlsx } from "@/server/services/reportExport";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => {
  const params = getSearchParams(request);
  const format = params.get("format") === "xlsx" ? "xlsx" : "pdf";
  const query = Object.fromEntries(params);
  delete query.format;

  const report = await reportService.buildReport(await requireUser(request), query);
  const fileName = `relatorio-${report.from}-a-${report.to}.${format}`;
  const body = format === "xlsx" ? await renderReportXlsx(report) : await renderReportPdf(report);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
});
