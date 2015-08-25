'use strict';

module.exports = {
	configFile: {
		full: 'config-file',
		abbr: 'c',
		help: 'Set this to a custom configuration file, otherwise defaults to .enyoconfig in the ' +
			'target working directory.'
	},
	interactive: {
		abbr: 'i',
		help: 'Various commands may need user input. To avoid interactive sessions and always use ' +
			'the built-in resolution options set this to false.',
		flag: true
	},
	scriptSafe: {
		full: 'script-safe',
		flag: true,
		help: 'When executing commands within an automated script or without an active terminal ' +
			'set this flag to true.'
	},
	version: {
		abbr: 'v',
		help: 'Display the current version of the tools and exit.',
		flag: true,
		callback: function () {
			var path, util, fs, json, file;
			path = require('path');
			fs = require('fs-extra');
			util = require('util');
			file = path.join(__dirname, '..', '..', 'package.json');
			json = fs.readJsonSync(file);
			return util.format('enyo-dev version %s', json.version);
		}
	}
};