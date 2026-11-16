import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import type { ReportDto } from "@dialindooh/shared";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#111827", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 16 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  meta: { flexGrow: 1, padding: 8, borderRadius: 4, backgroundColor: "#f3f4f6" },
  metaLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  metaValue: { fontSize: 11 },
  kpiRow: { flexDirection: "row", gap: 16, marginBottom: 18 },
  kpi: { flexGrow: 1, padding: 12, borderRadius: 6, border: "1pt solid #ddd6fe" },
  kpiValue: { fontSize: 22, fontWeight: 700, color: "#6d28d9" },
  kpiLabel: { fontSize: 9, color: "#4b5563" },
  tableHeader: { flexDirection: "row", borderBottom: "1pt solid #9ca3af", paddingBottom: 4, marginBottom: 4, fontWeight: 700 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  colName: { width: "50%" },
  colNum: { width: "15%", textAlign: "right" },
  colDate: { width: "20%", textAlign: "right" },
  footer: { marginTop: 12, fontWeight: 700 }
});

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function ReportDocument({ report }: { report: ReportDto }) {
  const subject = report.mediaTitle ?? report.playlistName ?? "Todas as mídias";

  return (
    <Document title={`Relatório de exibições - ${subject}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório de exibições</Text>
        <Text style={styles.subtitle}>{subject}</Text>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Período dos dados</Text>
            <Text style={styles.metaValue}>
              {formatDate(report.from)} até {formatDate(report.to)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Gerado em</Text>
            <Text style={styles.metaValue}>{formatDateTime(report.generatedAt)}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Gerado por</Text>
            <Text style={styles.metaValue}>{report.generatedBy}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{report.totalPlays.toLocaleString("pt-BR")}</Text>
            <Text style={styles.kpiLabel}>Exibições</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{report.campaignDays}</Text>
            <Text style={styles.kpiLabel}>Dias de campanha</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{formatDuration(report.totalSeconds)}</Text>
            <Text style={styles.kpiLabel}>Tempo em tela</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colName}>Terminal</Text>
          <Text style={styles.colNum}>Exibições</Text>
          <Text style={styles.colNum}>Tempo</Text>
          <Text style={styles.colDate}>Última exibição</Text>
        </View>
        {report.rows.map((row) => (
          <View key={row.screenId} style={styles.row} wrap={false}>
            <Text style={styles.colName}>{row.screenName}</Text>
            <Text style={styles.colNum}>{row.plays.toLocaleString("pt-BR")}</Text>
            <Text style={styles.colNum}>{formatDuration(row.seconds)}</Text>
            <Text style={styles.colDate}>{formatDateTime(row.lastPlayedAt)}</Text>
          </View>
        ))}
        <Text style={styles.footer}>
          Total de exibições: {report.totalPlays.toLocaleString("pt-BR")} · Terminais: {report.screenCount}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(report: ReportDto) {
  return renderToBuffer(<ReportDocument report={report} />);
}

export async function renderReportXlsx(report: ReportDto) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.generatedBy;
  workbook.created = new Date(report.generatedAt);

  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [
    { header: "Campo", key: "field", width: 28 },
    { header: "Valor", key: "value", width: 48 }
  ];
  summary.addRows([
    { field: "Conteúdo", value: report.mediaTitle ?? report.playlistName ?? "Todas as mídias" },
    { field: "Período", value: `${formatDate(report.from)} até ${formatDate(report.to)}` },
    { field: "Gerado em", value: formatDateTime(report.generatedAt) },
    { field: "Gerado por", value: report.generatedBy },
    { field: "Exibições", value: report.totalPlays },
    { field: "Dias de campanha", value: report.campaignDays },
    { field: "Tempo em tela (s)", value: report.totalSeconds },
    { field: "Terminais", value: report.screenCount }
  ]);
  summary.getRow(1).font = { bold: true };

  const byScreen = workbook.addWorksheet("Por terminal");
  byScreen.columns = [
    { header: "Terminal", key: "screenName", width: 36 },
    { header: "Exibições", key: "plays", width: 12 },
    { header: "Tempo (s)", key: "seconds", width: 12 },
    { header: "Última exibição", key: "lastPlayedAt", width: 22 }
  ];
  byScreen.addRows(report.rows.map((row) => ({ ...row, lastPlayedAt: formatDateTime(row.lastPlayedAt) })));
  byScreen.getRow(1).font = { bold: true };

  const daily = workbook.addWorksheet("Por dia");
  daily.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Exibições", key: "plays", width: 12 }
  ];
  daily.addRows(report.daily.map((row) => ({ date: formatDate(row.date), plays: row.plays })));
  daily.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
