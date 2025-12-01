<script lang="ts">
	import { PDFDocument } from 'pdf-lib';
	import { onMount } from 'svelte';
	import * as pdfjsLib from 'pdfjs-dist';
	import { PDFFormService, type FormField } from '$lib/pdf-form-service';
	import FormFieldComponent from '$lib/components/FormField.svelte';

	let pdfFile: File | null = $state(null);
	let pdfPages: string[] = $state([]);
	let currentPage = $state(0);
	let signatureMode: 'draw' | 'upload' = $state('draw');
	let signatureImage: string | null = $state(null);
	let isDrawing = $state(false);
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;

	// Form handling
	let formService = $state(new PDFFormService());
	let formFields = $state<FormField[]>([]);
	let formData = $state<Record<string, any>>({});
	let showFormPanel = $state(false);
	let formErrors = $state<Record<string, string>>({});

	// Signature placement state (stored as percentages for responsive positioning)
	let signatures: Array<{
		image: string;
		xPercent: number;
		yPercent: number;
		widthPercent: number;
		heightPercent: number;
		page: number;
	}> = $state([]);

	let isDragging = $state(false);
	let isResizing = $state(false);
	let dragIndex = $state(-1);
	let dragStart = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, width: 0, height: 0 });
	let pdfPreviewContainer: HTMLDivElement | null = null;
	let containerWidth = $state(0);
	let containerHeight = $state(0);

	/**
	 * Initialize PDF preview container and set up resize observer
	 */
	function initPdfContainer(element: HTMLDivElement) {
		pdfPreviewContainer = element;
		updateContainerDimensions();

		const resizeObserver = new ResizeObserver(() => {
			updateContainerDimensions();
		});
		resizeObserver.observe(element);

		return {
			destroy() {
				resizeObserver.disconnect();
			}
		};
	}

	/**
	 * Update container dimensions for responsive positioning
	 */
	function updateContainerDimensions() {
		if (!pdfPreviewContainer) return;
		containerWidth = pdfPreviewContainer.offsetWidth;
		containerHeight = pdfPreviewContainer.offsetHeight;
	}

	/**
	 * Convert percentage to pixels for display
	 */
	function percentToPixels(percent: number, dimension: number): number {
		return (percent / 100) * dimension;
	}

	/**
	 * Convert pixels to percentage for storage
	 */
	function pixelsToPercent(pixels: number, dimension: number): number {
		return (pixels / dimension) * 100;
	}

	/**
	 * Handle PDF file upload
	 */
	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;

		pdfFile = input.files[0];
		await loadPDF(pdfFile);
	}

	/**
	 * Handle drag and drop
	 */
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files[0];
		if (file && file.type === 'application/pdf') {
			pdfFile = file;
			loadPDF(file);
		}
	}

	/**
	 * Initialize PDF.js worker
	 */
	onMount(async () => {
		pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
	});

	/**
	 * Load and render PDF pages
	 */
	async function loadPDF(file: File) {
		if (!pdfjsLib) {
			console.error('PDF.js library not loaded');
			return;
		}

		try {
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

			const pages: string[] = [];
			const dimensions: Array<{width: number, height: number}> = [];

			for (let i = 1; i <= pdf.numPages; i++) {
				const page = await pdf.getPage(i);
				const viewport = page.getViewport({ scale: 1.5 });

				// Store the original page dimensions (in PDF points)
				dimensions.push({
					width: viewport.viewBox[2],
					height: viewport.viewBox[3]
				});

				const tempCanvas = document.createElement('canvas');
				const context = tempCanvas.getContext('2d')!;
				tempCanvas.width = viewport.width;
				tempCanvas.height = viewport.height;

				await page.render({ canvasContext: context, viewport, canvas: tempCanvas }).promise;
				pages.push(tempCanvas.toDataURL());
			}

			pdfPages = pages;
			pdfPageDimensions = dimensions;
			currentPage = 0;

			// Detect form fields
			await detectFormFields(arrayBuffer);
		} catch (error) {
			console.error('Failed to load PDF:', error);
			alert('Failed to load PDF. Please check the file and try again.');
		}
	}

	/**
	 * Detect form fields in the PDF
	 */
	async function detectFormFields(arrayBuffer: ArrayBuffer) {
		try {
			await formService.loadDocument(arrayBuffer);
			const fields = formService.detectFormFields();
			
			if (fields.length > 0) {
				formFields = fields;
				formData = fields.reduce((acc, field) => {
					acc[field.name] = field.value;
					return acc;
				}, {} as Record<string, any>);
				showFormPanel = true;
			} else {
				formFields = [];
				formData = {};
				showFormPanel = false;
			}
		} catch (error) {
			console.warn('Failed to detect form fields:', error);
			formFields = [];
			formData = {};
			showFormPanel = false;
		}
	}

	/**
	 * Handle form field value changes
	 */
	function handleFieldValueChange(fieldName: string, value: any) {
		formData[fieldName] = value;
		
		// Clear any existing error for this field
		if (formErrors[fieldName]) {
			delete formErrors[fieldName];
			formErrors = formErrors;
		}
	}

	/**
	 * Validate all form fields
	 */
	function validateForm(): boolean {
		const errors: Record<string, string> = {};
		let isValid = true;

		formFields.forEach(field => {
			const result = formService.validateField(field, formData[field.name]);
			if (!result.valid) {
				errors[field.name] = result.error || 'Invalid value';
				isValid = false;
			}
		});

		formErrors = errors;
		return isValid;
	}

	// Store PDF page dimensions for accurate coordinate conversion
	let pdfPageDimensions: Array<{width: number, height: number}> = $state([]);

	/**
	 * Check if field has bounds on current page
	 */
	function hasFieldOnPage(field: FormField, pageNum: number): boolean {
		if (!field.bounds) return false;

		// Check if field has a page property, otherwise assume page 0
		const fieldPage = (field.bounds as any).page ?? 0;
		return fieldPage === pageNum;
	}

	/**
	 * Get field bounds for current page with accurate coordinate conversion
	 */
	function getFieldBoundsForPage(field: FormField, pageNum: number): {xPercent: number, yPercent: number, widthPercent: number, heightPercent: number} | null {
		if (!field.bounds || !hasFieldOnPage(field, pageNum)) return null;

		// Get actual page dimensions for accurate conversion
		const pageDim = pdfPageDimensions[pageNum];
		if (!pageDim) return null;

		const { x, y, width, height } = field.bounds;

		// Convert PDF coordinates (bottom-left origin) to web coordinates (top-left origin)
		// PDF coordinate system: (0,0) = bottom-left
		// Web coordinate system: (0,0) = top-left
		const adjustedY = pageDim.height - y - height;

		return {
			xPercent: (x / pageDim.width) * 100,
			yPercent: (adjustedY / pageDim.height) * 100,
			widthPercent: (width / pageDim.width) * 100,
			heightPercent: (height / pageDim.height) * 100
		};
	}

	/**
	 * Focus on a specific form field
	 */
	function focusFormField(fieldName: string) {
		const element = document.querySelector(`[data-field-name="${fieldName}"]`) as HTMLElement;
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			element.focus();
		}
	}

	/**
	 * Initialize signature canvas
	 */
	function initCanvas(element: HTMLCanvasElement) {
		canvas = element;
		ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
		}
	}

	/**
	 * Start drawing signature
	 */
	function startDrawing(e: MouseEvent | TouchEvent) {
		if (!ctx) return;
		e.preventDefault();
		isDrawing = true;
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
		const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

		ctx.beginPath();
		ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
	}

	/**
	 * Draw signature
	 */
	function draw(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !ctx) return;
		e.preventDefault();
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
		const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

		ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
		ctx.stroke();
	}

	/**
	 * Stop drawing signature
	 */
	function stopDrawing() {
		isDrawing = false;
	}

	/**
	 * Clear signature canvas
	 */
	function clearSignature() {
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		signatureImage = null;
	}

	/**
	 * Save drawn signature
	 */
	function saveDrawnSignature() {
		signatureImage = canvas.toDataURL('image/png');
	}

	/**
	 * Handle signature image upload
	 */
	function handleSignatureUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			signatureImage = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	/**
	 * Add signature to current page
	 */
	function addSignatureToPage() {
		if (!signatureImage || !containerWidth || !containerHeight) return;

		// Start at center with default size (as percentages)
		signatures.push({
			image: signatureImage,
			xPercent: 20,
			yPercent: 20,
			widthPercent: 30,
			heightPercent: 15,
			page: currentPage
		});
		signatures = signatures; // Trigger reactivity
	}

	/**
	 * Start dragging signature
	 */
	function startDrag(e: MouseEvent | TouchEvent, index: number) {
		if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
		if (!pdfPreviewContainer) return;

		e.preventDefault();
		isDragging = true;
		dragIndex = index;

		const rect = pdfPreviewContainer.getBoundingClientRect();
		const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
		const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

		const currentPixelX = percentToPixels(signatures[index].xPercent, containerWidth);
		const currentPixelY = percentToPixels(signatures[index].yPercent, containerHeight);

		dragStart = {
			x: clientX - rect.left - currentPixelX,
			y: clientY - rect.top - currentPixelY
		};
	}

	/**
	 * Drag signature
	 */
	function onDrag(e: MouseEvent | TouchEvent) {
		if (!pdfPreviewContainer) return;

		const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0]?.clientX;
		const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0]?.clientY;

		if (!clientX || !clientY) return;

		const rect = pdfPreviewContainer.getBoundingClientRect();

		if (isDragging && dragIndex >= 0) {
			const newPixelX = clientX - rect.left - dragStart.x;
			const newPixelY = clientY - rect.top - dragStart.y;

			signatures[dragIndex].xPercent = pixelsToPercent(newPixelX, containerWidth);
			signatures[dragIndex].yPercent = pixelsToPercent(newPixelY, containerHeight);
			signatures = signatures;
		} else if (isResizing && dragIndex >= 0) {
			const newPixelX = clientX - rect.left;
			const newPixelY = clientY - rect.top;

			const dx = newPixelX - resizeStart.x;
			const dy = newPixelY - resizeStart.y;

			const newWidth = Math.max(50, resizeStart.width + dx);
			const newHeight = Math.max(25, resizeStart.height + dy);

			signatures[dragIndex].widthPercent = pixelsToPercent(newWidth, containerWidth);
			signatures[dragIndex].heightPercent = pixelsToPercent(newHeight, containerHeight);
			signatures = signatures;
		}
	}

	/**
	 * Stop dragging
	 */
	function stopDrag() {
		isDragging = false;
		isResizing = false;
		dragIndex = -1;
	}

	/**
	 * Start resizing signature
	 */
	function startResize(e: MouseEvent | TouchEvent, index: number) {
		if (!pdfPreviewContainer) return;

		e.stopPropagation();
		e.preventDefault();
		isResizing = true;
		dragIndex = index;

		const rect = pdfPreviewContainer.getBoundingClientRect();
		const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
		const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

		resizeStart = {
			x: clientX - rect.left,
			y: clientY - rect.top,
			width: percentToPixels(signatures[index].widthPercent, containerWidth),
			height: percentToPixels(signatures[index].heightPercent, containerHeight)
		};
	}

	/**
	 * Remove signature
	 */
	function removeSignature(index: number) {
		signatures.splice(index, 1);
		signatures = signatures;
	}

	/**
	 * Download signed PDF
	 */
	async function downloadSignedPDF() {
		if (!pdfFile) return;

		// Validate form if there are form fields
		if (formFields.length > 0 && !validateForm()) {
			alert('Please fix the form errors before downloading.');
			return;
		}

		const arrayBuffer = await pdfFile.arrayBuffer();
		
		// Load document with form service to handle form data
		await formService.loadDocument(arrayBuffer);
		
		// Fill form data if any fields exist
		if (formFields.length > 0) {
			await formService.fillForm(formData);
		}

		// Get the modified PDF with form data
		let pdfBytes = await formService.saveDocument();
		
		// Load the modified PDF to add signatures
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const pages = pdfDoc.getPages();

		for (const sig of signatures) {
			const page = pages[sig.page];
			const { width: pdfWidth, height: pdfHeight } = page.getSize();

			// Convert data URL to bytes
			const base64Data = sig.image.split(',')[1];
			const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
			const image = await pdfDoc.embedPng(imageBytes);

			// Convert percentages to PDF coordinates
			const x = (sig.xPercent / 100) * pdfWidth;
			const y = (sig.yPercent / 100) * pdfHeight;
			const width = (sig.widthPercent / 100) * pdfWidth;
			const height = (sig.heightPercent / 100) * pdfHeight;

			// Add signature to page (flip Y coordinate for PDF coordinate system)
			page.drawImage(image, {
				x,
				y: pdfHeight - y - height,
				width,
				height
			});
		}

		pdfBytes = await pdfDoc.save();
		const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'completed-' + (pdfFile?.name || 'document.pdf');
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:window on:mousemove={onDrag} on:mouseup={stopDrag} on:touchmove={onDrag} on:touchend={stopDrag} on:touchcancel={stopDrag} />

<div class="min-h-screen bg-base-200">
	<div class="container mx-auto p-8">
		<h1 class="text-4xl font-bold text-center mb-8">Signatura</h1>

		{#if !pdfFile}
			<!-- Upload Section -->
			<div
				class="card bg-base-100 w-full max-w-2xl mx-auto shadow-xl"
				ondrop={handleDrop}
				ondragover={(e) => e.preventDefault()}
				role="region"
			>
				<div class="card-body">
					<h2 class="card-title">Upload PDF Document</h2>
					<fieldset class="fieldset">
						<label class="label" for="pdf-upload">
							<span class="label-text">Choose a PDF file to sign</span>
						</label>
						<input
							id="pdf-upload"
							type="file"
							accept="application/pdf"
							class="file-input file-input-bordered file-input-primary w-full"
							onchange={handleFileUpload}
						/>
						<div class="label">
							<span class="label-text-alt">Or drag and drop your PDF anywhere on this card</span>
						</div>
					</fieldset>
				</div>
			</div>
		{:else}
			<!-- Main Editor -->
			<div class="grid grid-cols-1 {showFormPanel ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6">
				<!-- PDF Preview -->
				<div class="{showFormPanel ? 'lg:col-span-2' : 'lg:col-span-2'}">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">Document Preview</h2>

							{#if pdfPages[currentPage]}
								<div class="relative border-2 border-base-300 rounded-lg overflow-hidden" use:initPdfContainer>
									<img src={pdfPages[currentPage]} alt="PDF Page" class="w-full" />

									<!-- Signature Overlays -->
									{#each signatures.filter(s => s.page === currentPage) as sig, i}
										{@const x = percentToPixels(sig.xPercent, containerWidth)}
										{@const y = percentToPixels(sig.yPercent, containerHeight)}
										{@const width = percentToPixels(sig.widthPercent, containerWidth)}
										{@const height = percentToPixels(sig.heightPercent, containerHeight)}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="absolute cursor-move border-2 border-primary"
											style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; touch-action: none;"
											onmousedown={(e) => startDrag(e, signatures.indexOf(sig))}
											ontouchstart={(e) => startDrag(e, signatures.indexOf(sig))}
											role="button"
											tabindex="0"
											aria-label="Drag signature to reposition"
										>
											<img src={sig.image} alt="Signature" class="w-full h-full object-contain" />
											<button
												class="absolute -top-3 -right-3 btn btn-xs btn-error btn-circle"
												onclick={() => removeSignature(signatures.indexOf(sig))}
											>✕</button>
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-primary cursor-se-resize"
												onmousedown={(e) => startResize(e, signatures.indexOf(sig))}
												ontouchstart={(e) => startResize(e, signatures.indexOf(sig))}
												role="button"
												tabindex="0"
												aria-label="Resize signature"
											></div>
										</div>
									{/each}

									<!-- Form Field Overlays -->
									{#each formFields.filter(field => hasFieldOnPage(field, currentPage)) as field}
										{@const bounds = getFieldBoundsForPage(field, currentPage)}
										{#if bounds}
											{@const x = percentToPixels(bounds.xPercent, containerWidth)}
											{@const y = percentToPixels(bounds.yPercent, containerHeight)}
											{@const width = percentToPixels(bounds.widthPercent, containerWidth)}
											{@const height = percentToPixels(bounds.heightPercent, containerHeight)}
											<div
												class="absolute border-2 border-info bg-info/10 cursor-pointer hover:bg-info/20 transition-colors"
												style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
												onclick={() => focusFormField(field.name)}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														focusFormField(field.name);
													}
												}}
												role="button"
												tabindex="0"
												aria-label={`Form field: ${field.label || field.name}`}
												title={`${field.label || field.name} (${field.type})${field.required ? ' - Required' : ''}`}
											>
												<div class="absolute -top-6 left-0 bg-info text-info-content text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
													{field.label || field.name}
												</div>
											</div>
										{/if}
									{/each}
								</div>

								<!-- Page Navigation -->
								{#if pdfPages.length > 1}
									<div class="card-actions justify-center mt-6">
										<div class="join">
											<button
												class="btn btn-neutral join-item"
												disabled={currentPage === 0}
												onclick={() => currentPage--}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
												</svg>
												Previous
											</button>
											<button class="btn btn-neutral join-item no-animation">
												Page {currentPage + 1} of {pdfPages.length}
											</button>
											<button
												class="btn btn-neutral join-item"
												disabled={currentPage === pdfPages.length - 1}
												onclick={() => currentPage++}
											>
												Next
												<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</button>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>
				</div>

				<!-- Form Panel -->
				{#if showFormPanel}
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">Form Fields</h2>
							
							{#if formFields.length > 0}
								<div class="max-h-96 overflow-y-auto space-y-2">
									{#each formFields as field}
										<div class="form-field-container">
											<FormFieldComponent 
												field={field} 
												value={formData[field.name]}
												onValueChange={handleFieldValueChange}
											/>
											{#if formErrors[field.name]}
												<div class="text-error text-sm mt-1">
													{formErrors[field.name]}
												</div>
											{/if}
										</div>
									{/each}
								</div>
								
								<div class="card-actions mt-4">
									<button 
										class="btn btn-outline btn-sm"
										onclick={() => {
											formData = formFields.reduce((acc, field) => {
												acc[field.name] = field.value;
												return acc;
											}, {} as Record<string, any>);
											formErrors = {};
										}}
									>
										Reset Form
									</button>
								</div>
							{:else}
								<div class="text-center py-8 opacity-60">
									No form fields detected in this PDF
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Signature Panel -->
				<div class="space-y-4">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">Signature</h2>

							<!-- Mode Selection -->
							<div class="tabs tabs-boxed">
								<button
									class="tab"
									class:tab-active={signatureMode === 'draw'}
									onclick={() => signatureMode = 'draw'}
								>Draw</button>
								<button
									class="tab"
									class:tab-active={signatureMode === 'upload'}
									onclick={() => signatureMode = 'upload'}
								>Upload</button>
							</div>

							{#if signatureMode === 'draw'}
								<!-- Draw Signature -->
								<fieldset class="fieldset mt-4">
									<legend class="fieldset-legend">Draw your signature</legend>
									<canvas
										use:initCanvas
										width="600"
										height="300"
										class="border border-base-300 rounded-lg w-full cursor-crosshair bg-white"
										style="touch-action: none;"
										onmousedown={startDrawing}
										onmousemove={draw}
										onmouseup={stopDrawing}
										onmouseleave={stopDrawing}
										ontouchstart={startDrawing}
										ontouchmove={draw}
										ontouchend={stopDrawing}
										ontouchcancel={stopDrawing}
									></canvas>
									<div class="card-actions justify-end mt-4">
										<button class="btn btn-outline btn-sm" onclick={clearSignature}>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
											Clear
										</button>
										<button class="btn btn-primary btn-sm" onclick={saveDrawnSignature}>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											Save
										</button>
									</div>
								</fieldset>
							{:else}
								<!-- Upload Signature -->
								<fieldset class="fieldset mt-4">
									<legend class="fieldset-legend">Upload signature image</legend>
									<input
										id="signature-upload"
										type="file"
										accept="image/*"
										class="file-input file-input-bordered file-input-primary w-full"
										onchange={handleSignatureUpload}
									/>
									<div class="label">
										<span class="label-text-alt">PNG, JPG, or GIF format</span>
									</div>
								</fieldset>
							{/if}

							{#if signatureImage}
								<div class="divider">Preview</div>
								<div class="bg-white p-4 rounded-lg border border-base-300">
									<img src={signatureImage} alt="Signature Preview" class="w-full h-24 object-contain" />
								</div>
								<div class="card-actions mt-4">
									<button class="btn btn-primary btn-block" onclick={addSignatureToPage}>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
										</svg>
										Add to Current Page
									</button>
								</div>
							{/if}
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
									onclick={() => {
										pdfFile = null;
										pdfPages = [];
										signatures = [];
										signatureImage = null;
										formFields = [];
										formData = {};
										formErrors = {};
										showFormPanel = false;
									}}
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
