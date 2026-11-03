// Runs in a worker thread (see pdfText in sources.mjs) so a slow or hostile PDF can be killed
// on a deadline and capped on memory. Reads pages one at a time, up to MAX_PAGES, and stops
// once MAX_CHARS of text is collected.
import { parentPort, workerData } from 'node:worker_threads';
import { getDocumentProxy } from 'unpdf';

const { bytes, maxPages, maxChars } = workerData;
let pdf;
try {
  pdf = await getDocumentProxy(new Uint8Array(bytes));
  const parts = [];
  let length = 0;
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages) && length < maxChars; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str ?? '').join(' ');
    parts.push(text);
    length += text.length;
    page.cleanup();
  }
  parentPort.postMessage({ text: parts.join(' ').slice(0, maxChars) });
} catch (e) {
  parentPort.postMessage({ error: e?.name ?? 'Error' });
} finally {
  await pdf?.loadingTask?.destroy();
}
