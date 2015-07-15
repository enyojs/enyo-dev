'use strict';

var
	path = require('path');

var
	setup = require('../setup');

module.exports = {
	name: 'init',
	help: 'Initialize a new or existing Enyo project to generate required files and ensure dependencies.',
	options: {
		project: {
			position: 1,
			help: 'The relative path to the project to initialize. Defaults to the current working directory'
		},
		name: {
			flag: true,
			help: 'If set, will be applied to the package.json file as "name" otherwise it will ' +
				'assume the existing value (if any) and fallback to the current directory name.'
		},
		libraries: {
			abbr: 'L',
			help: 'A comma-separated list of specific libraries to install instead of those listed ' +
				'in the "libraries" configuration array. A "source" entry for the named library ' +
				'must still exist unless the --link-all-libs flag is set or the library is in the ' +
				'"link" configuration array or in the --link array list.',
			transform: function (list) {
				return list.trim().split(',');
			}
		},
		link: {
			help: 'A comma-separated list of specific libraries to install as a linked library.',
			transform: function (list) {
				return list.trim().split(',');
			}
		},
		linkAllLibs: {
			full: 'link-all-libs',
			help: 'Set this to link from the linkable libraries instead of installing a local ' +
				'repository for each. If a library already exists and is not a link it will be ' +
				'overwritten.',
			flag: true
		}
	},
	callback: function (opts) {
		opts.project = path.resolve(opts.project || process.cwd());
		opts.cwd = opts.project;
		setup(opts).then(require('../init'));
	}
};