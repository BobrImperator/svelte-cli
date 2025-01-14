import { resolve } from 'import-meta-resolve';
import colors from 'kleur';
import { execSync } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prompts from 'prompts';
import glob from 'tiny-glob/sync.js';
import { bail, check_git, update_js_file, update_svelte_file } from '../../utils.js';
import { transform_module_code, transform_svelte_code } from './migrate.js';

export async function migrate() {
	if (!fs.existsSync('package.json')) {
		bail('Please re-run this script in a directory with a package.json');
	}

	console.log(
		'This migration is experimental — please report any bugs to https://github.com/sveltejs/svelte/issues'
	);

	let compiler;
	try {
		try {
			compiler = await import_from_cwd('svelte/compiler');
		} catch {
			execSync('npm install svelte@^5.0.0 --no-save', {
				stdio: 'inherit',
				cwd: dirname(fileURLToPath(import.meta.url))
			});
			const url = resolve('svelte/compiler', import.meta.url);
			compiler = await import(url);
		}
	} catch (e) {
		console.log(e);
		console.log(
			colors
				.bold()
				.red(
					'❌ Could not install Svelte. Manually bump the dependency to version 5 in your package.json, install it, then try again.'
				)
		);
		return;
	}

	console.log(
		colors
			.bold()
			.yellow(
				'\nThis will update files in the current directory\n' +
					"If you're inside a monorepo, don't run this in the root directory, rather run it in all projects independently.\n"
			)
	);

	const use_git = check_git();

	const response = await prompts({
		type: 'confirm',
		name: 'value',
		message: 'Continue?',
		initial: false
	});

	if (!response.value) {
		process.exit(1);
	}

	const folders = await prompts({
		type: 'multiselect',
		name: 'value',
		message: 'Which folders should be migrated?',
		choices: fs
			.readdirSync('.')
			.filter(
				(dir) => fs.statSync(dir).isDirectory() && dir !== 'node_modules' && !dir.startsWith('.')
			)
			.map((dir) => ({ title: dir, value: dir, selected: true }))
	});

	if (!folders.value?.length) {
		process.exit(1);
	}

	const use_ts = fs.existsSync('tsconfig.json');

	// const { default: config } = fs.existsSync('svelte.config.js')
	// 	? await import(pathToFileURL(path.resolve('svelte.config.js')).href)
	// 	: { default: {} };

	/** @type {string[]} */
	const svelte_extensions = /* config.extensions ?? - disabled because it would break .svx */ [
		'.stories.svelte'
	];
	const extensions = [...svelte_extensions];
	// For some reason {folders.value.join(',')} as part of the glob doesn't work and returns less files
	const files = folders.value.flatMap(
		/** @param {string} folder */ (folder) =>
			glob(`${folder}/**`, { filesOnly: true, dot: true })
				.map((file) => file.replace(/\\/g, '/'))
				.filter((file) => !file.includes('/node_modules/'))
	);

	for (const file of files) {
		if (extensions.some((ext) => file.endsWith(ext))) {
			if (svelte_extensions.some((ext) => file.endsWith(ext))) {
				await update_svelte_file(file, transform_module_code, (code) =>
					transform_svelte_code(code, compiler, { filename: file, use_ts })
				);
			} else {
				update_js_file(file, transform_module_code);
			}
		}
	}

	console.log(colors.bold().green('✔ Your project has been migrated'));

	console.log('\nRecommended next steps:\n');

	const cyan = colors.bold().cyan;

	const tasks = [
		"install the updated dependencies ('npm i' / 'pnpm i' / etc) " +
			'(note that there may be peer dependency issues when not all your libraries officially support Svelte 5 yet. In this case try installing with the --force option)',
		use_git && cyan('git commit -m "migration to Svelte 5"'),
		'Review the migration guide at https://svelte.dev/docs/svelte/v5-migration-guide'
	].filter(Boolean);

	tasks.forEach((task, i) => {
		console.log(`  ${i + 1}: ${task}`);
	});

	console.log('');

	if (use_git) {
		console.log(`Run ${cyan('git diff')} to review changes.\n`);
	}
}

/** @param {string} name */
function import_from_cwd(name) {
	const cwd = pathToFileURL(process.cwd()).href;
	const url = resolve(name, cwd + '/x.js');

	return import(url);
}
