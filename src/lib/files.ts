import { cap } from './platform';

/** Read text out of a PDF / TXT / MD file. PDF parsing is loaded only when needed. */
export async function readFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs: any = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.map((it: any) => ('str' in it ? it.str : '')).join(' '));
    }
    return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
  }
  return (await file.text()).trim();
}

/** Offer a file to the user. Uses the artifact downloads capability when inside Claude. */
export async function saveFile(filename: string, text: string, mime = 'application/json') {
  const dl = await cap<any>('downloads');
  if (dl) {
    try {
      await dl.save({ filename, data: new Blob([text], { type: mime }) });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
