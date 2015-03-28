'use strict';

var
	options = require('../Packager/options');

module.exports = exports = options;

exports.port = {
	abbr: 'p',
	help: 'The port to bind to for incoming requests',
	default: '8000'
};

exports.localOnly = {
	help: 'Whether or not to only accept connections from localhost',
	flag: true,
	default: false
};

exports.webRoot = {
	help: 'The relative path from the current working directory to host files from',
	full: 'web-root',
	abbr: 'R'
};