import XLSX from 'xlsx/dist/xlsx.full.min.js';

export function xlsxToStatementText(bytes: Uint8Array): string {
  const workbook = XLSX.read(bytes.slice().buffer, { type: 'array' });
  return workbook.SheetNames
    .map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false }))
    .filter((text) => text.trim().length > 0)
    .join('\n');
}