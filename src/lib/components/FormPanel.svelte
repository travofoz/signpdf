<script lang="ts">
  import type { PdfEditorState } from '$lib/state/pdf-editor.svelte';
  import FormFieldComponent from "$lib/components/FormField.svelte";

  /**
   * Form panel component
   * Displays detected PDF form fields for user input
   */
  let { editor } = $props<{
    /** Main PDF editor state instance */
    editor: PdfEditorState;
  }>();

  /**
   * Handle form field value changes
   * @param fieldName - Name of the form field
   * @param value - New value for the form field
   */
  function handleFieldValueChange(fieldName: string, value: any): void {
    editor.handleFieldValueChange(fieldName, value);
  }

  /**
   * Handle signature field requests from form
   * Focuses signature panel and highlights it briefly
   */
  function handleSignatureRequest(): void {
    editor.handleSignatureRequest();
  }
</script>

<!-- Form Fields Panel -->
{#if editor.showFormPanel}
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Form Fields</h2>
      <div class="space-y-4 max-h-96 overflow-y-auto">
        {#each editor.formFields as field (field.name)}
          <FormFieldComponent
            {field}
            value={editor.formData[field.name]}
            onValueChange={handleFieldValueChange}
            onSignatureRequest={handleSignatureRequest}
          />
        {/each}
      </div>
    </div>
  </div>
{/if}