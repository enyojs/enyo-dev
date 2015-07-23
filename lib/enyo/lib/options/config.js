'use strict';

var
	env = require('../env');

module.exports = {
	name: 'config',
	help: 'Update, remove or set configuration options for your project or environment.',
	options: {
		global: {
			abbr: 'g',
			flag: true,
			help: 'Execute the current operation on the global configuration.'
		},
		get: {
			flag: true,
			help: 'Retrieve the target as it would be resolved by a command from the current ' +
				'configuration file (global only if the --global flag is set).'
		},
		set: {
			flag: true,
			help: 'Set the target to the value. If target is an array the value will be added to the ' +
				'array if it does not exist. If the target is an array or the --array flag is set ' +
				'and the value is a comma-separated list of values, they will all be added to the ' +
				'array if they do not already exist. Set the --global flag to update the global ' +
				'configuration or defaults. This is implied if value exists. If no value exists the ' +
				'target will be removed entirely. NOTE you cannot set an object directly, only ' +
				'properties of an object.'
		},
		array: {
			flag: true,
			abbr: 'a',
			help: 'Add or remove the current value(s) from a configuration array. If the target ' +
				'already exists in the configuration and is an array, this is implied.'
		},
		remove: {
			flag: true,
			abbr: 'r',
			help: 'Remove the target from an array or, if not an array, remove the option altogether.'
		},
		reset: {
			flag: true,
			help: 'If a target is provided, will reset the project configuration target to the ' +
				'current user-level default value. If the --global flag is set and target is ' +
				'provided it will reset the appropriate user-level configuration to the system ' +
				'default value. If no target is provided the project configuration will be reset ' +
				'to the current user-level configuration defaults. If the --global flag is set and ' +
				'no target is provided it will reset the user-level configuration file and defaults ' +
				'to system defaults. CANNOT BE UNDONE.'
		},
		target: {
			position: 1,
			help: 'The configuration property to retrieve, set or remove. When the --global flag ' +
				'is set will update the user-level configuration file unless target begins with ' +
				'default.[target] in which case it will update the project defaults configuration.'
		},
		value: {
			position: 2,
			help: 'The value(s) to add/set to target. If an array, can be a comma-separated list ' +
				'of values to add/remove.'
		}
	},
	callback: function (opts) {
		env(opts).then(require('../config'));
	}
};