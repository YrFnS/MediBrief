
// This service uses the pdf.js library, which is loaded from a CDN in index.html.
// We declare the global variable to satisfy TypeScript.
declare const pdfjsLib: any;

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
    if (!pdfjsLib) {
        throw new Error("pdf.js library is not loaded.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText;
};

/**
 * Processes a PDF file to determine the best analysis strategy.
 * It first tries to extract text. If the text is sparse, it suggests falling back to OCR.
 * @param file The PDF file object to process.
 * @returns A promise that resolves to an object indicating the strategy and any extracted text.
 */
export const processPdf = async (file: File): Promise<PdfProcessingResult> => {
  try {
    const text = await extractPdfText(file);
    
    // Heuristic: If a PDF file larger than 1KB has less than 100 characters of extractable text,
    // it's very likely a scanned, image-based document that requires OCR.
    const isLikelyScanned = text.trim().length < 100 && file.size > 1024;

    if (isLikelyScanned) {
      console.log("PDF appears to be scanned. Recommending OCR fallback.");
      return { strategy: PdfProcessingStrategy.OCR_FALLBACK };
    } else {
      console.log("Text successfully extracted from PDF.");
      return { strategy: PdfProcessingStrategy.TEXT_EXTRACTION, extractedText: text };
    }
  } catch (error) {
    console.error("Failed to process PDF with pdf.js, defaulting to OCR.", error);
    // If pdf.js throws an error (e.g., for a corrupted or encrypted file),
    // we must fall back to sending the file for OCR.
    return { strategy: PdfProcessingStrategy.OCR_FALLBACK };
  }
};
