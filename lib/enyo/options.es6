'use strict';

import path     from 'path';
import {fsync}  from '../util-extra';
import {stdout} from '../logger';

const PACKAGE_FILE = path.join(__dirname, '..', '..', 'package.json');

export default {
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
		help: 'Typically only used for debugging purposes. Available options are ' + 
			'[fatal, error, warn, info, debug, trace]. Defaults to "warn".'
	},
	logJson: {
		full: 'log-json',
		help: 'Enable this flag to ensure the output of the logging is the normal bunayn "JSON" format to STDOUT that can be piped to their ' +
			'separate bunyan cli tool for filtering.',
		flag: true,
		default: false
	},
	version: {
		abbr: 'v',
		help: 'Display the current version of the tools and exit.',
		flag: true,
		callback () {
			let {result: json} = fsync.readJson(PACKAGE_FILE);
			stdout(`enyo-dev version ${json.version}`);
			process.exit();
		}
	}
};