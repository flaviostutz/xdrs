#!/usr/bin/env node
'use strict';

const { runValidateCli } = require('../lib/validate');

const args = process.argv.slice(2);

if (args[0] === 'validate') {
	process.exitCode = runValidateCli(args.slice(1));
} else {
	require('filedist').binpkg(__dirname, args);
}
