<script lang="ts">
  import { onMount } from "svelte";
  import { PdfEditorState } from '$lib/state/pdf-editor.svelte';
  import PdfUploader from '$lib/components/PdfUploader.svelte';
  import PdfWorkspace from '$lib/components/PdfWorkspace.svelte';
  import SignaturePad from '$lib/components/SignaturePad.svelte';
  import FormPanel from '$lib/components/FormPanel.svelte';
  import ActionPanel from '$lib/components/ActionPanel.svelte';

  /**
   * Main application page
   * Orchestrates PDF upload, signature placement, and form filling
   */
  // Create state instance
  const editor = new PdfEditorState();

  /**
   * Component mount handler
   * State initialization is handled in constructor
   */
  onMount(() => {
    // State initialization happens in constructor
  });
</script>

<div class="min-h-screen bg-base-200 p-4">
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold text-center mb-8">
      Signatura - PDF Signature Tool
    </h1>

    {#if !editor.pdfFile}
      <PdfUploader onUpload={(f) => editor.loadPDF(f)} />
    {:else}
      <!-- Main Content Area -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- PDF Preview Area -->
        <div class="lg:col-span-2">
          <PdfWorkspace {editor} />
        </div>

        <!-- Side Panel -->
        <div class="space-y-6">
          <FormPanel {editor} />
          <SignaturePad {editor} />
          <ActionPanel {editor} />
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Version tag at bottom -->
  <footer class="text-center text-xs text-gray-500 mt-8">
    v{editor.version}
  </footer>
</div>