'use strict';

import unlink from '../unlink';

export default {
	name: 'unlink',
	help: 'Unlink a library from the current project or the system or, if the current working directory ' +
		'is a library, make it unlinkable on the system.',
	options: {
		target: {
			position: 1,
			help: 'The name of the library to unlink. If in a project and no other flags specified, will attempt to unlink ' +
				'the library from the current project. If specifying a project that is not the current working directory use ' +
				'the "project" parameter. To unlink multiple libraries from the same project or from the system this parameter ' +
				'should be a comma-separated list of names. If using the "unlink-all" flag this property behaves like the "project" ' +
				'parameter unless the "global" flag is set, in which case it will be ignored.'
		},
		project: {
			position: 2,
			help: 'The path to the project form which to unlink the "target" library/libraries. Defaults to the current ' +
				'working directory. When using the "global" flag this parameter is ignored.'
		},
		unlinkAll: {
			full: 'unlink-all',
			abbr: 'U',
			help: 'Instead of removing one or a few libraries from the project or system, unlink them all. When using this ' +
				'flag the "target" parameter behaves like the "project" parameter unless the "global" flag is set.',
			flag: true
		},
		global: {
			abbr: 'g',
			flag: true,
			help: 'Set this to target system links. Will ignore pathing parameters when this flag is set.'
		}
	},
	callback (opts) {
		unlink({opts});
	}
};