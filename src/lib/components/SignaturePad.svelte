<script lang="ts">
  import type { PdfEditorState } from '$lib/state/pdf-editor.svelte';

  /**
   * Signature pad component
   * Provides drawing canvas and image upload for signature creation
   */
  let { editor, onCapture } = $props<{
    /** Main PDF editor state instance */
    editor: PdfEditorState;
    /** Optional callback when signature is captured */
    onCapture?: (image: string) => void;
  }>();

  /**
   * Initialize signature manager with canvas element
   * @param element - Canvas element for signature drawing
   */
  function initSignatureManager(element: HTMLCanvasElement): void {
    editor.initSignatureManager(element);
  }

  /**
   * Handle signature image upload from file input
   * @param event - File input change event
   */
  function handleSignatureUpload(event: Event): void {
    editor.handleSignatureUpload(event);
  }

  /**
   * Add current signature to the active PDF page
   * Calls optional capture callback if signature is ready
   */
  function addSignatureToPage(): void {
    editor.addSignatureToPage();
    if (onCapture && editor.signatureManager?.getSignatureImage()) {
      onCapture(editor.signatureManager.getSignatureImage()!);
    }
  }
</script>

<div class="card bg-base-100 shadow-xl" data-signature-panel>
  <div class="card-body">
    <h2 class="card-title">Signature</h2>

    <!-- Signature Mode Toggle -->
    <div class="tabs tabs-boxed mb-4">
      <button
        class="tab {editor.signatureMode === 'draw' ? 'tab-active' : ''}"
        onclick={() => (editor.signatureMode = "draw")}
      >
        Draw
      </button>
      <button
        class="tab {editor.signatureMode === 'upload' ? 'tab-active' : ''}"
        onclick={() => (editor.signatureMode = "upload")}
      >
        Upload
      </button>
    </div>

    {#if editor.signatureMode === "draw"}
      <!-- Drawing Canvas -->
      <div class="mb-4">
        <canvas
          width={300}
          height={150}
          class="border border-gray-300 rounded w-full touch-none"
          use:initSignatureManager
          onmousedown={(e) => editor.startDrawing(e)}
          onmousemove={(e) => editor.draw(e)}
          onmouseup={() => editor.stopDrawing()}
          onmouseleave={() => editor.stopDrawing()}
          ontouchstart={(e) => editor.startDrawing(e)}
          ontouchmove={(e) => editor.draw(e)}
          ontouchend={() => editor.stopDrawing()}
        ></canvas>
      </div>

      <div class="card-actions">
        <button
          class="btn btn-outline btn-sm"
          onclick={() => editor.clearSignature()}
        >
          Clear
        </button>
        <button
          class="btn btn-primary btn-sm"
          onclick={() => editor.saveDrawnSignature()}
        >
          Save Signature
        </button>
      </div>
    {:else}
      <!-- Upload Signature -->
      <div class="mb-4">
        <input
          type="file"
          accept="image/*"
          class="file-input file-input-bordered w-full"
          onchange={handleSignatureUpload}
        />
      </div>
    {/if}

    <!-- Add Signature to Page -->
    <div class="card-actions">
      <button
        class="btn btn-success btn-block"
        onclick={addSignatureToPage}
        disabled={!editor.canAddSignature}
      >
        Add Signature to Page
      </button>
    </div>
  </div>
</div>