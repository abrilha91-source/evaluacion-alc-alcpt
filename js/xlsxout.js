// Exporta a Excel (Noto Sans 10) con xlsx-js-style (global XLSX).
export function exportXlsx(name, sheets) { // sheets: [{name, head:[], rows:[[]]}]
  const X = globalThis.XLSX, wb = X.utils.book_new(), F = { name: 'Noto Sans', sz: 10 };
  for (const s of sheets) {
    const data = [s.head, ...s.rows], ws = X.utils.aoa_to_sheet(data);
    const rng = X.utils.decode_range(ws['!ref']);
    for (let r = rng.s.r; r <= rng.e.r; r++) for (let c = rng.s.c; c <= rng.e.c; c++) {
      const a = X.utils.encode_cell({ r, c }), cell = ws[a]; if (!cell) continue;
      cell.s = r === 0 ? { font: { ...F, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' } }, alignment: { vertical: 'center', wrapText: true } } : { font: F, alignment: { vertical: 'top' } };
    }
    ws['!cols'] = s.head.map((hd, c) => ({ wch: Math.min(40, Math.max(String(hd).length, ...s.rows.map(r => String(r[c] ?? '').length)) + 2) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  X.writeFile(wb, name, { cellStyles: true });
}
