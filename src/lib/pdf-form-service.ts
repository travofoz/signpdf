import { PDFDocument, type PDFForm, type PDFField } from 'pdf-lib';

export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list' | 'signature';

export interface FormField {
  name: string;
  type: FieldType;
  value: any;
  required: boolean;
  options?: string[];
  bounds?: { x: number; y: number; width: number; height: number };
  pageIndices?: number[]; // Pages where this field appears
  maxLength?: number;
  readOnly: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class PDFFormService {
  private pdfDoc: PDFDocument | null = null;
  private form: PDFForm | null = null;

  async loadDocument(arrayBuffer: ArrayBuffer): Promise<void> {
    try {
      // Validate ArrayBuffer
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Invalid or empty ArrayBuffer provided');
      }

      // Create a copy of ArrayBuffer to prevent detachment issues
      const arrayBufferCopy = arrayBuffer.slice(0);
      
      // Load PDF with error handling
      this.pdfDoc = await PDFDocument.load(arrayBufferCopy, {
        ignoreEncryption: true,
        throwOnInvalidObject: false
      });
      
      this.form = this.pdfDoc.getForm();
      console.log('PDF document loaded successfully for form processing');
    } catch (error) {
      console.error('Failed to load PDF document:', error);
      throw new Error(`PDF loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load PDF document from already loaded PDFDocument (for reuse)
   */
  loadFromDocument(pdfDoc: PDFDocument): void {
    try {
      this.pdfDoc = pdfDoc;
      this.form = pdfDoc.getForm();
      console.log('PDF document reused successfully for form processing');
    } catch (error) {
      console.error('Failed to reuse PDF document:', error);
      throw new Error(`PDF reuse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  detectFormFields(): FormField[] {
    if (!this.form) {
      console.warn('PDF form not loaded - cannot detect fields');
      return [];
    }

    try {
      const fields = this.form.getFields();
      console.log(`Found ${fields.length} form fields in PDF`);
      return fields.map(field => this.mapFieldToFormField(field));
    } catch (error) {
      console.error('Failed to detect form fields:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      return [];
    }
  }

  async fillForm(formData: Record<string, any>): Promise<void> {
    if (!this.form) {
      throw new Error('PDF form not loaded');
    }

    Object.entries(formData).forEach(([fieldName, value]) => {
      try {
        const field = this.form!.getField(fieldName);
        this.setFieldValue(field, value);
      } catch (error) {
        console.warn(`Field ${fieldName} not found or invalid value:`, error);
      }
    });
  }

  async saveDocument(): Promise<Uint8Array> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not loaded');
    }
    return await this.pdfDoc.save();
  }

  flattenForm(): void {
    if (!this.form) {
      throw new Error('PDF form not loaded');
    }
    this.form.flatten();
  }

  validateField(field: FormField, value: any): ValidationResult {
    if (field.required && (!value || value === '')) {
      return { valid: false, error: `${field.name} is required` };
    }

    if (field.type === 'text' && field.maxLength && value && value.length > field.maxLength) {
      return { 
        valid: false, 
        error: `${field.name} exceeds maximum length of ${field.maxLength}` 
      };
    }

    if ((field.type === 'dropdown' || field.type === 'radio') && 
        value && 
        field.options && 
        !field.options.includes(value)) {
      return { valid: false, error: `${field.name} has invalid option` };
    }

    if (field.type === 'list' && 
        Array.isArray(value) && 
        field.options && 
        !value.every(opt => field.options!.includes(opt))) {
      return { valid: false, error: `${field.name} has invalid options` };
    }

    return { valid: true };
  }

  private mapFieldToFormField(field: PDFField): FormField {
    const fieldType = field.constructor.name;
    const name = field.getName();
    
    return {
      name,
      type: this.getFieldType(fieldType),
      value: this.getCurrentFieldValue(field),
      required: field.isRequired(),
      options: this.getFieldOptions(field),
      bounds: this.getFieldBounds(field),
      pageIndices: this.getFieldPageIndices(field),
      maxLength: this.getMaxLength(field),
      readOnly: this.isReadOnly(field)
    };
  }

  private getFieldType(pdfFieldType: string): FieldType {
    switch (pdfFieldType) {
      case 'PDFTextField': return 'text';
      case 'PDFCheckBox': return 'checkbox';
      case 'PDFRadioGroup': return 'radio';
      case 'PDFDropdown': return 'dropdown';
      case 'PDFOptionList': return 'list';
      case 'PDFSignature': return 'signature';
      default:
        console.warn(`Unknown field type: ${pdfFieldType} - treating as text field`);
        return 'text';
    }
  }

  private getCurrentFieldValue(field: PDFField): any {
    try {
      // Type-safe field value extraction
      const fieldName = field.getName();
      const fieldType = field.constructor.name;

      if (!fieldName) {
        console.warn('Field has no name, skipping value extraction');
        return null;
      }

      // Handle unknown field types more gracefully
      if (!['PDFTextField', 'PDFCheckBox', 'PDFRadioGroup', 'PDFDropdown', 'PDFOptionList', 'PDFSignature'].includes(fieldType)) {
        console.warn(`Unknown field type: ${fieldType} for field ${fieldName} - attempting to extract as text`);
        return this.extractUnknownFieldValue(field, fieldType);
      }

      switch (fieldType) {
        case 'PDFTextField': {
          const textField = field as any;
          if (typeof textField.getText === 'function') {
            const value = textField.getText();
            return value !== null && value !== undefined ? value : '';
          }
          return '';
        }
        case 'PDFCheckBox': {
          const checkBox = field as any;
          if (typeof checkBox.isChecked === 'function') {
            return checkBox.isChecked();
          }
          return false;
        }
        case 'PDFRadioGroup': {
          const radioGroup = field as any;
          if (typeof radioGroup.getSelected === 'function') {
            const value = radioGroup.getSelected();
            return value !== null && value !== undefined ? value : '';
          }
          return '';
        }
        case 'PDFDropdown': {
          const dropdown = field as any;
          if (typeof dropdown.getSelected === 'function') {
            const value = dropdown.getSelected();
            return value !== null && value !== undefined ? value : '';
          }
          return '';
        }
        case 'PDFOptionList': {
          const optionList = field as any;
          if (typeof optionList.getSelected === 'function') {
            const value = optionList.getSelected();
            return Array.isArray(value) ? value : [];
          }
          return [];
        }
        case 'PDFSignature':
          return null;
        default:
          console.warn(`Unknown field type: ${fieldType} for field ${fieldName}`);
          return this.extractUnknownFieldValue(field, fieldType);
      }
    } catch (error) {
      console.warn(`Failed to get current value for field ${field.getName()}:`, error);
      return null;
    }
  }

  /**
   * Attempt to extract value from unknown field types
   */
  private extractUnknownFieldValue(field: PDFField, fieldType: string): any {
    try {
      const fieldObj = field as any;

      // Try common method names that might exist on unknown field types
      const possibleMethods = ['getValue', 'getText', 'getSelected', 'toString'];

      for (const method of possibleMethods) {
        if (typeof fieldObj[method] === 'function') {
          const value = fieldObj[method]();
          console.log(`Successfully extracted value from unknown field type ${fieldType} using method ${method}:`, value);
          return value !== null && value !== undefined ? value : '';
        }
      }

      console.warn(`Could not extract value from unknown field type ${fieldType} - returning empty string`);
      return '';
    } catch (error) {
      console.warn(`Failed to extract value from unknown field type ${fieldType}:`, error);
      return '';
    }
  }

  private getFieldOptions(field: PDFField): string[] | undefined {
    try {
      const fieldType = field.constructor.name;
      if (!['PDFDropdown', 'PDFOptionList', 'PDFRadioGroup'].includes(fieldType)) {
        return undefined;
      }

      const fieldObj = field as any;
      if (typeof fieldObj.getOptions === 'function') {
        const options = fieldObj.getOptions();
        return Array.isArray(options) ? options : undefined;
      }
    } catch (error) {
      console.warn(`Failed to get options for field ${field.getName()}:`, error);
      return undefined;
    }
    return undefined;
  }

  private getFieldBounds(field: PDFField): { x: number; y: number; width: number; height: number } | undefined {
    try {
      const widgets = (field as any).acroField.getWidgets();
      if (widgets.length > 0) {
        const rect = widgets[0].getRect();
        return { 
          x: rect.x, 
          y: rect.y, 
          width: rect.width, 
          height: rect.height 
        };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private getFieldPageIndices(field: PDFField): number[] | undefined {
    try {
      const widgets = (field as any).acroField.getWidgets();
      const pageIndices: number[] = [];
      
      for (const widget of widgets) {
        const pageRef = widget.getPage();
        if (pageRef && this.pdfDoc) {
          // Find the page index by comparing page references
          const pages = this.pdfDoc.getPages();
          const pageIndex = pages.findIndex(page => {
            const pageDict = page.ref;
            return pageDict && pageDict.toString() === pageRef.toString();
          });
          
          if (pageIndex !== -1 && !pageIndices.includes(pageIndex)) {
            pageIndices.push(pageIndex);
          }
        }
      }
      
      return pageIndices.length > 0 ? pageIndices : undefined;
    } catch {
      return undefined;
    }
  }

  private getMaxLength(field: PDFField): number | undefined {
    try {
      if (field.constructor.name !== 'PDFTextField') {
        return undefined;
      }

      const textField = field as any;
      if (typeof textField.getMaxLen === 'function') {
        const maxLength = textField.getMaxLen();
        return typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined;
      }
    } catch (error) {
      console.warn(`Failed to get max length for field ${field.getName()}:`, error);
      return undefined;
    }
    return undefined;
  }

  private isReadOnly(field: PDFField): boolean {
    try {
      const fieldObj = field as any;
      if (typeof fieldObj.isReadOnly === 'function') {
        return fieldObj.isReadOnly();
      }
    } catch (error) {
      console.warn(`Failed to check read-only status for field ${field.getName()}:`, error);
    }
    return false;
  }

  private setFieldValue(field: PDFField, value: any): void {
    try {
      const fieldName = field.getName();
      if (!fieldName) return;

      switch (field.constructor.name) {
        case 'PDFTextField': {
          const textField = field as any;
          if (typeof textField.setText === 'function') {
            textField.setText(value?.toString() || '');
          }
          break;
        }
        case 'PDFCheckBox': {
          const checkBox = field as any;
          if (typeof checkBox.check === 'function' && typeof checkBox.uncheck === 'function') {
            value ? checkBox.check() : checkBox.uncheck();
          }
          break;
        }
        case 'PDFRadioGroup': {
          const radioGroup = field as any;
          if (typeof radioGroup.select === 'function' && typeof radioGroup.getOptions === 'function') {
            const options = radioGroup.getOptions();
            if (value && Array.isArray(options) && options.includes(value)) {
              radioGroup.select(value);
            }
          }
          break;
        }
        case 'PDFDropdown': {
          const dropdown = field as any;
          if (typeof dropdown.select === 'function' && typeof dropdown.getOptions === 'function') {
            const options = dropdown.getOptions();
            if (value && Array.isArray(options) && options.includes(value)) {
              dropdown.select(value);
            }
          }
          break;
        }
        case 'PDFOptionList': {
          const optionList = field as any;
          if (typeof optionList.select === 'function' && typeof optionList.getOptions === 'function') {
            const options = optionList.getOptions();
            if (Array.isArray(value)) {
              const validOptions = value.filter(opt => Array.isArray(options) && options.includes(opt));
              optionList.select(validOptions);
            } else if (value && Array.isArray(options) && options.includes(value)) {
              optionList.select([value]);
            }
          }
          break;
        }
      }
    } catch (error) {
      console.warn(`Failed to set field value for ${field.getName()}:`, error);
    }
  }
}