'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { copilotCmd, testPrompt } = require('./testPrompt');

let TMP_ROOT;
const COPILOT_DIR = path.join(__dirname, 'tests');

beforeAll(() => {
	TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'xdrs-core-fixtures-'));
});

afterAll(() => {
	fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

test('passes a prompt test with copied workspace isolation', () => {
	const workspaceRoot = createWorkspace('customer-pass');
	const err = testPrompt(
		createConfig(workspaceRoot),
		'create a research about our customer base. We have 30% of customer > 50 years; 90% > 20',
		'The resulting file should be created at customer-research.md and should not generate facts that are not present in the original prompt'
	);

	expect(err).toBe('');
	expect(fs.existsSync(path.join(workspaceRoot, 'customer-research.md'))).toBe(false);
});

test('passes when ignored files and git metadata stay out of the copied workspace', () => {
	const workspaceRoot = createWorkspace('ignore-pass', { withIgnoredEntries: true });
	const err = testPrompt(
		createConfig(workspaceRoot),
		'create a note named summary.txt saying behavior ok',
		'Verify if ignored/seed.txt, .git/config, and nested/.git/config are not available in the copied workspace and are not reported as changes'
	);

	expect(err).toBe('');
	expect(fs.existsSync(path.join(workspaceRoot, 'summary.txt'))).toBe(false);
	assertFileExists(path.join(workspaceRoot, 'ignored', 'seed.txt'));
	assertFileExists(path.join(workspaceRoot, '.git', 'config'));
	assertFileExists(path.join(workspaceRoot, 'nested', '.git', 'config'));
});

test('returns markdown findings when the judge rejects the result', () => {
	const workspaceRoot = createWorkspace('failure-case');
	const err = testPrompt(
		createConfig(workspaceRoot),
		'create a research about our customer base. We have 30% of customer > 50 years; 90% > 20',
		'Verify if summary.txt exists and the final output mentions summary.txt'
	);

	expect(err).toContain('- [summary.txt] summary.txt should exist.');
	expect(err).toContain('Assertion: "summary.txt exists".');
	expect(err).toContain('- [output:1] The final output should mention summary.txt.');
});

test('does not create a temp workspace in in-place mode', () => {
	const workspaceRoot = createWorkspace('in-place');
	const mkdtempSpy = jest.spyOn(fs, 'mkdtempSync');

	try {
		const err = testPrompt(
			createConfig(workspaceRoot, { workspaceMode: 'in-place' }),
			'create a note named summary.txt saying behavior ok',
			'Verify if summary.txt exists and the final output mentions summary.txt'
		);

		expect(err).toBe('');
		expect(mkdtempSpy).not.toHaveBeenCalled();
		expect(fs.existsSync(path.join(workspaceRoot, 'summary.txt'))).toBe(true);
	} finally {
		mkdtempSpy.mockRestore();
	}
});

test('copilotCmd defaults to the git repository root', () => {
	const command = copilotCmd();
	const addDirArgument = command.find((entry) => entry.startsWith('--add-dir='));

	expect(addDirArgument).toBe(`--add-dir=${path.resolve(__dirname, '..')}`);
	expect(command).toEqual(expect.arrayContaining([
		'--autopilot',
		'--allow-all-tools',
		'--allow-all-urls',
		'--no-ask-user'
	]));
	const promptIndex = command.indexOf('-p');
	expect(command[promptIndex + 1]).toBe('{PROMPT}');
});

test('judge phase reuses promptCmd even when judgeCmd is provided', () => {
	const workspaceRoot = createWorkspace('judge-cmd-ignored');
	const err = testPrompt(
		createConfig(workspaceRoot, {
			judgeCmd: ['missing-command', '{PROMPT}']
		}),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt'
	);

	expect(err).toBe('');
});

test('creates report file after first successful run', () => {
	const workspaceRoot = createWorkspace('report-create');
	const reportFile = path.join(TMP_ROOT, 'report-create.json');

	const err = testPrompt(
		createConfig(workspaceRoot, { reportFile }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);

	expect(err).toBe('');
	expect(fs.existsSync(reportFile)).toBe(true);
	const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
	expect(report['summary-pass']).toBeDefined();
	expect(report['summary-pass'].result).toBe('success');
	expect(Array.isArray(report['summary-pass'].contextFiles)).toBe(true);
	expect(typeof report['summary-pass'].contextHash).toBe('string');
	expect(report['summary-pass'].contextHash).toHaveLength(32);
});

test('returns cached success and skips re-run when hash matches', () => {
	const workspaceRoot = createWorkspace('cache-hit');
	const reportFile = path.join(TMP_ROOT, 'cache-hit.json');

	const err1 = testPrompt(
		createConfig(workspaceRoot, { reportFile }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);
	expect(err1).toBe('');

	// Second run with a broken promptCmd — cache hit must skip execution entirely
	const err2 = testPrompt(
		createConfig(workspaceRoot, { reportFile, promptCmd: ['non-existent-command-xyz', '{PROMPT}'] }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);
	expect(err2).toBe('');
});

test('re-runs and updates report when context file content changes', () => {
	const workspaceRoot = createWorkspace('cache-miss');
	const reportFile = path.join(TMP_ROOT, 'cache-miss.json');

	const err1 = testPrompt(
		createConfig(workspaceRoot, { reportFile }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);
	expect(err1).toBe('');
	const firstHash = JSON.parse(fs.readFileSync(reportFile, 'utf8'))['summary-pass'].contextHash;

	fs.writeFileSync(path.join(workspaceRoot, 'seed.txt'), 'changed content\n', 'utf8');

	const err2 = testPrompt(
		createConfig(workspaceRoot, { reportFile }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);
	expect(err2).toBe('');
	const secondHash = JSON.parse(fs.readFileSync(reportFile, 'utf8'))['summary-pass'].contextHash;
	expect(secondHash).not.toBe(firstHash);
});

test('returns checkOnly failure when no passing report entry exists', () => {
	const workspaceRoot = createWorkspace('checkonly-no-report');
	const reportFile = path.join(TMP_ROOT, 'checkonly-no-report.json');

	const err = testPrompt(
		createConfig(workspaceRoot, { reportFile, checkOnly: true }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);

	expect(err).toContain('[cache]');
});

test('returns checkOnly failure when hash does not match', () => {
	const workspaceRoot = createWorkspace('checkonly-hash-mismatch');
	const reportFile = path.join(TMP_ROOT, 'checkonly-hash-mismatch.json');
	fs.writeFileSync(reportFile, JSON.stringify({
		'summary-pass': { result: 'success', contextFiles: ['seed.txt'], contextHash: 'stale-hash-value' }
	}), 'utf8');

	const err = testPrompt(
		createConfig(workspaceRoot, { reportFile, checkOnly: true }),
		'create a note named summary.txt saying behavior ok',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'summary-pass'
	);

	expect(err).toContain('[cache]');
});

test('does not write report when test fails', () => {
	const workspaceRoot = createWorkspace('report-no-write-on-fail');
	const reportFile = path.join(TMP_ROOT, 'report-no-write-on-fail.json');

	const err = testPrompt(
		createConfig(workspaceRoot, { reportFile }),
		'create a research about our customer base. We have 30% of customer > 50 years; 90% > 20',
		'Verify if summary.txt exists and the final output mentions summary.txt',
		'customer-fail'
	);

	expect(err).not.toBe('');
	expect(fs.existsSync(reportFile)).toBe(false);
});

	function createConfig(workspaceRoot, overrides = {}) {
	return {
		promptCmd: copilotCmd(workspaceRoot),
		workspaceRoot,
		workspaceMode: 'copy',
		reportFile: null,
		env: {
			PATH: `${COPILOT_DIR}:${process.env.PATH}`
		},
		...overrides
	};
}

function createWorkspace(name, options = {}) {
	const workspaceRoot = path.join(TMP_ROOT, name);
	fs.mkdirSync(workspaceRoot, { recursive: true });
	fs.writeFileSync(path.join(workspaceRoot, 'seed.txt'), 'seed\n', 'utf8');

	if (options.withIgnoredEntries) {
		fs.writeFileSync(path.join(workspaceRoot, '.gitignore'), 'ignored/\n', 'utf8');
		fs.mkdirSync(path.join(workspaceRoot, 'ignored'), { recursive: true });
		fs.writeFileSync(path.join(workspaceRoot, 'ignored', 'seed.txt'), 'ignored seed\n', 'utf8');
		fs.mkdirSync(path.join(workspaceRoot, '.git'), { recursive: true });
		fs.writeFileSync(path.join(workspaceRoot, '.git', 'config'), 'git config\n', 'utf8');
		fs.mkdirSync(path.join(workspaceRoot, 'nested', '.git'), { recursive: true });
		fs.writeFileSync(path.join(workspaceRoot, 'nested', '.git', 'config'), 'nested git config\n', 'utf8');
	}

	return workspaceRoot;
}

function assertFileExists(filePath) {
	expect(fs.existsSync(filePath)).toBe(true);
}