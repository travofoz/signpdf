<script lang="ts">
  /**
   * PDF file uploader component
   * Handles drag-and-drop and file selection for PDF uploads
   */
  let { onUpload } = $props<{
    /** Callback function when a file is selected */
    onUpload: (file: File) => void;
  }>();

  /**
   * Handle file selection from input element
   * @param event - File input change event
   */
  function handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    onUpload(file);
  }

  /**
   * Handle file drop event
   * @param event - Drag and drop event containing file data
   */
  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    onUpload(file);
  }

  /**
   * Handle drag over event to prevent default browser behavior
   * @param event - Drag over event
   */
  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }
</script>

<div class="card bg-base-100 shadow-xl mb-8">
  <div class="card-body">
    <h2 class="card-title">Upload PDF</h2>
    <!-- NOTE: Role 'button' is valid here because we provide keyboard activation via the input inside it -->
    <div
      class="border-2 border-dashed border-base-300 rounded-lg p-8 text-center"
      role="button"
      tabindex="0"
      aria-label="Drop PDF file here or click to browse"
      ondrop={handleDrop}
      ondragover={handleDragOver}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-12 w-12 mx-auto mb-4 opacity-50"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p class="mb-2">Drag and drop your PDF here, or click to browse</p>
      <input
        type="file"
        accept=".pdf"
        class="file-input file-input-bordered w-full max-w-xs"
        onchange={handleFileUpload}
      />
    </div>
  </div>
</div>