'use strict';

var
	setup = require('../setup');

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
			metavar: 'TARGET',
			help: 'The name of the target, linkable library to link into the current project. If ' +
				'omitted the current library will be made linkable by-name from other projects. This ' +
				'can also be a comma-separated list of linkable libraries to link into the current ' +
				'project.'
		}
	},
	callback: function (opts) {
		setup(opts).then(require('../link'));
	}
};