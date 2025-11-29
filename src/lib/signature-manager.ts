import { PDFDocument } from 'pdf-lib';

export interface Signature {
  image: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  page: number;
}

export class SignatureManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private signatureImage: string | null = null;
  private containerWidth = 0;
  private containerHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initCanvas();
  }

  private initCanvas(): void {
    if (this.ctx) {
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
    }
  }

  setContainerDimensions(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  // Drawing functions
  startDrawing(e: MouseEvent | TouchEvent): void {
    if (!this.ctx) return;
    e.preventDefault();
    this.isDrawing = true;
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
    
    this.ctx.beginPath();
    this.ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  }

  draw(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.ctx) return;
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
    
    this.ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    this.ctx.stroke();
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  clearSignature(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.signatureImage = null;
  }

  saveDrawnSignature(): void {
    this.signatureImage = this.canvas.toDataURL('image/png');
  }

  getSignatureImage(): string | null {
    return this.signatureImage;
  }

  setSignatureImage(image: string): void {
    this.signatureImage = image;
  }

  // Signature placement functions
  addSignatureToPage(currentPage: number): Signature | null {
    if (!this.signatureImage || !this.containerWidth || !this.containerHeight) {
      return null;
    }

    return {
      image: this.signatureImage,
      xPercent: 20,
      yPercent: 15,
      widthPercent: 10,
      heightPercent: 10,
      page: currentPage
    };
  }

  // Embed signatures into PDF
  async embedSignatures(pdfDoc: PDFDocument, signatures: Signature[]): Promise<void> {
    const pages = pdfDoc.getPages();

    for (const sig of signatures) {
      const page = pages[sig.page];
      if (!page) continue;

      const { width: pdfWidth, height: pdfHeight } = page.getSize();

      // Convert percentages to pixels
      const x = (sig.xPercent / 100) * pdfWidth;
      const y = (sig.yPercent / 100) * pdfHeight;
      const sigWidth = (sig.widthPercent / 100) * pdfWidth;
      const sigHeight = (sig.heightPercent / 100) * pdfHeight;

      // Safely convert data URL to bytes
      const dataURL = sig.image;
      if (!dataURL.startsWith('data:image/')) {
        console.error('Invalid signature image format');
        continue;
      }

      const base64Data = dataURL.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      let image;
      try {
        if (dataURL.startsWith('data:image/png')) {
          image = await pdfDoc.embedPng(imageBytes);
        } else if (dataURL.startsWith('data:image/jpeg') || dataURL.startsWith('data:image/jpg')) {
          image = await pdfDoc.embedJpg(imageBytes);
        } else {
          // Try PNG as fallback
          image = await pdfDoc.embedPng(imageBytes);
        }
      } catch (error) {
        console.error('Failed to embed signature image:', error);
        continue;
      }

      // Draw signature on PDF page
      page.drawImage(image, {
        x,
        y,
        width: sigWidth,
        height: sigHeight
      });
    }
  }

  // Utility functions for coordinate conversion
  percentToPixels(percent: number, dimension: number): number {
    return (percent / 100) * dimension;
  }

  pixelsToPercent(pixels: number, dimension: number): number {
    return (pixels / dimension) * 100;
  }

  getContainerDimensions(): { width: number; height: number } {
    return {
      width: this.containerWidth,
      height: this.containerHeight
    };
  }
}