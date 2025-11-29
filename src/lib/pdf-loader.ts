import { PDFDocument } from 'pdf-lib';

export interface RenderedPage {
  dataUrl: string;
  dimensions: { width: number; height: number };
}

export interface LoadedPDF {
  pdfDoc: PDFDocument;
  pages: string[];
  dimensions: Array<{ width: number; height: number }>;
}

export class PDFLoader {
  private pdfjsLib: typeof import('pdfjs-dist') | null = null;

  constructor(pdfjsLib: typeof import('pdfjs-dist') | null) {
    this.pdfjsLib = pdfjsLib;
  }

  /**
   * Load PDF with pdf-lib FIRST to avoid ArrayBuffer detachment,
   * then create fresh ArrayBuffer for PDF.js rendering
   */
  async loadPDF(file: File): Promise<LoadedPDF> {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js library not loaded');
    }

    try {
      // Step 1: Load with pdf-lib FIRST (before PDF.js to prevent detachment)
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Step 2: Create fresh ArrayBuffer for PDF.js from pdf-lib document
      const pdfBytes = await pdfDoc.save();
      const freshArrayBuffer = pdfBytes.buffer.slice(0) as ArrayBuffer;

      // Step 3: Load with PDF.js for rendering using fresh ArrayBuffer
      const pdf = await this.pdfjsLib.getDocument({ data: freshArrayBuffer }).promise;

      const pages: string[] = [];
      const dimensions: Array<{ width: number; height: number }> = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        // Store actual page dimensions for coordinate conversion
        dimensions.push({
          width: viewport.width,
          height: viewport.height
        });

        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d')!;
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas: tempCanvas }).promise;
        pages.push(tempCanvas.toDataURL());
      }

      return {
        pdfDoc,
        pages,
        dimensions
      };
    } catch (error) {
      console.error('Failed to load PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to load PDF: ${errorMessage}. Please check the file and try again.`);
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Please upload a PDF file.' };
    }

    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: 'File too large. Please upload a PDF smaller than 50MB.' };
    }

    return { valid: true };
  }
}