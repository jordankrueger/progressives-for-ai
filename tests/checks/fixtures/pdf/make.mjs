// Builds the two tiny test PDFs: text.pdf (a real text layer) and scanned.pdf (no text, like a
// scan). Run: node tests/checks/fixtures/pdf/make.mjs
import { writeFileSync } from 'node:fs';

function pdf(lines) {
  const stream = lines.length
    ? `BT /F1 10 Tf 40 760 Td 14 TL ${lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) '`).join(' ')} ET`
    : '';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const dir = new URL('.', import.meta.url);
writeFileSync(new URL('text.pdf', dir), pdf([
  'How much water does golf use?',
  'Golf courses in the United States use about 531 billion gallons of water a year,',
  'mostly for irrigating fairways, greens and roughs during the summer months.',
  'Water use varies a great deal by region, climate and the type of grass planted.',
  'Courses in the Southwest use far more water per acre than courses in the Northeast.',
]));
writeFileSync(new URL('scanned.pdf', dir), pdf([]));
// A scan with only a stamped page number: some text, but far too little to check a quote against.
writeFileSync(new URL('pagenumber.pdf', dir), pdf(['Page 1 of 12']));
