<script lang="ts">
  import type { PdfEditorState } from '$lib/state/pdf-editor.svelte';

  /**
   * Action panel component
   * Provides download and reset functionality for the PDF editor
   */
  let { editor } = $props<{
    /** Main PDF editor state instance */
    editor: PdfEditorState;
  }>();

  /**
   * Download the signed PDF
   * Validates form and triggers PDF generation with signatures
   */
  function downloadPDF(): void {
    editor.downloadPDF();
  }

  /**
   * Reset the entire application state
   * Clears PDF, signatures, and form data
   */
  function reset(): void {
    editor.reset();
  }
</script>

<!-- Actions -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Finish</h2>
    <div class="card-actions flex-col">
      <button
        class="btn btn-success btn-block"
        disabled={editor.signatures.length === 0 && editor.formFields.length === 0}
        onclick={downloadPDF}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {editor.signatures.length > 0
          ? "Download Signed PDF"
          : "Download Completed PDF"}
      </button>
      <button class="btn btn-outline btn-block" onclick={reset}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Start Over
      </button>
    </div>
  </div>
</div>