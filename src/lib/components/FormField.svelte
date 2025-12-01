<script lang="ts">
	import type { FormField } from '$lib/pdf-form-service';

	let { field, value, onValueChange } = $props<{
		field: FormField;
		value: any;
		onValueChange: (fieldName: string, value: any) => void;
	}>();

	function handleChange(newValue: any) {
		onValueChange(field.name, newValue);
	}

	function requestSignature(fieldName: string) {
		// This will be handled by the parent component
		const event = new CustomEvent('requestSignature', { 
			detail: { fieldName } 
		});
		dispatchEvent(event);
	}

	function handleCheckboxChange(event: Event) {
		const target = event.target as HTMLInputElement;
		handleChange(target.checked);
	}

	function handleRadioChange(event: Event) {
		const target = event.target as HTMLInputElement;
		handleChange(target.value);
	}

	function handleSelectChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		if (field.type === 'list') {
			const selectedOptions = Array.from(target.selectedOptions, option => option.value);
			handleChange(selectedOptions);
		} else {
			handleChange(target.value);
		}
	}

	function handleTextInput(event: Event) {
		const target = event.target as HTMLInputElement;
		handleChange(target.value);
	}

	const fieldId = $derived(`field-${field.name.replace(/[^a-zA-Z0-9]/g, '-')}`);
</script>

<div class="form-field mb-4">
	{#if field.type === 'text'}
		<div class="form-control">
			<label for={fieldId} class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
			</label>
			<input
				id={fieldId}
				type="text"
				class="input input-bordered w-full"
				placeholder={field.name}
				value={value}
				oninput={handleTextInput}
				maxlength={field.maxLength}
				disabled={field.readOnly}
				required={field.required}
				data-field-name={field.name}
			/>
			{#if field.maxLength}
				<div class="label">
					<span class="label-text-alt text-xs opacity-60">
						{value?.length || 0}/{field.maxLength} characters
					</span>
				</div>
			{/if}
		</div>

	{:else if field.type === 'checkbox'}
		<div class="form-control">
			<label class="label cursor-pointer">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
				<input
					type="checkbox"
					class="checkbox checkbox-primary"
					checked={value}
					onchange={handleCheckboxChange}
					disabled={field.readOnly}
					data-field-name={field.name}
				/>
			</label>
		</div>

	{:else if field.type === 'radio'}
		<div class="form-control">
			<div class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
			</div>
			<div class="space-y-2">
				{#each field.options || [] as option}
					<label class="label cursor-pointer">
						<span class="label-text">{option}</span>
							<input
								type="radio"
								class="radio radio-primary"
								name={fieldId}
								value={option}
								checked={value === option}
								onchange={handleRadioChange}
								disabled={field.readOnly}
								data-field-name={field.name}
							/>
					</label>
				{/each}
			</div>
		</div>

	{:else if field.type === 'dropdown'}
		<div class="form-control">
			<label for={fieldId} class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
			</label>
			<select
				id={fieldId}
				class="select select-bordered w-full"
				value={value}
				onchange={handleSelectChange}
				disabled={field.readOnly}
				required={field.required}
				data-field-name={field.name}
			>
				<option value="">Select {field.name}</option>
				{#each field.options || [] as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>

	{:else if field.type === 'list'}
		<div class="form-control">
			<label for={fieldId} class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
			</label>
			<select
				id={fieldId}
				class="select select-bordered w-full h-32"
				multiple
				onchange={handleSelectChange}
				disabled={field.readOnly}
				data-field-name={field.name}
			>
				{#each field.options || [] as option}
					<option 
						value={option}
						selected={Array.isArray(value) && value.includes(option)}
					>
						{option}
					</option>
				{/each}
			</select>
			<div class="label">
				<span class="label-text-alt text-xs opacity-60">
					Hold Ctrl/Cmd to select multiple options
				</span>
			</div>
		</div>

	{:else if field.type === 'signature'}
		<div class="form-control">
			<div class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				{#if field.required}
					<span class="label-text-alt text-error">*</span>
				{/if}
			</div>
			<div class="border-2 border-dashed border-base-300 rounded-lg p-4 text-center">
				<div class="text-sm opacity-60 mb-2">Signature Field</div>
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => requestSignature(field.name)}
					disabled={field.readOnly}
				>
					Add Signature
				</button>
			</div>
		</div>

	{:else}
		<div class="form-control">
			<div class="label">
				<span class="label-text font-medium">{field.label || field.name}</span>
				<span class="label-text-alt text-warning">Unsupported field type</span>
			</div>
			<input
				type="text"
				class="input input-bordered w-full"
				placeholder="Unsupported field type"
				disabled
			/>
		</div>
	{/if}
</div>