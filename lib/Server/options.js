'use strict';

var
	clone = require('clone');

var
	options = clone(require('../Packager/options'), false);

module.exports = exports = options;

exports.port = {
	abbr: 'p',
	help: 'The port to bind to for incoming requests.',
	default: '8000'
};

exports.localOnly = {
	help: 'Whether or not to only accept connections from localhost. Supersedes the bind-address ' +
		'value if set.',
	flag: true,
	default: false
};

exports.webRoot = {
	help: 'The relative path from the current working directory to host files from. The default is ' +
		'the outdir value or if watch is false and this is unspecified it will use the current ' +
		'working directory.',
	full: 'web-root',
	abbr: 'R'
};

exports.bindAddress = {
	help: 'If you need the server to bind to a specific address set this value. This is ignored if ' +
		'local-only is true.',
	abbr: 'B'
};

exports.watch.help += ' If set to false, the server becomes a standard web-server.';
exports.watch.default = true;