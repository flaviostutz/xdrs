'use strict';

const path = require('path');
const { copilotCmd, testPrompt } = require('xdrs-core');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');

jest.setTimeout(60000);

test('check', () => {
	const err = testPrompt(
		{
			workspaceRoot: REPO_ROOT,
			workspaceMode: 'in-place',
			promptCmd: copilotCmd(REPO_ROOT)
		},
		'Reply with READY and nothing else.',
		'Verify that the final output is READY and nothing else.',
		true
	);

	expect(err).toBe('');
});

test.skip('005-write-research creates an IMRAD research document in copy mode', () => {
	const err = testPrompt(
		{
			workspaceRoot: REPO_ROOT,
			workspaceMode: 'copy',
			promptCmd: copilotCmd(REPO_ROOT)
		},
		'Create a research document comparing package distribution options for our XDR scopes. Use scope _local, type adrs, subject principles. The research should support a later ADR. Evaluate npm package delivery, git submodules, and manual copy-paste. Use document review and a comparison table as acceptable methods. The next step after this research is deciding whether to standardize npm distribution.',
		'Verify that a research file was created under .xdrs/_local/adrs/principles/researches/, that it contains the IMRAD sections Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References, includes a Question: line in the introduction, references 006-research-standards.md, and that the final output mentions the created research path.'
	);

	expect(err).toBe('');
});