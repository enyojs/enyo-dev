'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _utilExtra = require('../util-extra');

var _logger = require('../logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PACKAGE_FILE = _path2.default.join(__dirname, '..', '..', 'package.json');

exports.default = {
	user: {
		full: 'user',
		flag: true,
		default: true,
		help: 'Set this to false when executing from an automated script or in an environment where a user-environment should not be used.'
	},
	logLevel: {
		full: 'log-level',
		abbr: 'l',
		default: 'warn',
		help: 'Typically only used for debugging purposes. Available options are ' + '[fatal, error, warn, info, debug, trace]. Defaults to "warn".'
	},
	logJson: {
		full: 'log-json',
		help: 'Enable this flag to ensure the output of the logging is the normal bunayn "JSON" format to STDOUT that can be piped to their ' + 'separate bunyan cli tool for filtering.',
		flag: true,
		default: false
	},
	version: {
		abbr: 'v',
		help: 'Display the current version of the tools and exit.',
		flag: true,
		callback: function callback() {
			var _fsync$readJson = _utilExtra.fsync.readJson(PACKAGE_FILE),
			    json = _fsync$readJson.result;

			(0, _logger.stdout)('enyo-dev version ' + json.version);
			process.exit();
		}
	}
};