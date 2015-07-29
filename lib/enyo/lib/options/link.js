'use strict';

var
	Promise = require('bluebird');

var
	env = require('../env'),
	cli = require('../../../cli-logger');

module.exports = {
	name: 'link',
	help: 'Make the current library linkable from other projects or link a linkable library into ' +
		'the current project.',
	options: {
		force: {
			help: 'In cases where a symbolic link, file or directory already exists in the target ' +
				'location by the same name, remove it and continue anyway. NOTE: only use this option ' +
				'if you know what you are doing!',
			flag: true,
			abbr: 'f'
		},
		target: {
			position: 1,
			help: 'The name of the target, linkable library to link into the current project. If ' +
				'omitted the current library will be made linkable by-name from other projects. This ' +
				'can also be a comma-separated list of linkable libraries to link into the current ' +
				'project. The name value is taken from the .enyoconfig (project-level configuration) ' +
				'if it exists otherwise it will fail.'
		},
		save: {
			flag: true,
			help: 'If set and in a project, will add the library or libraries to the existing ' +
				'project-level configuration "links" property.'
		},
		list: {
			flag: true,
			abbr: 'l',
			help: 'Print a list of linked libraries in the current project or, if not in a project, ' +
				'will list all linkable (known) libraries.'
		},
		listLinkable: {
			flag: true,
			abbr: 'L',
			full: 'list-linkable',
			help: 'Regardless of the current working directory, list the known, linkable libraries.'
		}
	},
	callback: function (opts) {
		env(opts).then(require('../link')).then(function (results) {
			if (results) {
				results.forEach(function (result) {
					if (result instanceof Promise) {
						if (result.isRejected()) {
							cli(result.reason().message);
						}
					}
				});
			}
		}).catch(function (e) {
			cli(e.message);
		});
	}
};