'use strict';

var
	env = require('../env'),
	cli = require('../../../cli-logger');

module.exports = {
	name: 'find-links',
	help: 'Quickly find libraries and make them linkable by other projects. It executes a recursive search ' +
		'but igores symbolic links. This will only find libraries that have been properly initialized ' +
		'as a library and uses the "name" value of their configuration. If a duplicate library is encountered ' +
		' and interactive mode is disabled the duplicates will be reported but ignored. If interactive mode ' +
		'is on, it will ask you which path to use for a given duplicate library.',
	options: {
		target: {
			position: 1,
			help: 'The target directory to begin searching for linkable libraries. Defaults to the ' +
				'current working directory.'
		},
		force: {
			flag: true,
			help: 'Set this to ensure that even if a link already exists it will be re-linked.'
		},
		depth: {
			abbr: 'd',
			help: 'Since find-links is recursive it can be very slow when starting from a complex  or ' +
				'deep directory structure. To avoid this, set the depth as to the number of directories deep ' +
				'it is allowed to search. It uses a default depth of 2.',
			callback: function (value) {
				if (isNaN(value)) return 'must provide a number';
				if (value < 1) return 'value must be greater than 0';
			}
		}
	},
	callback: function (opts) {
		env(opts).then(require('../find-links')).then(function (results) {
			if (results) {
				results.forEach(function (result) {
					if (result.isRejected()) cli(result.reason().message);
				});
			}
		}, function (e) {
			cli(e.stack);
		});
	}
};