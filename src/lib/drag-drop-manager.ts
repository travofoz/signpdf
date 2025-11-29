import type { Signature } from './signature-manager';

export interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragIndex: number;
  dragStart: { x: number; y: number; width: number; height: number };
  resizeStart: { x: number; y: number; width: number; height: number };
}

export class DragDropManager {
  private pdfPreviewContainer: HTMLDivElement | null = null;
  private containerWidth = 0;
  private containerHeight = 0;
  private dragState: DragState = {
    isDragging: false,
    isResizing: false,
    dragIndex: -1,
    dragStart: { x: 0, y: 0, width: 0, height: 0 },
    resizeStart: { x: 0, y: 0, width: 0, height: 0 }
  };

  constructor(container: HTMLDivElement | null) {
    this.pdfPreviewContainer = container;
    this.updateContainerDimensions();
  }

  setContainer(container: HTMLDivElement | null): void {
    this.pdfPreviewContainer = container;
    this.updateContainerDimensions();
  }

  updateContainerDimensions(): void {
    if (!this.pdfPreviewContainer) return;
    this.containerWidth = this.pdfPreviewContainer.offsetWidth;
    this.containerHeight = this.pdfPreviewContainer.offsetHeight;
  }

  getContainerDimensions(): { width: number; height: number } {
    return {
      width: this.containerWidth,
      height: this.containerHeight
    };
  }

  // File drag and drop handling
  async handleFileDrop(event: DragEvent): Promise<File | null> {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return null;

    // Validate file
    if (file.type !== 'application/pdf') {
      throw new Error('Please upload a PDF file.');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File too large. Please upload a PDF smaller than 50MB.');
    }

    return file;
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // Signature dragging
  startDrag(e: MouseEvent | TouchEvent, index: number): void {
    if (!this.pdfPreviewContainer) return;
    e.preventDefault();
    this.dragState.isDragging = true;
    this.dragState.dragIndex = index;

    const rect = this.pdfPreviewContainer.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

    this.dragState.dragStart = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: 0,
      height: 0
    };
  }

  onDrag(e: MouseEvent | TouchEvent, signatures: Signature[]): Signature[] {
    if (!this.dragState.isDragging || this.dragState.dragIndex < 0 || !this.pdfPreviewContainer) {
      return signatures;
    }

    e.preventDefault();

    const rect = this.pdfPreviewContainer.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;



    const newPixelX = clientX - rect.left - this.dragState.dragStart.x;
    const newPixelY = clientY - rect.top - this.dragState.dragStart.y;

    signatures[this.dragState.dragIndex].xPercent = this.pixelsToPercent(newPixelX, this.containerWidth);
    signatures[this.dragState.dragIndex].yPercent = this.pixelsToPercent(newPixelY, this.containerHeight);

    return signatures;
  }

  // Signature resizing
  startResize(e: MouseEvent | TouchEvent, index: number, signatures: Signature[]): void {
    if (!this.pdfPreviewContainer) return;
    e.preventDefault();
    this.dragState.isResizing = true;
    this.dragState.dragIndex = index;

    const rect = this.pdfPreviewContainer.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

    this.dragState.dragStart = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: 0,
      height: 0
    };

    this.dragState.resizeStart = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: this.percentToPixels(signatures[index].widthPercent, this.containerWidth),
      height: this.percentToPixels(signatures[index].heightPercent, this.containerHeight)
    };
  }

  onResize(e: MouseEvent | TouchEvent, signatures: Signature[]): Signature[] {
    if (!this.dragState.isResizing || this.dragState.dragIndex < 0 || !this.pdfPreviewContainer) {
      return signatures;
    }

    e.preventDefault();

    const rect = this.pdfPreviewContainer.getBoundingClientRect();
    const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
    const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

    const newPixelX = clientX - rect.left - this.dragState.dragStart.x;
    const newPixelY = clientY - rect.top - this.dragState.dragStart.y;

    const newWidth = Math.max(50, this.dragState.resizeStart.width + newPixelX);
    const newHeight = Math.max(25, this.dragState.resizeStart.height + newPixelY);

    signatures[this.dragState.dragIndex].widthPercent = this.pixelsToPercent(newWidth, this.containerWidth);
    signatures[this.dragState.dragIndex].heightPercent = this.pixelsToPercent(newHeight, this.containerHeight);

    return signatures;
  }

  stopDrag(): void {
    this.dragState.isDragging = false;
    this.dragState.isResizing = false;
    this.dragState.dragIndex = -1;
  }

  getDragState(): DragState {
    return { ...this.dragState };
  }

  // Utility functions for coordinate conversion
  percentToPixels(percent: number, dimension: number): number {
    return (percent / 100) * dimension;
  }

  pixelsToPercent(pixels: number, dimension: number): number {
    return (pixels / dimension) * 100;
  }

  // Setup resize observer for responsive container
  setupResizeObserver(): () => void {
    if (!this.pdfPreviewContainer) return () => {};

    const resizeObserver = new ResizeObserver(() => {
      this.updateContainerDimensions();
    });
    resizeObserver.observe(this.pdfPreviewContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }
}