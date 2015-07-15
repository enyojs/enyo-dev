'use strict';

var
	setup = require('../setup');

module.exports = {
	name: 'unlink',
	help: 'Unlink the TARGET library from the current project or, if linkable, remove the current ' +
		'library from linkable libraries by other projects.',
	options: {
		target: {
			position: 1,
			metavar: 'TARGET',
			help: 'The name of the TARGET library to unlink from the given project.'
		},
		unlinkAll: {
			full: 'unlink-all',
			abbr: 'U',
			help: 'If used within a project all links in the project will be unlinked otherwise ' +
				'all linkable projects in the user\'s environment will be unlinked, essentially ' +
				'resetting all linkable projects. If TARGET is provided with this flag it will be ' +
				'ignored.',
			flag: true
		},
		global: {
			abbr: 'g',
			flag: true,
			help: 'If set, the TARGET library will be unlinked from the user\'s environment or, if ' +
				'set with the --unlink-all flag will unlink all linkable projects from the users\'s ' +
				'environment as if they were outside of a project directory.'
		}
	},
	callback: function (opts) {
		setup(opts).then(require('../unlink'));
	}
};