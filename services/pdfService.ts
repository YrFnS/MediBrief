
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configure the worker source globally for pdf.js
// This matches the version imported in the importmap
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';

export enum PdfProcessingStrategy {
  TEXT_EXTRACTION = 'text',
  OCR_FALLBACK = 'ocr',
}

export interface PdfProcessingResult {
  strategy: PdfProcessingStrategy;
  extractedText?: string; // Only present for TEXT_EXTRACTION
}


/**
 * Extracts text content from a PDF file using pdf.js.
 * @param file The PDF file object to process.
 * @returns A promise that resolves to the full text content of the PDF.
 */
export const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    let pdf = null;
    try {
        pdf = await getDocument(arrayBuffer).promise;
        const numPages = pdf.numPages;
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // item.str is the text, item.hasEOL indicates if there is a newline at the end.
            // We use this to preserve the document structure.
            const pageText = textContent.items.map((item: any) => {
                return item.str + (item.hasEOL ? '\n' : ' ');
            }).join('');
            fullText += pageText + '\n\n';
        }
        return fullText;
    } finally {
        if (pdf) await pdf.destroy();
    }
};

/**
 * Processes a PDF file to determine the best analysis strategy.
 * It first tries to extract text. If the text is sparse, it suggests falling back to OCR.
 * @param file The PDF file object to process.
 * @returns A promise that resolves to an object indicating the strategy and any extracted text.
 */
export const processPdf = async (file: File): Promise<PdfProcessingResult> => {
  let pdf = null;
  try {
    // Fail Fast Strategy: Check first 3 pages for text density before processing the whole file.
    const arrayBuffer = await file.arrayBuffer();
    pdf = await getDocument(arrayBuffer).promise;
    
    const maxPagesToCheck = Math.min(pdf.numPages, 3);
    let sampleText = '';

    for (let i = 1; i <= maxPagesToCheck; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        sampleText += textContent.items.map((item: any) => item.str).join(' ');
    }

    // Heuristic: If a PDF has less than 50 chars of extractable text in the first 3 pages,
    // it's almost certainly a scanned document.
    const isLikelyScanned = sampleText.trim().length < 50 && file.size > 1024;

    // We must clean up this 'probe' instance before moving on
    await pdf.destroy();
    pdf = null;

    if (isLikelyScanned) {
      console.log("PDF appears to be scanned (Fail Fast Check). Recommending OCR fallback.");
      return { strategy: PdfProcessingStrategy.OCR_FALLBACK };
    } else {
      // If the sample check passed, we extract the FULL text for analysis.
      // We use the original extractPdfText to get the complete content.
      const fullText = await extractPdfText(file);
      console.log("Text successfully extracted from PDF.");
      return { strategy: PdfProcessingStrategy.TEXT_EXTRACTION, extractedText: fullText };
    }
  } catch (error) {
    console.error("Failed to process PDF with pdf.js, defaulting to OCR.", error);
    // If pdf.js throws an error (e.g., for a corrupted or encrypted file),
    // we must fall back to sending the file for OCR.
    return { strategy: PdfProcessingStrategy.OCR_FALLBACK };
  } finally {
      if (pdf) await pdf.destroy();
  }
};