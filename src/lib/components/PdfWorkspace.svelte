<script lang="ts">
  import type { PdfEditorState } from '$lib/state/pdf-editor.svelte';

  /**
   * PDF workspace component
   * Displays PDF preview with draggable signature overlays
   */
  let { editor } = $props<{
    /** Main PDF editor state instance */
    editor: PdfEditorState;
  }>();

  /**
   * Initialize PDF preview container
   * Sets up resize observer and container for PDF display
   * @param element - Container element for PDF preview
   */
  function initPdfContainer(element: HTMLDivElement): void {
    editor.initPdfContainer(element);
  }

  /**
   * Handle keyboard events for signature elements
   * @param e - Keyboard event
   * @param index - Index of signature element
   */
  function handleSignatureKeyDown(e: KeyboardEvent, index: number): void {
    editor.handleSignatureKeyDown(e, index);
  }

  /**
   * Start dragging a signature element
   * @param e - Mouse or touch event
   * @param index - Index of signature to drag
   */
  function startDrag(e: MouseEvent | TouchEvent, index: number): void {
    editor.startDrag(e, index);
  }

  /**
   * Start resizing a signature element
   * @param e - Mouse or touch event
   * @param index - Index of signature to resize
   */
  function startResize(e: MouseEvent | TouchEvent, index: number): void {
    editor.startResize(e, index);
  }

  /**
   * Remove a signature from the current page
   * @param index - Index of signature to remove
   */
  function removeSignature(index: number): void {
    editor.removeSignature(index);
  }
</script>

<!-- Global Event Listeners for Dragging -->
<svelte:window
  onmousemove={(e) => {
    editor.handleDrag(e);
    editor.handleResize(e);
  }}
  onmouseup={() => editor.stopDrag()}
  ontouchmove={(e) => {
    editor.handleDrag(e);
    editor.handleResize(e);
  }}
  ontouchend={() => editor.stopDrag()}
/>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">PDF Preview</h2>

    <!-- Page Navigation -->
    {#if editor.pdfPages.length > 1}
      <div class="flex justify-center mb-4">
        <div class="btn-group">
          <button
            class="btn"
            disabled={editor.currentPage === 0}
            onclick={() => editor.currentPage--}
          >
            Previous
          </button>
          <button class="btn btn-active">
            Page {editor.currentPage + 1} of {editor.pdfPages.length}
          </button>
          <button
            class="btn"
            disabled={editor.currentPage === editor.pdfPages.length - 1}
            onclick={() => editor.currentPage++}
          >
            Next
          </button>
        </div>
      </div>
    {/if}

    <!-- PDF Preview Container -->
    <div class="relative bg-white rounded-lg overflow-hidden outline-none">
      <div use:initPdfContainer class="relative">
        <img
          src={editor.currentPageImage}
          alt="PDF Page {editor.currentPage + 1}"
          class="w-full h-auto"
        />

        <!-- Rendered Signatures -->
        {#each editor.currentSignatures as sig, index (index)}
          {@const dimensions = editor.dragDropManager.getContainerDimensions()}
          <!-- 
            Main Signature Element:
            Interactive, so role="button" with keyboard support.
          -->
          <div
            class="absolute border-2 border-blue-500 cursor-move focus:ring-2 focus:ring-blue-700 focus:outline-none"
            style="left: {editor.percentToPixels(
              sig.xPercent,
              dimensions.width,
            )}px; top: {editor.percentToPixels(
              sig.yPercent,
              dimensions.height,
            )}px; width: {editor.percentToPixels(
              sig.widthPercent,
              dimensions.width,
            )}px; height: {editor.percentToPixels(
              sig.heightPercent,
              dimensions.height,
            )}px;"
            role="button"
            tabindex="0"
            aria-label="Signature {index +
              1}. Use mouse to drag, or Delete key to remove."
            onmousedown={(e) => startDrag(e, index)}
            ontouchstart={(e) => startDrag(e, index)}
            onkeydown={(e) => handleSignatureKeyDown(e, index)}
          >
            <img
              src={sig.image}
              alt="Signature"
              class="w-full h-full"
            />

            <!-- Resize Handle -->
            <!-- 
              FIX: Changed from <div> to <button> to satisfy a11y rules.
              Removed 'role' because <button> implies semantics.
              Added type="button" to prevent form submission.
            -->
            <button
              type="button"
              class="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize p-0 border-none outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Resize signature"
              onmousedown={(e) => startResize(e, index)}
              ontouchstart={(e) => startResize(e, index)}
            ></button>

            <!-- Remove Button -->
            <button
              class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center z-10"
              onclick={(e) => {
                e.stopPropagation();
                removeSignature(index);
              }}
              aria-label="Remove signature"
            >
              ×
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .resize-handle {
    border-top-left-radius: 2px;
  }
</style>