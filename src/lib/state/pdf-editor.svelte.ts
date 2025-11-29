
import { PDFDocument } from "pdf-lib";
import { PDFLoader } from "$lib/pdf-loader";
import { SignatureManager, type Signature } from "$lib/signature-manager";
import { DragDropManager } from "$lib/drag-drop-manager";
import { FormFieldManager } from "$lib/form-field-manager";
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export class PdfEditorState {
  // Library loading state
  pdfjsLib: typeof import("pdfjs-dist") | null = null;
  pdfLibLoaded = $state(false);
  pdfjsLibLoaded = $state(false);

  // Managers
  pdfLoader: PDFLoader | null = null;
  signatureManager: SignatureManager | null = $state(null);
  dragDropManager: DragDropManager = $state() as DragDropManager;
  formFieldManager: FormFieldManager = $state() as FormFieldManager;

  // Core reactive state
  pdfFile: File | null = $state(null);
  pdfPages: string[] = $state([]);
  currentPage = $state(0);
  signatureMode: "draw" | "upload" = $state("draw");
  signatures = $state<Signature[]>([]);
  canvas: HTMLCanvasElement = $state() as HTMLCanvasElement;
  
  // Raw reference for PDF document to avoid Svelte 5 proxy issues
  // Using $state.raw prevents deep reactivity on complex external objects
  private _pdfDoc: PDFDocument | null = null;
  get pdfDoc(): PDFDocument | null {
    return this._pdfDoc;
  }
  set pdfDoc(value: PDFDocument | null) {
    this._pdfDoc = value;
  }

  // Form state
  formFields = $state<any[]>([]);
  formData = $state<Record<string, any>>({});
  showFormPanel = $state(false);
  

  // Version info
  /** Current version of the application */
  version = $state("0.0.1-refactored");

  constructor() {
    this.initializeManagers();
    this.loadLibraries();
  }

  /**
   * Load PDF libraries dynamically
   * Sets up PDF.js worker for production builds
   */
  private async loadLibraries(): Promise<void> {
    try {
      this.pdfjsLib = await import("pdfjs-dist");
      
      // Set worker source for production builds
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
      
      this.pdfLibLoaded = true;
      this.pdfjsLibLoaded = true;
      this.initializeManagers();
    } catch (error) {
      console.error("Failed to load PDF libraries:", error);
    }
  }

  /**
   * Initialize managers when PDF libraries are loaded
   * Creates instances of PDF loader, drag-drop manager, and form field manager
   */
  private initializeManagers(): void {
    if (!this.pdfjsLib) return;

    this.pdfLoader = new PDFLoader(this.pdfjsLib);
    this.dragDropManager = new DragDropManager(null);
    this.formFieldManager = new FormFieldManager();
  }

  /**
   * Initialize signature manager when canvas is ready
   * Sets up canvas for drawing signatures and configures container dimensions
   * @param element - The canvas element to use for signature drawing
   */
  initSignatureManager(element: HTMLCanvasElement): void {
    this.canvas = element;
    this.signatureManager = new SignatureManager(element);

    // Update container dimensions for signature manager
    const dimensions = this.dragDropManager.getContainerDimensions();
    this.signatureManager.setContainerDimensions(
      dimensions.width,
      dimensions.height,
    );
  }

  /**
   * Initialize PDF preview container and set up resize observer
   * Sets up the main PDF display container and configures resize handling
   * @param element - The container element for PDF preview
   * @returns Cleanup function for resize observer
   */
  initPdfContainer(element: HTMLDivElement): (() => void) {
    this.dragDropManager.setContainer(element);
    this.dragDropManager.updateContainerDimensions();

    // Update signature manager container dimensions
    if (this.signatureManager) {
      const dimensions = this.dragDropManager.getContainerDimensions();
      this.signatureManager.setContainerDimensions(
        dimensions.width,
        dimensions.height,
      );
    }

    return this.dragDropManager.setupResizeObserver();
  }

  /**
   * Load PDF with new modular approach
   * Validates, loads, and processes PDF files with form field detection
   * @param file - The PDF file to load and process
   */
  async loadPDF(file: File): Promise<void> {
    if (!this.pdfLibLoaded || !this.pdfjsLibLoaded || !this.pdfLoader) {
      alert(
        "PDF libraries are still loading. Please wait a moment and try again.",
      );
      return;
    }

    try {
      // Validate file
      const validation = this.pdfLoader.validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      // Load PDF using the new loader (this fixes ArrayBuffer detachment)
      const loadedPDF = await this.pdfLoader.loadPDF(file);

      // Update state
      this.pdfFile = file;
      this.pdfPages = loadedPDF.pages;
      this.currentPage = 0;

      // Detect form fields using the loaded pdf-lib document
      await this.formFieldManager.detectFormFields(loadedPDF.pdfDoc);

      // Update form state
      const formState = this.formFieldManager.getFormState();
      this.formFields = formState.formFields;
      this.formData = formState.formData;
      this.showFormPanel = formState.showFormPanel;
    } catch (error) {
      console.error("Failed to load PDF:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to load PDF: ${errorMessage}. Please check the file and try again.`,
      );
    }
  }

  /**
   * Handle file upload from input element
   * Processes file selection from file input and loads the PDF
   * @param event - The file input change event
   */
  async handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.loadPDF(file);
  }

  /**
   * Handle drag and drop file upload
   * Processes files dropped onto the upload area and validates them
   * @param event - The drag and drop event containing file data
   */
  async handleDrop(event: DragEvent): Promise<void> {
    try {
      const file = await this.dragDropManager.handleFileDrop(event);
      if (file) {
        await this.loadPDF(file);
      }
    } catch (error) {
      console.error("File drop error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(errorMessage);
    }
  }

  /**
   * Handle drag over events for file drop zone
   * Prevents default browser behavior during drag operations
   * @param event - The drag over event
   */
  handleDragOver(event: DragEvent): void {
    this.dragDropManager.handleDragOver(event);
  }

  /**
   * Handle form field value changes
   */
  handleFieldValueChange(fieldName: string, value: any) {
    this.formFieldManager.handleFieldValueChange(fieldName, value);
    const formState = this.formFieldManager.getFormState();
    this.formData = formState.formData;
  }

  /**
   * Handle signature field requests
   */
  handleSignatureRequest() {
    this.formFieldManager.handleSignatureRequest();
  }

  // Signature drawing functions
  startDrawing(e: MouseEvent | TouchEvent) {
    if (!this.signatureManager) return;
    this.signatureManager.startDrawing(e);
  }

  draw(e: MouseEvent | TouchEvent) {
    if (!this.signatureManager) return;
    this.signatureManager.draw(e);
  }

  stopDrawing() {
    if (!this.signatureManager) return;
    this.signatureManager.stopDrawing();
  }

  clearSignature() {
    if (!this.signatureManager) return;
    this.signatureManager.clearSignature();
  }

  saveDrawnSignature() {
    if (!this.signatureManager) return;
    this.signatureManager.saveDrawnSignature();
  }

  // Signature placement functions
  addSignatureToPage() {
    if (!this.signatureManager) return;

    const newSignature = this.signatureManager.addSignatureToPage(this.currentPage);
    if (newSignature) {
      this.signatures = [...this.signatures, newSignature];
    }
  }

  addSignatureFromImage(image: string) {
    if (!this.signatureManager) return;
    
    this.signatureManager.setSignatureImage(image);
    this.addSignatureToPage();
  }

  removeSignature(index: number) {
    this.signatures = this.signatures.filter((_, i) => i !== index);
  }

  // Drag and drop functions for signatures
  startDrag(e: MouseEvent | TouchEvent, index: number) {
    this.dragDropManager.startDrag(e, index);
  }

  handleDrag(e: MouseEvent | TouchEvent) {
    this.signatures = this.dragDropManager.onDrag(e, this.signatures);
  }

  startResize(e: MouseEvent | TouchEvent, index: number) {
    this.dragDropManager.startResize(e, index, this.signatures);
  }

  handleResize(e: MouseEvent | TouchEvent) {
    this.signatures = this.dragDropManager.onResize(e, this.signatures);
  }

  stopDrag() {
    this.dragDropManager.stopDrag();
  }

  /**
   * Handle keyboard interaction for signatures (A11y)
   */
  handleSignatureKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === "Delete" || e.key === "Backspace") {
      this.removeSignature(index);
    }
  }

  // Utility functions
  percentToPixels(percent: number, dimension: number): number {
    return (percent / 100) * dimension;
  }

  pixelsToPercent(pixels: number, dimension: number): number {
    return (pixels / dimension) * 100;
  }

  /**
   * Download signed PDF
   */
  async downloadPDF() {
    if (!this.pdfFile || !this.pdfLibLoaded) {
      alert(
        "PDF libraries are still loading. Please wait a moment and try again.",
      );
      return;
    }

    try {
      // Validate form if there are form fields
      if (this.formFields.length > 0) {
        const isValid = this.formFieldManager.validateForm();
        if (!isValid) {
          const formState = this.formFieldManager.getFormState();
          const errorCount = Object.keys(formState.formErrors).length;
          alert(
            `Please fix ${errorCount} form error${errorCount > 1 ? "s" : ""} before downloading.`,
          );
          return;
        }
      }

      // Load PDF using the loader to get pdf-lib document
      const loadedPDF = await this.pdfLoader!.loadPDF(this.pdfFile);
      let pdfDoc = loadedPDF.pdfDoc;

      // Fill form data if any fields exist
      if (this.formFields.length > 0) {
        const doc = this.pdfDoc;
        if (doc) {
          await this.formFieldManager.fillForm(doc);
        }
      }

      // Embed signatures
      if (this.signatureManager && this.signatures.length > 0) {
        await this.signatureManager.embedSignatures(pdfDoc, this.signatures);
      }

      // Save and download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "completed-" + (this.pdfFile?.name || "document.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to download PDF: ${errorMessage}`);
    }
  }

  /**
   * Reset everything
   */
  reset() {
    this.pdfFile = null;
    this.pdfPages = [];
    this.signatures = [];
    this.currentPage = 0;
    this.formFieldManager.resetForm();
    const formState = this.formFieldManager.getFormState();
    this.formFields = formState.formFields;
    this.formData = formState.formData;
    this.showFormPanel = formState.showFormPanel;
    if (this.signatureManager) {
      this.signatureManager.clearSignature();
    }
  }

  /**
   * Get current page image
   */
  get currentPageImage(): string {
    return this.pdfPages[this.currentPage] || "";
  }

  /**
   * Get current signatures for the current page
   */
  get currentSignatures(): Signature[] {
    return this.signatures.filter(sig => sig.page === this.currentPage);
  }

  /**
   * Focus signature panel
   */
  focusSignaturePanel() {
    const signaturePanel = document.querySelector('[data-signature-panel]') as HTMLElement;
    if (signaturePanel) {
      signaturePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight signature area briefly
      signaturePanel.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        signaturePanel.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  }

  /**
   * Update signatures (for drag/resize operations)
   */
  updateSignatures(newSignatures: Signature[]) {
    this.signatures = newSignatures;
  }

  /**
   * Handle signature upload from file
   */
  handleSignatureUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && this.signatureManager) {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.signatureManager!.setSignatureImage(
          event.target?.result as string,
        );
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Check if signature is ready to be added
   */
  get canAddSignature(): boolean {
    return !!this.signatureManager?.getSignatureImage();
  }
}