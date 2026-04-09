#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const ignore = require('ignore');
const { minimatch } = require('minimatch');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const MAX_TASK_OUTPUT_CHARS = 12 * 1024;

async function testPrompt(config, inputPrompt, judgePrompt, id, verbose) {
	const result = await runPrompt(config, inputPrompt, judgePrompt, id, verbose);
	return result.passed ? '' : formatFailureMarkdown(result);
}

async function runPromptTest(config, inputPrompt, judgePrompt, verbose) {
	if(verbose) {
		console.log(`Running test in workspace. inputPrompt="${inputPrompt}"; judgePrompt="${judgePrompt}"; config=${JSON.stringify(config)}`);
	}
	const options = normalizeConfig(config);
	const originalWorkspace = resolveWorkspaceRoot(options);
	let tempRoot = null;
	let effectiveWorkspace = originalWorkspace;

	try {
		if (options.workspaceMode === 'copy') {
			tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xdrs-core-test-'));
			effectiveWorkspace = copyWorkspace(originalWorkspace, path.join(tempRoot, 'workspace'), options.workspaceFilter, verbose);
		}

		if(verbose) {
			console.log(`Running prompt test in workspace: ${effectiveWorkspace} (mode: ${options.workspaceMode})`);
		}
		const task = await runTaskPhase({
			prompt: ensureNonEmptyString(inputPrompt, 'inputPrompt'),
			commandTemplate: options.promptCmd,
			workspacePath: effectiveWorkspace,
			authoritativeWorkspacePath: originalWorkspace,
			timeoutMs: options.taskTimeoutMs,
			env: options.env,
			verbose
		});

		if(verbose) {
			console.log(`Task phase completed. text="${task.text}"; contextFiles="${task.contextFiles}"; changedFiles="${task.changedFiles}"`);
		}

		if(verbose) {
			console.log('Running judge phase to evaluate the task output against the judge prompt.');
		}
		const evaluation = await runJudgePhase({
			originalPrompt: ensureNonEmptyString(inputPrompt, 'inputPrompt'),
			judgePrompt: ensureNonEmptyString(judgePrompt, 'judgePrompt'),
			originalTaskOutput: task.text,
			originalTaskReportedChanges: task.changedFiles,
			originalTaskContextFiles: task.contextFiles,
			commandTemplate: options.promptCmd,
			workspacePath: effectiveWorkspace,
			authoritativeWorkspacePath: originalWorkspace,
			timeoutMs: options.judgeTimeoutMs,
			env: options.env,
			verbose
		});

		console.log(`Judge phase completed. passed=${evaluation.pass}; findings="${JSON.stringify(evaluation.findings)}"`);

		return {
			passed: evaluation.pass,
			findings: evaluation.findings,
			taskOutput: task.text,
			agentReportedChanges: task.changedFiles,
			contextFiles: task.contextFiles,
			workspace: {
				original: originalWorkspace,
				effective: effectiveWorkspace,
				mode: options.workspaceMode
			}
		};
	} finally {
		if (tempRoot && options.workspaceMode === 'copy') {
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	}
}

function copilotCmd(workspaceRoot = findGitRoot(process.cwd())) {
	return [
		'copilot',
		`--add-dir=${path.resolve(workspaceRoot)}`,
		'--autopilot',
		'--allow-all-tools',
		'--allow-all-urls',
		'--no-ask-user',
		'--allow-all',
		'-p',
		'{PROMPT}'
	];
}

function ensureNonEmptyString(value, label) {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Expected non-empty ${label}`);
	}
	return value.trim();
}

function normalizeConfig(config) {
	if (!config || typeof config !== 'object' || Array.isArray(config)) {
		throw new Error('Expected config to be an object.');
	}

	const workspaceMode = config.workspaceMode || 'copy';
	if (workspaceMode !== 'copy' && workspaceMode !== 'in-place') {
		throw new Error(`Invalid workspaceMode value: ${workspaceMode}`);
	}

	let defaultReportFile = null;
	if (!('reportFile' in config)) {
		const stackFrames = (new Error().stack || '').split('\n');
		for (const frame of stackFrames) {
			const match = frame.match(/\((.+\.js):\d+:\d+\)$/);
			if (match && match[1] !== __filename && !match[1].startsWith('node:')) {
				const callerFile = match[1];
				defaultReportFile = path.join(path.dirname(callerFile), path.basename(callerFile, path.extname(callerFile)) + '.report');
				break;
			}
		}
	}

	return {
		promptCmd: parseCommandTemplate(config.promptCmd, 'promptCmd'),
		workspaceRoot: config.workspaceRoot ? path.resolve(config.workspaceRoot) : null,
		workspaceMode,
		workspaceFilter: normalizeWorkspaceFilter(config.workspaceFilter),
		env: normalizeEnv(config.env),
		taskTimeoutMs: readTimeout(config.taskTimeoutMs, 'taskTimeoutMs'),
		judgeTimeoutMs: readTimeout(config.judgeTimeoutMs, 'judgeTimeoutMs'),
		reportFile: config.reportFile ? path.resolve(config.reportFile) : (defaultReportFile ? path.resolve(defaultReportFile) : null),
		checkOnly: Boolean(config.checkOnly),
		model: typeof config.model === 'string' ? config.model : ''
	};
}

function resolveWorkspaceRoot(options) {
	const resolvedWorkspace = options.workspaceRoot || findGitRoot(process.cwd());

	if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
		throw new Error(`Workspace directory not found: ${resolvedWorkspace}`);
	}

	return resolvedWorkspace;
}

async function runTaskPhase({ prompt, commandTemplate, workspacePath, authoritativeWorkspacePath, timeoutMs, env, verbose }) {
	const wrappedPrompt = [
		'RUN PHASE',
		'',
		'<INSTRUCTIONS>',
		'Keep all changes inside the workspace.',
		'ALWAYS answer with JSON using the schema specified below, and never include any other text.',
		'Response schema: {"text":"plain text output","changedFiles":["relative/path.ext"],"contextFiles":["relative/path.ext"]}.',
		'List in contextFiles every file you read or used as context during this task, including files added by default to the context such as AGENTS.md or skills. List in contextFiles all files that might have impacted the result of this task.',
		'List in changedFiles every file you created or updated during this task.',
		'Use text field to report the final output of the task. Do not include any reasoning, internal thoughts, or explanations in the text field.',
		'</INSTRUCTIONS>',
		'',
		prompt,
	].join('\n');

	const result = await runPromptCommand({
		commandTemplate,
		workspacePath,
		authoritativeWorkspacePath,
		prompt: wrappedPrompt,
		timeoutMs,
		env,
		verbose
	});

	return parseTaskResponse(result.output);
}

async function runJudgePhase({ originalPrompt, judgePrompt, originalTaskOutput, originalTaskReportedChanges, originalTaskContextFiles, commandTemplate, workspacePath, authoritativeWorkspacePath, timeoutMs, env, verbose }) {
	const wrappedPrompt = [
		'ASSERTION_EVALUATION PHASE',
		'',
		'<INSTRUCTIONS>',
		'You are evaluating the result of a separate agent task run.',
		'Treat this as a fresh session. Do not assume any hidden history.',
		'Use the original task prompt, the judge prompt, the final task output, the reported changed and context file paths, and the current workspace state to decide whether the result passes.',
		'Trust the reported changed and context file path list as the authoritative change report for this task run.',
		'Read files from the workspace directly when you need their contents.',
		'ALWAYS answer with JSON using the schema specified below, and never include any other text.',
		'Response schema: {"pass":false,"text":"plain text summary of the evaluation","findings":[{"target":"file","path":"relative/path.ext","line":1,"message":"explanation","assertionRef":"exact relevant phrase from the judge prompt"}]}.',
		'Use the text field to report a plain text summary of the evaluation result.',
		'Use target="output" when the issue is in the final task output and target="workspace" when it is not tied to a specific file.',
		'Include 1-based line numbers when you cite a file or the output text. Include the exact judge-prompt phrase that triggered each finding in assertionRef.',
		'',
		'<ORIGINAL TASK PROMPT>',
		originalPrompt,
		'</ORIGINAL TASK PROMPT>',
		'',
		'<ORIGINAL TASK OUTPUT>',
		truncateText(originalTaskOutput || '(empty)', MAX_TASK_OUTPUT_CHARS),
		'</ORIGINAL TASK OUTPUT>',
		'',
		'<ORIGINAL TASK REPORTED CHANGES JSON>',
		JSON.stringify(originalTaskReportedChanges, null, 2),
		'</ORIGINAL TASK REPORTED CHANGES JSON>',
		'',
		'<ORIGINAL TASK REPORTED CONTEXT FILES JSON>',
		JSON.stringify(originalTaskContextFiles, null, 2),
		'</ORIGINAL TASK REPORTED CONTEXT FILES JSON>',
		'',
		judgePrompt,
	].join('\n');

	const result = await runPromptCommand({
		commandTemplate,
		workspacePath,
		authoritativeWorkspacePath,
		prompt: wrappedPrompt,
		timeoutMs,
		env,
		verbose
	});

	return parseJudgeResponse(result.output);
}

function parseTaskResponse(output) {
	const trimmed = String(output || '').trim();
	if (!trimmed) {
		throw new Error('The task command returned empty output.');
	}

	try {
		const parsed = parseJsonObject(trimmed);
		return {
			text: typeof parsed.text === 'string' && parsed.text.trim()
				? parsed.text.trim()
				: trimmed,
			changedFiles: normalizeStringArray(parsed.changedFiles),
			contextFiles: normalizeStringArray(parsed.contextFiles)
		};
	} catch (error) {
		return {
			text: trimmed,
			changedFiles: [],
			contextFiles: []
		};
	}
}

function parseJudgeResponse(output) {
	let parsed;

	try {
		parsed = parseJsonObject(output);
	} catch (error) {
		throw new Error(`Judge returned invalid JSON: ${truncateText(String(output || '').trim(), 1000)}`);
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Judge response must be a JSON object.');
	}

	if (typeof parsed.pass !== 'boolean') {
		throw new Error('Judge response must include a boolean pass field.');
	}

	let findings = [];
	if (Array.isArray(parsed.findings)) {
		findings = parsed.findings.map(normalizeFinding).filter(Boolean);
	} else if (Array.isArray(parsed.reasons)) {
		findings = parsed.reasons
			.filter((reason) => typeof reason === 'string' && reason.trim())
			.map((reason) => ({
				target: 'workspace',
				message: reason.trim(),
				path: null,
				line: null,
				assertionRef: ''
			}));
	}

	if (!parsed.pass && findings.length === 0) {
		findings = [{
			target: 'workspace',
			message: 'Judge reported failure without detailed findings.',
			path: null,
			line: null,
			assertionRef: ''
		}];
	}

	return {
		pass: parsed.pass,
		text: typeof parsed.text === 'string' ? parsed.text.trim() : '',
		findings,
		raw: parsed
	};
}

function normalizeFinding(finding) {
	if (!finding) {
		return null;
	}

	if (typeof finding === 'string') {
		const message = finding.trim();
		return message ? {
			target: 'workspace',
			message,
			path: null,
			line: null,
			assertionRef: ''
		} : null;
	}

	if (typeof finding !== 'object' || Array.isArray(finding)) {
		return null;
	}

	const message = typeof finding.message === 'string' ? finding.message.trim() : '';
	if (!message) {
		return null;
	}

	const pathValue = typeof finding.path === 'string' && finding.path.trim() ? finding.path.trim() : null;
	const lineValue = normalizeLineNumber(finding.line);
	const target = finding.target === 'file' || finding.target === 'output' || finding.target === 'workspace'
		? finding.target
		: (pathValue ? 'file' : 'workspace');

	return {
		target,
		path: pathValue,
		line: lineValue,
		message,
		assertionRef: typeof finding.assertionRef === 'string' ? finding.assertionRef.trim() : ''
	};
}

function runPromptCommand({ commandTemplate, workspacePath, authoritativeWorkspacePath, prompt, timeoutMs, env, verbose }) {
	const command = rewriteWorkspaceCommand(commandTemplate.map((entry) => entry
		.replace('{PROMPT}', prompt)
		.replace('{WORKSPACE_ROOT}', workspacePath)), workspacePath, authoritativeWorkspacePath);

	const [file, ...args] = command;

	if(verbose) {
		console.log(`Running prompt cmd: ${file} ${args.join(' ')}; workspace: ${workspacePath}`);
	}

	return new Promise((resolve, reject) => {
		const child = spawn(file, args, {
			cwd: workspacePath,
			env: {
				...process.env,
				...env
			}
		});

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let timer = null;

		if (timeoutMs) {
			timer = setTimeout(() => {
				timedOut = true;
				child.kill();
				reject(new Error(`${file} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
		}

		child.stdout.on('data', (chunk) => {
			const text = chunk.toString('utf8');
			stdout += text;
			process.stdout.write(text);
		});

		child.stderr.on('data', (chunk) => {
			const text = chunk.toString('utf8');
			stderr += text;
			process.stderr.write(text);
		});

		child.on('error', (err) => {
			if (timer !== null) { clearTimeout(timer); }
			if (err.code === 'ENOENT') {
				reject(new Error(`Command not found: ${file}`));
			} else {
				reject(new Error(`Failed to execute ${file}: ${err.message}`));
			}
		});

		child.on('close', (code) => {
			if (timer !== null) { clearTimeout(timer); }
			if (timedOut) { return; }

			if (code !== 0) {
				const details = truncateText((stderr || stdout || '').trim(), 2000);
				reject(new Error(`${file} exited with status ${code}${details ? `: ${details}` : ''}`));
				return;
			}

			const output = stdout.trim() || stderr.trim();
			if (!output) {
				reject(new Error(`${file} returned empty output.`));
				return;
			}

			if(verbose) {
				console.log(`Prompt command output: ${output}`);
			}

			resolve({ output });
		});
	});
}

function rewriteWorkspaceCommand(command, workspacePath, authoritativeWorkspacePath) {
	if (!authoritativeWorkspacePath || path.resolve(workspacePath) === path.resolve(authoritativeWorkspacePath)) {
		return command;
	}

	const normalizedAuthoritativeWorkspacePath = path.resolve(authoritativeWorkspacePath);
	return command.map((entry, index, allEntries) => {
		if (entry === '--add-dir' && typeof allEntries[index + 1] === 'string') {
			return entry;
		}

		if (index > 0 && allEntries[index - 1] === '--add-dir' && path.resolve(entry) === normalizedAuthoritativeWorkspacePath) {
			return workspacePath;
		}

		if (!entry.startsWith('--add-dir=')) {
			return entry;
		}

		const addDirPath = entry.slice('--add-dir='.length);
		if (path.resolve(addDirPath) !== normalizedAuthoritativeWorkspacePath) {
			return entry;
		}

		return `--add-dir=${workspacePath}`;
	});
}

function parseCommandTemplate(value, label) {
	if (Array.isArray(value)) {
		return normalizeCommandArray(value, label);
	}

	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Expected ${label} to be a non-empty JSON array string or string array.`);
	}

	let parsed;
	try {
		parsed = JSON.parse(value);
	} catch (error) {
		throw new Error(`${label} must be a JSON array string or a string array.`);
	}

	return normalizeCommandArray(parsed, label);
}

function normalizeCommandArray(value, label) {
	if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || !entry)) {
		throw new Error(`${label} must be a non-empty array of strings.`);
	}

	if (!value.some((entry) => entry.includes('{PROMPT}'))) {
		throw new Error(`${label} must include a {PROMPT} placeholder.`);
	}

	return [...value];
}

function normalizeWorkspaceFilter(value) {
	if (value == null) {
		return null;
	}

	if (typeof value === 'string') {
		if (!value.trim()) {
			throw new Error('workspaceFilter must not be an empty string.');
		}

		return [value.trim()];
	}

	if (Array.isArray(value)) {
		if (value.length === 0 || value.some((v) => typeof v !== 'string' || !v.trim())) {
			throw new Error('workspaceFilter must be a non-empty array of non-empty glob strings.');
		}

		return value.map((v) => v.trim());
	}

	throw new Error('workspaceFilter must be a string or an array of strings.');
}

function normalizeEnv(env) {
	if (env == null) {
		return {};
	}

	if (!env || typeof env !== 'object' || Array.isArray(env)) {
		throw new Error('Expected env to be an object when provided.');
	}

	return { ...env };
}

function readTimeout(value, label) {
	if (value == null) {
		return 0;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid ${label} value: ${value}`);
	}
	return parsed;
}

function parseJsonObject(value) {
	const trimmed = String(value || '').trim();
	try {
		return JSON.parse(trimmed);
	} catch (error) {
		const firstBrace = trimmed.indexOf('{');
		const lastBrace = trimmed.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
			return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
		}
		throw error;
	}
}

function normalizeStringArray(values) {
	if (!Array.isArray(values)) {
		return [];
	}

	return [...new Set(values
		.filter((value) => typeof value === 'string' && value.trim())
		.map((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
}

function normalizeLineNumber(value) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function defaultPromptId(inputPrompt, judgePrompt) {
	const combined = inputPrompt + judgePrompt;
	const prefix = inputPrompt.slice(0, 40);
	if (combined.length > 40) {
		const hash = crypto.createHash('sha1').update(combined).digest('hex').slice(0, 8);
		return `${prefix}-${hash}`;
	}
	return prefix;
}

async function runPrompt(config, inputPrompt, judgePrompt, id, verbose) {
	const effectiveId = id || defaultPromptId(inputPrompt, judgePrompt);
	const options = normalizeConfig(config);
	const workspaceRoot = resolveWorkspaceRoot(options);

	if (effectiveId && options.reportFile) {
		const report = readReport(options.reportFile);
		const entry = report[effectiveId];

		if (entry && entry.result === 'success') {
			const currentHash = computeContextHash(options.model, inputPrompt, judgePrompt, entry.contextFiles, workspaceRoot);
			if (currentHash === entry.contextHash) {
				return { passed: true, findings: [], cached: true };
			}
			if (options.checkOnly) {
				return { passed: false, findings: [{ target: 'workspace', path: 'cache', message: `Test inputs changed since last passing run for id '${effectiveId}'. Re-run required.` }] };
			}
		} else if (options.checkOnly) {
			return { passed: false, findings: [{ target: 'workspace', path: 'cache', message: `No passing report entry found for id '${effectiveId}'. Re-run required.` }] };
		}
	}

	const result = await runPromptTest(config, inputPrompt, judgePrompt, verbose);

	if (result.passed && effectiveId && options.reportFile) {
		const newHash = computeContextHash(options.model, inputPrompt, judgePrompt, result.contextFiles, workspaceRoot);
		const existingReport = readReport(options.reportFile);
		existingReport[effectiveId] = { result: 'success', contextFiles: result.contextFiles, contextHash: newHash };
		writeReport(options.reportFile, existingReport);
	}

	return result;
}

function computeContextHash(model, inputPrompt, judgePrompt, contextFiles, workspaceRoot) {
	const parts = [model, inputPrompt, judgePrompt];
	for (const filePath of contextFiles) {
		parts.push(fs.readFileSync(path.join(workspaceRoot, filePath), 'utf8'));
	}
	return crypto.createHash('md5').update(parts.join('\n')).digest('hex');
}

function readReport(reportFile) {
	try {
		return JSON.parse(fs.readFileSync(reportFile, 'utf8'));
	} catch {
		return {};
	}
}

function writeReport(reportFile, reportData) {
	fs.writeFileSync(reportFile, `${JSON.stringify(reportData, null, 2)}\n`, 'utf8');
}

function formatFailureMarkdown(result) {
	const normalizedFindings = Array.isArray(result.findings) && result.findings.length > 0
		? result.findings
		: [{ target: 'workspace', message: 'The prompt test failed without detailed findings.' }];

	return `Assertion failed. taskOutput=${result.taskOutput}\n` + normalizedFindings.map((finding) => {
		const location = formatFindingLocation(finding);
		const assertion = finding.assertionRef ? ` Assertion: "${finding.assertionRef}".` : '';
		return `- [${location}] ${finding.message}${assertion}`;
	}).join('\n');
}

function formatFindingLocation(finding) {
	if (finding.target === 'output') {
		return finding.line ? `output:${finding.line}` : 'output';
	}

	if (finding.path) {
		return finding.line ? `${finding.path}:${finding.line}` : finding.path;
	}

	return 'workspace';
}

function findGitRoot(startPath) {
	let currentPath = path.resolve(startPath);

	while (true) {
		if (fs.existsSync(path.join(currentPath, '.git'))) {
			return currentPath;
		}

		const parentPath = path.dirname(currentPath);
		if (parentPath === currentPath) {
			return path.resolve(startPath);
		}

		currentPath = parentPath;
	}
}

function copyWorkspace(sourcePath, targetPath, workspaceFilter, verbose) {
	if(verbose) {
		console.log(`Copying workspace from ${sourcePath} to ${targetPath}`);
	}
	fs.mkdirSync(targetPath, { recursive: true });
	copyWorkspaceDirectory({
		sourceDir: sourcePath,
		targetDir: targetPath,
		rootPath: sourcePath,
		ignoreContexts: [],
		activeRealDirectories: new Set(),
		workspaceFilter
	});
	return targetPath;
}

function copyWorkspaceDirectory({ sourceDir, targetDir, rootPath, ignoreContexts, activeRealDirectories, workspaceFilter }) {
	const realSourceDir = fs.realpathSync(sourceDir);
	if (activeRealDirectories.has(realSourceDir)) {
		return;
	}
	activeRealDirectories.add(realSourceDir);

	try {
		const currentRelativeDir = toWorkspaceRelativePath(path.relative(rootPath, sourceDir));
		const nextIgnoreContexts = loadGitignoreContext(sourceDir, currentRelativeDir, ignoreContexts);
		const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!shouldCopyWorkspaceEntry(entry.name)) {
				continue;
			}

			const sourceEntryPath = path.join(sourceDir, entry.name);
			const entryStats = entry.isSymbolicLink() ? fs.statSync(sourceEntryPath) : null;
			const isDirectory = entry.isDirectory() || (entryStats && entryStats.isDirectory());
			const isFile = entry.isFile() || (entryStats && entryStats.isFile());

			if (!isDirectory && !isFile) {
				continue;
			}

			const entryRelativePath = toWorkspaceRelativePath(path.relative(rootPath, sourceEntryPath));
			const matchPath = isDirectory ? `${entryRelativePath}/` : entryRelativePath;
			if (isGitignoredPath(matchPath, nextIgnoreContexts)) {
				continue;
			}

			const targetEntryPath = path.join(targetDir, entry.name);
			if (isDirectory) {
				fs.mkdirSync(targetEntryPath, { recursive: true });
				copyWorkspaceDirectory({
					sourceDir: sourceEntryPath,
					targetDir: targetEntryPath,
					rootPath,
					ignoreContexts: nextIgnoreContexts,
					activeRealDirectories,
					workspaceFilter
				});
				continue;
			}

			if (workspaceFilter && !workspaceFilter.some((pattern) => minimatch(entryRelativePath, pattern, { dot: true }))) {
				continue;
			}

			fs.copyFileSync(sourceEntryPath, targetEntryPath);
			fs.chmodSync(targetEntryPath, (entryStats || fs.statSync(sourceEntryPath)).mode);
		}
	} finally {
		activeRealDirectories.delete(realSourceDir);
	}
}

function loadGitignoreContext(sourceDir, currentRelativeDir, ignoreContexts) {
	const gitignorePath = path.join(sourceDir, '.gitignore');
	if (!fs.existsSync(gitignorePath) || !fs.statSync(gitignorePath).isFile()) {
		return ignoreContexts;
	}

	const matcher = ignore();
	matcher.add(fs.readFileSync(gitignorePath, 'utf8'));
	return [...ignoreContexts, { basePath: currentRelativeDir, matcher }];
}

function isGitignoredPath(matchPath, ignoreContexts) {
	let ignored = false;

	for (const context of ignoreContexts) {
		const relativeToContext = toContextRelativePath(matchPath, context.basePath);
		if (relativeToContext == null) {
			continue;
		}

		const result = context.matcher.checkIgnore(relativeToContext);
		if (result.unignored) {
			ignored = false;
		}
		if (result.ignored) {
			ignored = true;
		}
	}

	return ignored;
}

function toContextRelativePath(matchPath, basePath) {
	const isDirectory = matchPath.endsWith('/');
	const barePath = isDirectory ? matchPath.slice(0, -1) : matchPath;
	const relativePath = basePath ? path.posix.relative(basePath, barePath) : barePath;

	if (!relativePath || relativePath === '.' || relativePath === '..' || relativePath.startsWith('../')) {
		return null;
	}

	return isDirectory ? `${relativePath}/` : relativePath;
}

function toWorkspaceRelativePath(relativePath) {
	return relativePath ? relativePath.split(path.sep).join(path.posix.sep) : '';
}

function shouldCopyWorkspaceEntry(entryName) {
	return !COPY_WORKSPACE_EXCLUDES.has(entryName);
}

const COPY_WORKSPACE_EXCLUDES = new Set([
	'.git',
	'.gitattributes',
	'.gitignore',
	'.gitmodules'
]);

function truncateText(value, maxLength) {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength)}...`;
}

module.exports = {
	testPrompt,
	runPromptTest,
	copilotCmd
};
