<script lang="ts">
	import { onMount } from 'svelte';
	import { PDFDocument } from 'pdf-lib';
	import FormFieldComponent from '$lib/components/FormField.svelte';
	import { PDFLoader } from '$lib/pdf-loader';
	import { SignatureManager, type Signature } from '$lib/signature-manager';
	import { DragDropManager } from '$lib/drag-drop-manager';
	import { FormFieldManager } from '$lib/form-field-manager';

	// Lazy load PDF libraries to reduce initial bundle size
	let pdfjsLib: typeof import('pdfjs-dist');
	let pdfLibLoaded = $state(false);
	let pdfjsLibLoaded = $state(false);

	// Managers
	let pdfLoader: PDFLoader;
	let signatureManager: SignatureManager | null = $state(null);
	let dragDropManager: $state<DragDropManager>;
	let formFieldManager: FormFieldManager;

	// State
	let pdfFile: File | null = $state(null);
	let pdfPages: string[] = $state([]);
	let currentPage = $state(0);
	let signatureMode: 'draw' | 'upload' = $state('draw');
	let pageDimensions = $state<Array<{width: number, height: number}>>([]);
	let signatures = $state<Signature[]>([]);
	let canvas: $state<HTMLCanvasElement>;
	let pdfPreviewContainer: $state<HTMLDivElement | null>;

	// Form state from manager
	let formFields = $state<any[]>([]);
	let formData = $state<Record<string, any>>({});
	let showFormPanel = $state(false);
	let formErrors = $state<Record<string, string>>({});

	/**
	 * Initialize managers when PDF libraries are loaded
	 */
	function initializeManagers() {
		if (!pdfjsLib) return;

		pdfLoader = new PDFLoader(pdfjsLib);
		dragDropManager = new DragDropManager(null);
		formFieldManager = new FormFieldManager();
	}

	/**
	 * Initialize signature manager when canvas is ready
	 */
	function initSignatureManager(element: HTMLCanvasElement) {
		canvas = element;
		signatureManager = new SignatureManager(canvas);
		
		// Update container dimensions for signature manager
		const dimensions = dragDropManager.getContainerDimensions();
		signatureManager.setContainerDimensions(dimensions.width, dimensions.height);
	}

	/**
	 * Initialize PDF preview container and set up resize observer
	 */
	function initPdfContainer(element: HTMLDivElement) {
		pdfPreviewContainer = element;
		dragDropManager.setContainer(element);
		dragDropManager.updateContainerDimensions();

		// Update signature manager container dimensions
		if (signatureManager) {
			const dimensions = dragDropManager.getContainerDimensions();
			signatureManager.setContainerDimensions(dimensions.width, dimensions.height);
		}

		return dragDropManager.setupResizeObserver();
	}

	/**
	 * Load PDF with new modular approach
	 */
	async function loadPDF(file: File) {
		if (!pdfLibLoaded || !pdfjsLibLoaded || !pdfLoader) {
			alert('PDF libraries are still loading. Please wait a moment and try again.');
			return;
		}

		try {
			// Validate file
			const validation = pdfLoader.validateFile(file);
			if (!validation.valid) {
				alert(validation.error);
				return;
			}

			// Load PDF using the new loader (this fixes ArrayBuffer detachment)
			const loadedPDF = await pdfLoader.loadPDF(file);

			// Update state
			pdfPages = loadedPDF.pages;
			pageDimensions = loadedPDF.dimensions;
			currentPage = 0;

			// Detect form fields using the loaded pdf-lib document
			await formFieldManager.detectFormFields(loadedPDF.pdfDoc);

			// Update form state
			const formState = formFieldManager.getFormState();
			formFields = formState.formFields;
			formData = formState.formData;
			showFormPanel = formState.showFormPanel;
			formErrors = formState.formErrors;

		} catch (error) {
			console.error('Failed to load PDF:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			alert(`Failed to load PDF: ${errorMessage}. Please check the file and try again.`);
		}
	}

	/**
	 * Handle file upload
	 */
	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		pdfFile = file;
		await loadPDF(file);
	}

	/**
	 * Handle drag and drop
	 */
	async function handleDrop(event: DragEvent) {
		try {
			const file = await dragDropManager.handleFileDrop(event);
			if (file) {
				pdfFile = file;
				await loadPDF(file);
			}
		} catch (error) {
			console.error('File drop error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			alert(errorMessage);
		}
	}

	/**
	 * Handle drag over
	 */
	function handleDragOver(event: DragEvent) {
		dragDropManager.handleDragOver(event);
	}

	/**
	 * Handle form field value changes
	 */
	function handleFieldValueChange(fieldName: string, value: any) {
		formFieldManager.handleFieldValueChange(fieldName, value);
		const formState = formFieldManager.getFormState();
		formData = formState.formData;
		formErrors = formState.formErrors;
	}

	/**
	 * Handle signature field requests
	 */
	function handleSignatureRequest() {
		formFieldManager.handleSignatureRequest();
	}

	// Signature drawing functions
	function startDrawing(e: MouseEvent | TouchEvent) {
		if (!signatureManager) return;
		signatureManager.startDrawing(e);
	}

	function draw(e: MouseEvent | TouchEvent) {
		if (!signatureManager) return;
		signatureManager.draw(e);
	}

	function stopDrawing() {
		if (!signatureManager) return;
		signatureManager.stopDrawing();
	}

	function clearSignature() {
		if (!signatureManager) return;
		signatureManager.clearSignature();
	}

	function saveDrawnSignature() {
		if (!signatureManager) return;
		signatureManager.saveDrawnSignature();
	}

	// Signature placement functions
	function addSignatureToPage() {
		if (!signatureManager) return;
		
		const newSignature = signatureManager.addSignatureToPage(currentPage);
		if (newSignature) {
			signatures = [...signatures, newSignature];
		}
	}

	function removeSignature(index: number) {
		signatures = signatures.filter((_, i) => i !== index);
	}

	// Drag and drop functions for signatures
	function startDrag(e: MouseEvent | TouchEvent, index: number) {
		dragDropManager.startDrag(e, index);
	}

	function handleDrag(e: MouseEvent | TouchEvent) {
		signatures = dragDropManager.onDrag(e, signatures);
	}

	function startResize(e: MouseEvent | TouchEvent, index: number) {
		dragDropManager.startResize(e, index, signatures);
	}

	function handleResize(e: MouseEvent | TouchEvent) {
		signatures = dragDropManager.onResize(e, signatures);
	}

	function stopDrag() {
		dragDropManager.stopDrag();
	}

	// Utility functions
	function percentToPixels(percent: number, dimension: number): number {
		return (percent / 100) * dimension;
	}

	function pixelsToPercent(pixels: number, dimension: number): number {
		return (pixels / dimension) * 100;
	}

	/**
	 * Download signed PDF
	 */
	async function downloadSignedPDF() {
		if (!pdfFile || !pdfLibLoaded) {
			alert('PDF libraries are still loading. Please wait a moment and try again.');
			return;
		}

		try {
			// Validate form if there are form fields
			if (formFields.length > 0) {
				const isValid = formFieldManager.validateForm();
				if (!isValid) {
					const formState = formFieldManager.getFormState();
					const errorCount = Object.keys(formState.formErrors).length;
					alert(`Please fix ${errorCount} form error${errorCount > 1 ? 's' : ''} before downloading.`);
					return;
				}
			}

			// Load PDF using the loader to get pdf-lib document
			const loadedPDF = await pdfLoader.loadPDF(pdfFile);
			let pdfDoc = loadedPDF.pdfDoc;

			// Fill form data if any fields exist
			if (formFields.length > 0) {
				await formFieldManager.fillForm(pdfDoc);
			}

			// Embed signatures
			if (signatureManager && signatures.length > 0) {
				await signatureManager.embedSignatures(pdfDoc, signatures);
			}

			// Save and download
			const pdfBytes = await pdfDoc.save();
			const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'completed-' + (pdfFile?.name || 'document.pdf');
			a.click();
			URL.revokeObjectURL(url);

		} catch (error) {
			console.error('Failed to download PDF:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			alert(`Failed to download PDF: ${errorMessage}`);
		}
	}

	/**
	 * Reset everything
	 */
	function resetAll() {
		pdfFile = null;
		pdfPages = [];
		signatures = [];
		currentPage = 0;
		formFieldManager.resetForm();
		const formState = formFieldManager.getFormState();
		formFields = formState.formFields;
		formData = formState.formData;
		showFormPanel = formState.showFormPanel;
		formErrors = formState.formErrors;
		if (signatureManager) {
			signatureManager.clearSignature();
		}
	}

	onMount(async () => {
		// Load PDF libraries dynamically
		try {
			pdfjsLib = await import('pdfjs-dist');
			pdfLibLoaded = true;
			pdfjsLibLoaded = true;
			
			// Initialize managers after libraries are loaded
			initializeManagers();
		} catch (error) {
			console.error('Failed to load PDF libraries:', error);
		}
	});
</script>

<div class="min-h-screen bg-base-200 p-4">
	<div class="max-w-7xl mx-auto">
		<h1 class="text-3xl font-bold text-center mb-8">Signatura - PDF Signature Tool</h1>

		{#if !pdfFile}
			<!-- File Upload Area -->
			<div class="card bg-base-100 shadow-xl mb-8">
				<div class="card-body">
					<h2 class="card-title">Upload PDF</h2>
		<div 
			class="border-2 border-dashed border-base-300 rounded-lg p-8 text-center"
			role="button"
			tabindex="0"
			aria-label="Drop PDF file here"
			ondrop={handleDrop}
			ondragover={handleDragOver}
		>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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
		{:else}
			<!-- Main Content Area -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- PDF Preview Area -->
				<div class="lg:col-span-2">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">PDF Preview</h2>
							
							<!-- Page Navigation -->
							{#if pdfPages.length > 1}
								<div class="flex justify-center mb-4">
									<div class="btn-group">
										<button 
											class="btn"
											disabled={currentPage === 0}
											onclick={() => currentPage--}
										>
											Previous
										</button>
										<button class="btn btn-active">
											Page {currentPage + 1} of {pdfPages.length}
										</button>
										<button 
											class="btn"
											disabled={currentPage === pdfPages.length - 1}
											onclick={() => currentPage++}
										>
											Next
										</button>
									</div>
								</div>
							{/if}

							<!-- PDF Preview Container -->
							<div 
								bind:this={pdfPreviewContainer}
								class="relative bg-white rounded-lg overflow-hidden"
								role="region"
								aria-label="PDF preview with signatures"
								onmousemove={(e) => { handleDrag(e); handleResize(e); }}
								onmouseup={stopDrag}
								onmouseleave={stopDrag}
								ontouchmove={(e) => { handleDrag(e); handleResize(e); }}
								ontouchend={stopDrag}
							>
								<img 
									src={pdfPages[currentPage]} 
									alt="PDF Page {currentPage + 1}"
									class="w-full h-auto"
								/>
								
								<!-- Rendered Signatures -->
								{#each signatures as sig, index (index)}
									{#if sig.page === currentPage}
										{@const dimensions = dragDropManager.getContainerDimensions()}
										<div
											class="absolute border-2 border-blue-500 cursor-move"
											style="left: {percentToPixels(sig.xPercent, dimensions.width)}px; top: {percentToPixels(sig.yPercent, dimensions.height)}px; width: {percentToPixels(sig.widthPercent, dimensions.width)}px; height: {percentToPixels(sig.heightPercent, dimensions.height)}px;"
											role="button"
											tabindex="0"
											aria-label="Drag signature to reposition"
											onmousedown={(e) => startDrag(e, index)}
											ontouchstart={(e) => startDrag(e, index)}
										>
											<img src={sig.image} alt="Signature" class="w-full h-full" />
											
											<!-- Resize Handle -->
											<div
												class="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
												role="button"
												tabindex="0"
												aria-label="Resize signature"
												onmousedown={(e) => startResize(e, index)}
												ontouchstart={(e) => startResize(e, index)}
											></div>
											
											<!-- Remove Button -->
											<button
												class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
												onclick={() => removeSignature(index)}
											>
												×
											</button>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					</div>
				</div>

				<!-- Side Panel -->
				<div class="space-y-6">
					<!-- Form Fields Panel -->
					{#if showFormPanel}
						<div class="card bg-base-100 shadow-xl">
							<div class="card-body">
								<h2 class="card-title">Form Fields</h2>
								<div class="space-y-4 max-h-96 overflow-y-auto">
									{#each formFields as field (field.name)}
										<FormFieldComponent 
											field={field}
											value={formData[field.name]}
											onValueChange={handleFieldValueChange}
											onSignatureRequest={handleSignatureRequest}
										/>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Signature Panel -->
					<div class="card bg-base-100 shadow-xl" data-signature-panel>
						<div class="card-body">
							<h2 class="card-title">Signature</h2>
							
							<!-- Signature Mode Toggle -->
							<div class="tabs tabs-boxed mb-4">
								<button 
									class="tab {signatureMode === 'draw' ? 'tab-active' : ''}"
									onclick={() => signatureMode = 'draw'}
								>
									Draw
								</button>
								<button 
									class="tab {signatureMode === 'upload' ? 'tab-active' : ''}"
									onclick={() => signatureMode = 'upload'}
								>
									Upload
								</button>
							</div>

							{#if signatureMode === 'draw'}
								<!-- Drawing Canvas -->
								<div class="mb-4">
										<canvas 
											bind:this={canvas}
											width={300}
											height={150}
											class="border border-gray-300 rounded w-full"
											use:initSignatureManager
											onmousedown={startDrawing}
											onmousemove={draw}
											onmouseup={stopDrawing}
											onmouseleave={stopDrawing}
											ontouchstart={startDrawing}
											ontouchmove={draw}
											ontouchend={stopDrawing}
										></canvas>
								</div>
								
								<div class="card-actions">
									<button class="btn btn-outline btn-sm" onclick={clearSignature}>
										Clear
									</button>
									<button class="btn btn-primary btn-sm" onclick={saveDrawnSignature}>
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
										onchange={(e) => {
											const file = (e.target as HTMLInputElement).files?.[0];
											if (file && signatureManager) {
												const reader = new FileReader();
												reader.onload = (event) => {
													signatureManager!.setSignatureImage(event.target?.result as string);
												};
												reader.readAsDataURL(file);
											}
										}}
									/>
								</div>
							{/if}

							<!-- Add Signature to Page -->
							<div class="card-actions">
								<button 
									class="btn btn-success btn-block"
									onclick={addSignatureToPage}
									disabled={!signatureManager?.getSignatureImage()}
								>
									Add Signature to Page
								</button>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">Finish</h2>
							<div class="card-actions flex-col">
								<button
									class="btn btn-success btn-block"
									disabled={signatures.length === 0 && formFields.length === 0}
									onclick={downloadSignedPDF}
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									{signatures.length > 0 ? 'Download Signed PDF' : 'Download Completed PDF'}
								</button>
								<button
									class="btn btn-outline btn-block"
									onclick={resetAll}
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									Start Over
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.resize-handle {
		border-top-left-radius: 2px;
	}
</style>