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
			promptCmd: copilotCmd(REPO_ROOT),
		},
		'Reply with READY and nothing else.',
		'Verify that the final output is READY and nothing else.',
		null,
		true
	);

	expect(err).toBe('');
});

test.skip('005-write-research creates an IMRAD research document in copy mode', () => {
	const err = testPrompt(
		{
			workspaceRoot: REPO_ROOT,
			workspaceMode: 'copy',
			promptCmd: copilotCmd(REPO_ROOT),
		},
		'Create a very small research document with the following data: We measured the installation time in our monorepo and pnpm is 3.5x faster than Yarn when installing dependencies. We recommend using PNPM in our monorepo to speed up our productivity as it seems very easy to use and have a better internal hoisting mechanism.',
		'Verify that a research file was created under .xdrs/_local/edrs/devops/researches/, that it contains the sections Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References, and that the content contains all the provided data in input prompt, and doesn\'t contain more than 20% of additional information.',
		'005-write-research-imrad-copy'
	);

	expect(err).toBe('');
});