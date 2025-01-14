import { assert, test } from 'vitest';
import { transform_svelte_code } from './migrate.js';
import { migrate, parse, preprocess } from 'svelte/compiler';

test('Updates component creation #1', async () => {
	const result = await transform_svelte_code(
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
/>`,
		{ migrate, preprocess, parse },
		{ filename: 'example.svelte', use_ts: true }
	);
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
`
	);
});
