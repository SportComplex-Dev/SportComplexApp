import { DOTS, ROW_BYTES, type Ticket } from "./ticket";

const MM = 72 / 25.4; // puntos PDF por mm

/** PDF de una página de 58 mm de ancho con el bitmap a 0,125 mm por punto (1 bit, sin filtros). */
export function ticketPdf(ticket: Ticket): Uint8Array {
  const enc = new TextEncoder();
  const rows = ticket.rows.length;
  const [mx, my] = [5 * MM, 4 * MM]; // márgenes: 5 mm a los lados, 4 mm arriba
  const [iw, ih] = [DOTS * 0.125 * MM, rows * 0.125 * MM];
  const [pw, ph] = [58 * MM, ih + 2 * my];
  const f = (n: number) => n.toFixed(3);
  const content = `q ${f(iw)} 0 0 ${f(ih)} ${f(mx)} ${f(my)} cm /Im0 Do Q`;

  const parts: Uint8Array[] = [];
  let length = 0;
  const offs: number[] = [];
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === "string" ? enc.encode(b) : b;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (...body: (Uint8Array | string)[]) => {
    offs.push(length);
    push(`${offs.length} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  obj("<< /Type /Catalog /Pages 2 0 R >>");
  obj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`,
  );
  obj(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  // En el bitmap 1 = negro; con /Decode [1 0] el 1 se pinta negro en DeviceGray.
  const img = new Uint8Array(rows * ROW_BYTES);
  ticket.rows.forEach((r, i) => img.set(r, i * ROW_BYTES));
  obj(
    `<< /Type /XObject /Subtype /Image /Width ${DOTS} /Height ${rows} /ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [1 0] /Interpolate false /Length ${img.length} >>\nstream\n`,
    img,
    "\nendstream",
  );
  const xref = length;
  push(`xref\n0 ${offs.length + 1}\n0000000000 65535 f \n`);
  for (const o of offs) push(`${String(o).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${offs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
