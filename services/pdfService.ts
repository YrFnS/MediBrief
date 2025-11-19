
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
 * Processes a PDF file to determine the best analysis strategy and extracts text if possible.
 * Optimized to load the document only once.
 * @param file The PDF file object to process.
 * @returns A promise that resolves to an object indicating the strategy and any extracted text.
 */
export const processPdf = async (file: File): Promise<PdfProcessingResult> => {
  let pdf = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Load the document ONCE
    pdf = await getDocument(arrayBuffer).promise;
    
    const totalPages = pdf.numPages;
    const maxPagesToCheck = Math.min(totalPages, 3);
    let fullText = '';
    let sampleText = '';

    // Pass 1: Check the first few pages for text density (Fail Fast)
    for (let i = 1; i <= maxPagesToCheck; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // item.str is the text, item.hasEOL indicates if there is a newline at the end.
        const pageText = textContent.items.map((item: any) => {
             return item.str + (item.hasEOL ? '\n' : ' ');
        }).join('');
        
        sampleText += pageText;
        fullText += pageText + '\n\n';
    }

    // Heuristic: If a PDF has less than 200 chars of extractable text in the first 3 pages,
    // it's likely a scanned document or a hybrid document (mostly images with small footers).
    // In these cases, OCR is safer to ensure we don't miss the actual medical content.
    const isLikelyScanned = sampleText.trim().length < 200 && file.size > 1024;

    if (isLikelyScanned) {
      console.log("PDF appears to be scanned or low-text density (Fail Fast Check). Recommending OCR fallback.");
      return { strategy: PdfProcessingStrategy.OCR_FALLBACK };
    } else {
      // Pass 2: If the sample passed, continue extracting the REST of the pages (if any)
      // using the SAME pdf document instance.
      if (totalPages > maxPagesToCheck) {
          for (let i = maxPagesToCheck + 1; i <= totalPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => {
                  return item.str + (item.hasEOL ? '\n' : ' ');
              }).join('');
              fullText += pageText + '\n\n';
          }
      }

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
