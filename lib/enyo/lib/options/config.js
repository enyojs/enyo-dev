'use strict';

var
	setup = require('../setup');

module.exports = {
	name: 'config',
	help: 'Configure your Enyo development environment for an individual project or setup defaults.',
	options: {
		init: {
			flag: true,
			help: '(Re)initialize a configuration file. Without the --global flag will assume the ' +
				'current working directory.'
		},
		global: {
			abbr: 'g',
			flag: true,
			help: 'Execute the current operation on the global configuration.'
		},
		get: {
			flag: true,
			help: 'Retrieve the value of the target property as it would be resolved from the ' +
				'current working directory. If the --global flag is used, it will retrieve the ' +
				'property value from the global configuration instead of any local configuration. ' +
				'This is also implied if no VALUE is specified.'
		},
		array: {
			flag: true,
			abbr: 'a',
			help: 'If the entry (or comma-separated entries) are to be added to an array set this ' +
				'flag. If the entry already exists and is an array this is implied.'
		},
		remove: {
			flag: true,
			abbr: 'r',
			help: 'To remove the property entirely from the configuration, or if an array, remove ' +
				'the VALUE from the TARGET array, set this flag. Can remove multiple entries from ' +
				'an array with comma-separated list.'
		},
		target: {
			position: 1,
			metavar: 'TARGET',
			help: 'The property to configure or retrieve.'
		},
		value: {
			position: 2,
			metavar: 'VALUE',
			help: 'The value to set for TARGET in the current configuration.'
		}
	},
	callback: function (opts) {
		setup(opts).then(require('../config'));
	}
};