'use strict';

var
	setup = require('../setup');

module.exports = {
	name: 'find-links',
	help: 'Quickly find and add libraries or project\'s as linkable from other projects. A linkable ' +
		'project must have a package.json file with at least a "name" specified. If --interactive mode ' +
		'is off, this will automatically add all available projects (usually harmless). This method is not ' +
		'recursive.',
	options: {
		target: {
			position: 1,
			metavar: 'TARGET',
			help: 'The TARGET directory to search for linkable libraries. Defaults to the current ' +
				'working directory.'
		},
		ignoreDuplicates: {
			flag: true,
			full: 'ignore-duplicates',
			abbr: 'i',
			help: 'In cases where projects with the same name are found at different paths they must ' +
				'be resolved. If --interactive mode is false they will be skipped or if this flag is ' +
				'set they will also be skipped.'
		}
	},
	callback: function (opts) {
		setup(opts).then(require('../find-links'));
	}
};