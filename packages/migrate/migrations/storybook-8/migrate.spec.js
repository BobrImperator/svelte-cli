import { assert, test } from 'vitest';
import { transform_module_code } from './migrate.js';

test('Updates component creation #1', () => {
	const result = transform_module_code(
		`<script module>
      import { Story, Template } from "@storybook/addon-svelte-csf";
	import DefaultHeader from "./header.svelte";

	/**
	 * Use as: Vanilla & Svelte component
	 */
	export const meta = {
		title: "Default-Header",
		component: DefaultHeader,
		argTypes: {
			heading_level: {
				control: "select",
				options: [1, 2, 3, 4, 5, 6],
			},
		},
	};
</script>

<Template >
	{#snippet children({ args })}
		<DefaultHeader {...args}></DefaultHeader>
	{/snippet}
</Template>

<Story
	name="Story-1"
	args={{
		heading: "Praesent molestie quam et diam egestas, id semper quam accumsan",
		heading_level: 3,
	}}
/>`);
	assert.equal(
		result,
		`<script module>
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import DefaultHeader from "./header.svelte";

	/**
	 * Use as: Vanilla & Svelte component
	 */
	const { Story } = defineMeta({
		title: "Default-Header",
		component: DefaultHeader,
		argTypes: {
			heading_level: {
				control: "select",
				options: [1, 2, 3, 4, 5, 6],
			},
		},
	});
</script>

{#snippet template(args)}
	<DefaultHeader {...args}></DefaultHeader>
{/snippet}

<Story
	name="Story-1"
	args={{
		heading: "Praesent molestie quam et diam egestas, id semper quam accumsan",
		heading_level: 3,
	}}
/>
`);
});
