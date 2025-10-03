<script lang="ts">
	import { PDFDocument, rgb } from 'pdf-lib';
	import { onMount } from 'svelte';
	import * as pdfjsLib from 'pdfjs-dist';

	let pdfFile: File | null = $state(null);
	let pdfPages: string[] = $state([]);
	let currentPage = $state(0);
	let signatureMode: 'draw' | 'upload' = $state('draw');
	let signatureImage: string | null = $state(null);
	let isDrawing = $state(false);
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;

	// Signature placement state
	let signatures: Array<{
		image: string;
		x: number;
		y: number;
		width: number;
		height: number;
		page: number;
	}> = $state([]);

	let isDragging = $state(false);
	let isResizing = $state(false);
	let dragIndex = $state(-1);
	let dragStart = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, width: 0, height: 0 });

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
		pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.mjs',
			import.meta.url
		).toString();
	});

	/**
	 * Load and render PDF pages
	 */
	async function loadPDF(file: File) {
		if (!pdfjsLib) return;
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		const pages: string[] = [];
		for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const viewport = page.getViewport({ scale: 1.5 });

			const tempCanvas = document.createElement('canvas');
			const context = tempCanvas.getContext('2d')!;
			tempCanvas.width = viewport.width;
			tempCanvas.height = viewport.height;

			await page.render({ canvasContext: context, viewport, canvas: tempCanvas }).promise;
			pages.push(tempCanvas.toDataURL());
		}

		pdfPages = pages;
		currentPage = 0;
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
	function startDrawing(e: MouseEvent) {
		if (!ctx) return;
		isDrawing = true;
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		ctx.beginPath();
		ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
	}

	/**
	 * Draw signature
	 */
	function draw(e: MouseEvent) {
		if (!isDrawing || !ctx) return;
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
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
		if (!signatureImage) return;

		signatures.push({
			image: signatureImage,
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			page: currentPage
		});
		signatures = signatures; // Trigger reactivity
	}

	/**
	 * Start dragging signature
	 */
	function startDrag(e: MouseEvent, index: number) {
		if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

		isDragging = true;
		dragIndex = index;
		dragStart = { x: e.clientX - signatures[index].x, y: e.clientY - signatures[index].y };
	}

	/**
	 * Drag signature
	 */
	function onDrag(e: MouseEvent) {
		if (isDragging && dragIndex >= 0) {
			signatures[dragIndex].x = e.clientX - dragStart.x;
			signatures[dragIndex].y = e.clientY - dragStart.y;
			signatures = signatures;
		} else if (isResizing && dragIndex >= 0) {
			const dx = e.clientX - resizeStart.x;
			const dy = e.clientY - resizeStart.y;
			signatures[dragIndex].width = Math.max(50, resizeStart.width + dx);
			signatures[dragIndex].height = Math.max(25, resizeStart.height + dy);
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
	function startResize(e: MouseEvent, index: number) {
		e.stopPropagation();
		isResizing = true;
		dragIndex = index;
		resizeStart = {
			x: e.clientX,
			y: e.clientY,
			width: signatures[index].width,
			height: signatures[index].height
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

		const arrayBuffer = await pdfFile.arrayBuffer();
		const pdfDoc = await PDFDocument.load(arrayBuffer);
		const pages = pdfDoc.getPages();

		// Get the original PDF to calculate scale factor
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		for (const sig of signatures) {
			const page = pages[sig.page];
			const { width: pdfWidth, height: pdfHeight } = page.getSize();

			// Get rendered page dimensions (with scale 1.5)
			const renderedPage = await pdf.getPage(sig.page + 1);
			const viewport = renderedPage.getViewport({ scale: 1.5 });

			// Calculate scale factor from rendered to original PDF
			const scaleX = pdfWidth / viewport.width;
			const scaleY = pdfHeight / viewport.height;

			// Convert data URL to bytes
			const base64Data = sig.image.split(',')[1];
			const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
			const image = await pdfDoc.embedPng(imageBytes);

			// Scale coordinates and dimensions to match original PDF
			const scaledX = sig.x * scaleX;
			const scaledY = sig.y * scaleY;
			const scaledWidth = sig.width * scaleX;
			const scaledHeight = sig.height * scaleY;

			// Add signature to page (flip Y coordinate for PDF)
			page.drawImage(image, {
				x: scaledX,
				y: pdfHeight - scaledY - scaledHeight,
				width: scaledWidth,
				height: scaledHeight
			});
		}

		const pdfBytes = await pdfDoc.save();
		const blob = new Blob([pdfBytes], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'signed-' + (pdfFile?.name || 'document.pdf');
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:window on:mousemove={onDrag} on:mouseup={stopDrag} />

<div class="min-h-screen bg-base-200">
	<div class="container mx-auto p-8">
		<h1 class="text-4xl font-bold text-center mb-8">PDF Signer</h1>

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
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- PDF Preview -->
				<div class="lg:col-span-2">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<h2 class="card-title">Document Preview</h2>

							{#if pdfPages[currentPage]}
								<div class="relative border-2 border-base-300 rounded-lg overflow-hidden">
									<img src={pdfPages[currentPage]} alt="PDF Page" class="w-full" />

									<!-- Signature Overlays -->
									{#each signatures.filter(s => s.page === currentPage) as sig, i}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="absolute cursor-move border-2 border-primary"
											style="left: {sig.x}px; top: {sig.y}px; width: {sig.width}px; height: {sig.height}px;"
											onmousedown={(e) => startDrag(e, signatures.indexOf(sig))}
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
												role="button"
												tabindex="0"
												aria-label="Resize signature"
											></div>
										</div>
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
									disabled={signatures.length === 0}
									onclick={downloadSignedPDF}
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									Download Signed PDF
								</button>
								<button
									class="btn btn-outline btn-block"
									onclick={() => {
										pdfFile = null;
										pdfPages = [];
										signatures = [];
										signatureImage = null;
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
