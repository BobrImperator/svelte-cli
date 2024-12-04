import { Project, ts, Node, SyntaxKind } from 'ts-morph';

/**
 * @param {string} code
 */
export function transform_module_code(code) {
	const project = new Project({ useInMemoryFileSystem: true });
	const source = project.createSourceFile('svelte.ts', code);
	update_component_instantiation(source);
	return source.getFullText();
}

/**
 * @param {string} code
 * @param {(source: string, options: { filename?: string, use_ts?: boolean }) => { code: string }} transform_code
 * @param {{ filename?: string, use_ts?: boolean }} options
 */
export function transform_svelte_code(code, transform_code, options) {
	let updatedSource = code;

	if (code.includes('<Template')) {
		updatedSource = code
			.replace(/<Template.*>/g, '')
			.replace(/{#snippet children.*}/g, '{#snippet template(args)}')
			.replace(/<\/Template>/g, '');
	}

	return transform_code(updatedSource, options).code;
}

/**
 * new Component(...) -> mount(Component, ...)
 * @param {import('ts-morph').SourceFile} source
 */
function update_component_instantiation(source) {
	// Update imports - Remove `Template`, Add `defineMeta`
	const storybookImport = source.getImportDeclaration(
		(imp) => imp.getModuleSpecifierValue() === '@storybook/addon-svelte-csf'
	);

	if (storybookImport) {
		// Add `defineMeta` import if not already present
		if (!storybookImport.getNamedImports().some((ni) => ni.getName() === 'defineMeta')) {
			storybookImport.removeNamedImports();
			storybookImport.addNamedImport('defineMeta');
		}

		// Remove `Template` import if present
		storybookImport.getNamedImports().forEach((ni) => {
			if (ni.getName() === 'Template') {
				ni.remove();
			}
		});
	}

	//  Replace `export const meta` with `defineMeta`
	const metaVariable = source.getVariableStatement((vs) =>
		vs.getDeclarations().some((decl) => decl.getName() === 'meta')
	);

	if (metaVariable) {
		const metaDeclaration = metaVariable.getDeclarations()[0];
		const metaInitializer = metaDeclaration.getInitializer();

		if (metaInitializer) {
			// Replace `meta` with the `defineMeta` call
			const comment = metaVariable.getLeadingCommentRanges().flatMap((a) => a.getText());

			metaVariable.replaceWithText(
				`${comment}\nconst { Story } = defineMeta(${metaInitializer.getText()});`
			);
		}
	}

	return source.getFullText();
	// Replace opening <Template> tags with {#snippet template(...) and closing </Template> tags with }
	const updatedSource = source
		.getFullText()
		.replace(/children/g, 'a')
		.replace(/<Template.*>/g, (_, attributes) => {
			// Convert attributes to snippet arguments
			return `{#snippet template(args)}`;
		})
		.replace(/{#snippet children.*}/g, '')
		.replace(/{\/snippet.*}/g, '')
		.replace(/<\/Template>/g, '{/snippet}');

	source.replaceWithText(updatedSource);

	return updatedSource;
}
