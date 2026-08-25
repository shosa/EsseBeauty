import ExcelJS from "exceljs";

export function createWorkbook(title: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EsseBeauty";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = title;
  return workbook;
}

export function styleWorksheet(sheet: ExcelJS.Worksheet, currencyColumns: number[] = []) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { column: 1, row: 1 }, to: { column: sheet.columnCount, row: 1 } };
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { fgColor: { argb: "FF792F59" }, pattern: "solid", type: "pattern" };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.getRow(1).height = 24;
  sheet.columns.forEach((column) => {
    let width = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => { width = Math.max(width, Math.min(42, String(cell.value ?? "").length + 2)); });
    column.width = width;
  });
  for (const index of currencyColumns) sheet.getColumn(index).numFmt = '#,##0.00 [$€-it-IT]';
}

export async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

export const excelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
