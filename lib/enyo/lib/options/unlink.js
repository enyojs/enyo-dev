'use strict';

var
	env = require('../env'),
	cli = require('../../../cli-logger');

module.exports = {
	name: 'unlink',
	help: 'Unlink the target library from the current project or, if linkable, remove the current ' +
		'library from linkable libraries by other projects.',
	options: {
		target: {
			position: 1,
			help: 'The name of the target library to unlink from the given project. If using --unlink-all ' +
				'this can be set to a relative path to the target project. Target can be a comma-separated ' +
				'list of libraries to unlink.',
			transform: function (target) {
				if (target && typeof target == 'string') {
					if (target.indexOf(',') > -1) return target.split(',');
					else return target;
				}
			}
		},
		unlinkAll: {
			full: 'unlink-all',
			abbr: 'U',
			help: 'Set this to unlink all linked libraries in the current project. Use the --save ' +
				'flag to indicate you wish to also remove all entries in the "links" property array. ' +
				'If --unlink-all is used with --global it will unlink all linkable projects in the ' +
				'user\'s environment (essentially a reset for linkable projects).',
			flag: true
		},
		global: {
			abbr: 'g',
			flag: true,
			help: 'If set, the target library will be unlinked from the user\'s environment or, if ' +
				'set with the --unlink-all flag will unlink all linkable projects from the users\'s ' +
				'environment as if they were outside of a project directory.'
		},
		save: {
			flag: true,
			help: 'Set this to save changes made to a project, ignored if the --global flag is set.'
		}
	},
	callback: function (opts) {
		if (opts.unlinkAll && !opts.global && opts.target && typeof opts.target == 'string') {
			opts.cwd = opts.target;
		}
		
		env(opts).then(require('../unlink')).then(function (results) {
			if (results) {
				results.forEach(function (result) {
					if (result.isRejected()) cli(result.reason().message);
				});
			}
		}).catch(function (e) {
			cli(e.message);
		});
	}
};