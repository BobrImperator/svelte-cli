import { Project, ts, Node, SyntaxKind } from 'ts-morph';
import MagicString from 'magic-string';
import { walk } from 'zimmerframe';

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
export async function transform_svelte_code(code, compiler, options) {
	let updatedSource = code;

//	if (code.includes('<Template')) {
//		updatedSource = code
//			.replace(/<Template.*>/g, '')
//			.replace(/{#snippet children.*}/g, '{#snippet template(args)}')
//			.replace(/<\/Template>/g, '');
//	}

	const preprocessed = await compiler.preprocess(code, {
		/** @param {{ content: string }} input */
		script: ({ content }) => ({
			code: content
				.split('\n')
				.map((line) => ' '.repeat(line.length))
				.join('\n')
		}),
		/** @param {{ content: string }} input */
		style: ({ content }) => ({
			code: content
				.split('\n')
				.map((line) => ' '.repeat(line.length))
				.join('\n')
		})
	});


	const ast = await compiler.parse(preprocessed.code);
	const magic = new MagicString(code);


  console.log(ast);
  console.log(ast.html.children)
  const updates = [];
	let is_foreign = false;
	let is_custom_element = false;

	walk(ast.html, null, {
		_(node, { next, stop }) {
      console.log(node.type);

      console.log(node.value);
			if (node.type === 'Options') {
				const namespace = node.attributes.find(
					/** @param {any} a */
					(a) => a.type === 'Attribute' && a.name === 'namespace'
				);
				if (namespace?.value[0].data === 'foreign') {
					is_foreign = true;
					stop();
					return;
				}

				is_custom_element = node.attributes.some(
					/** @param {any} a */
					(a) => a.type === 'Attribute' && (a.name === 'customElement' || a.name === 'tag')
				);
			}

			if (node.type === 'Element' || node.type === 'Script') {
        console.log('hello');
				let start = node.end - 2;
				if (code[start - 1] === ' ') {
					start--;
				}
				updates.push(() => {
					if (node.type === 'Element' || is_custom_element) {
						magic.update(start, node.end, `></${node.name}>`);
					}
				});
			}

			next();
		}
	});

	if (is_foreign) {
		return code;
	}

	updates.forEach((update) => update());
	return magic.toString();
	return compiler.migrate(updatedSource, options).code;
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
