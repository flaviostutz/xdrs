#!/usr/bin/env node
'use strict';

const { runLintCli } = require('../lib/lint');

const args = process.argv.slice(2);

if (args[0] === 'lint') {
	process.exitCode = runLintCli(args.slice(1));
} else {
	require('filedist').binpkg(__dirname, args);
}
