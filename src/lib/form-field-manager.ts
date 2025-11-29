import { PDFDocument } from 'pdf-lib';
import { PDFFormService, type FormField } from './pdf-form-service';

export interface FormState {
  formFields: FormField[];
  formData: Record<string, any>;
  showFormPanel: boolean;
  formErrors: Record<string, string>;
}

export class FormFieldManager {
  private formService: PDFFormService;
  private formState: FormState = {
    formFields: [],
    formData: {},
    showFormPanel: false,
    formErrors: {}
  };

  constructor() {
    this.formService = new PDFFormService();
  }

  /**
   * Detect form fields using the already-loaded pdf-lib document
   * This avoids ArrayBuffer detachment issues
   */
  async detectFormFields(pdfDoc: PDFDocument): Promise<void> {
    try {
      // Use the already-loaded pdf-lib document instead of ArrayBuffer
      this.formService.loadFromDocument(pdfDoc);
      const fields = this.formService.detectFormFields();

      if (fields.length > 0) {
        this.formState.formFields = fields;
        this.formState.formData = fields.reduce((acc, field) => {
          acc[field.name] = field.value;
          return acc;
        }, {} as Record<string, any>);
        this.formState.showFormPanel = true;
      } else {
        this.formState.formFields = [];
        this.formState.formData = {};
        this.formState.showFormPanel = false;
      }
    } catch (error) {
      console.warn('Failed to detect form fields:', error);
      this.formState.formFields = [];
      this.formState.formData = {};
      this.formState.showFormPanel = false;
    }
  }

  /**
   * Handle form field value changes
   */
  handleFieldValueChange(fieldName: string, value: any): void {
    this.formState.formData[fieldName] = value;

    // Clear any existing error for this field
    if (this.formState.formErrors[fieldName]) {
      delete this.formState.formErrors[fieldName];
    }
  }

  /**
   * Validate all form fields
   */
  validateForm(): boolean {
    const errors: Record<string, string> = {};
    let isValid = true;

    this.formState.formFields.forEach(field => {
      const result = this.formService.validateField(field, this.formState.formData[field.name]);
      if (!result.valid) {
        errors[field.name] = result.error || 'Invalid value';
        isValid = false;
      }
    });

    this.formState.formErrors = errors;
    return isValid;
  }

  /**
   * Fill form data into the PDF document
   */
  async fillForm(pdfDoc: PDFDocument): Promise<void> {
    if (this.formState.formFields.length === 0) return;

    // Create a new form service instance for this document
    const tempFormService = new PDFFormService();
    tempFormService.loadFromDocument(pdfDoc);

    await tempFormService.fillForm(this.formState.formData);
  }

  /**
   * Get current form state
   */
  getFormState(): FormState {
    return { ...this.formState };
  }

  /**
   * Get form fields for rendering
   */
  getFormFields(): FormField[] {
    return [...this.formState.formFields];
  }

  /**
   * Get form data
   */
  getFormData(): Record<string, any> {
    return { ...this.formState.formData };
  }

  /**
   * Get form errors
   */
  getFormErrors(): Record<string, string> {
    return { ...this.formState.formErrors };
  }

  /**
   * Check if form panel should be shown
   */
  shouldShowFormPanel(): boolean {
    return this.formState.showFormPanel;
  }

  /**
   * Get field value by name
   */
  getFieldValue(fieldName: string): any {
    return this.formState.formData[fieldName];
  }

  /**
   * Set field value by name
   */
  setFieldValue(fieldName: string, value: any): void {
    this.handleFieldValueChange(fieldName, value);
  }

  /**
   * Get field error by name
   */
  getFieldError(fieldName: string): string | undefined {
    return this.formState.formErrors[fieldName];
  }

  /**
   * Reset form state
   */
  resetForm(): void {
    this.formState = {
      formFields: [],
      formData: {},
      showFormPanel: false,
      formErrors: {}
    };
  }

  /**
   * Handle signature field requests
   */
  handleSignatureRequest(): void {
    // Focus signature panel and scroll to signature area
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
}