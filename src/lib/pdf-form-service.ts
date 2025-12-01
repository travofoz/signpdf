import { PDFDocument, type PDFForm, type PDFField } from 'pdf-lib';

export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list' | 'signature';

export interface FormField {
  name: string;
  type: FieldType;
  value: any;
  required: boolean;
  options?: string[];
  bounds?: { x: number; y: number; width: number; height: number; page?: number };
  maxLength?: number;
  readOnly: boolean;
  label?: string; // Human-readable label
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class PDFFormService {
  private pdfDoc: PDFDocument | null = null;
  private form: PDFForm | null = null;

  async loadDocument(arrayBuffer: ArrayBuffer): Promise<void> {
    this.pdfDoc = await PDFDocument.load(arrayBuffer);
    this.form = this.pdfDoc.getForm();
  }

  detectFormFields(): FormField[] {
    if (!this.form) {
      return [];
    }

    try {
      const fields = this.form.getFields();
      return fields.map(field => this.mapFieldToFormField(field));
    } catch (error) {
      console.warn('Failed to detect form fields:', error);
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
      maxLength: this.getMaxLength(field),
      readOnly: this.isReadOnly(field),
      label: this.generateFieldLabel(name)
    };
  }

  /**
   * Generate a human-readable label from the field name
   */
  private generateFieldLabel(fieldName: string): string {
    // Common field name patterns and their human-readable equivalents
    const labelMappings: Record<string, string> = {
      'f1_01': 'First Name',
      'f1_02': 'Last Name',
      'f1_03': 'Middle Initial',
      'f1_04': 'Social Security Number',
      'f1_05': 'Date of Birth',
      'f1_06': 'Address',
      'f1_07': 'City',
      'f1_08': 'State',
      'f1_09': 'ZIP Code',
      'f1_10': 'Phone Number',
      'f1_11': 'Email',
      'f1_12': 'Employee ID',
      'f1_13': 'Department',
      'f1_14': 'Position',
      'f1_15': 'Start Date',
      'c1_1': 'Checkbox Option',
      'c1_2': 'Additional Checkbox',
      'c2_1': 'Tax Status',
      'c2_2': 'Federal Tax',
      'c2_3': 'State Tax'
    };

    // Extract the core field name (remove array indices and subform prefixes)
    const coreFieldName = fieldName.replace(/.*?([fc]\d+_\d+).*/, '$1');

    // Return the mapped label or create a formatted version
    if (labelMappings[coreFieldName]) {
      return labelMappings[coreFieldName];
    }

    // Fallback: create a readable version from the field name
    return coreFieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\d+/, '') // Remove numbers at the end
      .trim() || fieldName;
  }

  private getFieldType(pdfFieldType: string): FieldType {
    switch (pdfFieldType) {
      case 'PDFTextField': return 'text';
      case 'PDFCheckBox': return 'checkbox';
      case 'PDFRadioGroup': return 'radio';
      case 'PDFDropdown': return 'dropdown';
      case 'PDFOptionList': return 'list';
      case 'PDFSignature': return 'signature';
      default: return 'text';
    }
  }

  private getCurrentFieldValue(field: PDFField): any {
    try {
      switch (field.constructor.name) {
        case 'PDFTextField': 
          return (field as any).getText() || '';
        case 'PDFCheckBox': 
          return (field as any).isChecked();
        case 'PDFRadioGroup': 
          return (field as any).getSelected() || '';
        case 'PDFDropdown': 
          return (field as any).getSelected() || '';
        case 'PDFOptionList': 
          return (field as any).getSelected() || [];
        case 'PDFSignature': 
          return null;
        default: 
          return null;
      }
    } catch {
      return null;
    }
  }

  private getFieldOptions(field: PDFField): string[] | undefined {
    try {
      if (['PDFDropdown', 'PDFOptionList', 'PDFRadioGroup'].includes(field.constructor.name)) {
        return (field as any).getOptions();
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private getFieldBounds(field: PDFField): { x: number; y: number; width: number; height: number; page?: number } | undefined {
    try {
      const widgets = (field as any).acroField.getWidgets();
      if (widgets.length > 0) {
        const rect = widgets[0].getRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          page: this.getFieldPage(field)
        };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private getFieldPage(field: PDFField): number | undefined {
    try {
      const widgets = (field as any).acroField.getWidgets();
      if (widgets.length > 0) {
        // Get the page reference from the first widget
        const pageRef = widgets[0].P;
        if (pageRef) {
          // Try to get the page number - this is a simplified approach
          // In a real implementation, you'd need to map page references to page numbers
          return 0; // Default to first page for now
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private getMaxLength(field: PDFField): number | undefined {
    try {
      if (field.constructor.name === 'PDFTextField') {
        return (field as any).getMaxLen();
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private isReadOnly(field: PDFField): boolean {
    try {
      return (field as any).isReadOnly();
    } catch {
      return false;
    }
  }

  private setFieldValue(field: PDFField, value: any): void {
    try {
      switch (field.constructor.name) {
        case 'PDFTextField':
          (field as any).setText(value?.toString() || '');
          break;
        case 'PDFCheckBox':
          value ? (field as any).check() : (field as any).uncheck();
          break;
        case 'PDFRadioGroup':
          if (value && (field as any).getOptions().includes(value)) {
            (field as any).select(value);
          }
          break;
        case 'PDFDropdown':
          if (value && (field as any).getOptions().includes(value)) {
            (field as any).select(value);
          }
          break;
        case 'PDFOptionList':
          if (Array.isArray(value)) {
            const validOptions = value.filter(opt => (field as any).getOptions().includes(opt));
            (field as any).select(validOptions);
          } else if (value && (field as any).getOptions().includes(value)) {
            (field as any).select([value]);
          }
          break;
      }
    } catch (error) {
      console.warn(`Failed to set field value for ${field.getName()}:`, error);
    }
  }
}