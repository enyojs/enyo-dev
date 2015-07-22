'use strict';

module.exports = {
	configFile: {
		full: 'config-file',
		abbr: 'c',
		help: 'Set this to a custom configuration file, otherwise defaults to .enyoconfig in the ' +
			'target working directory.'
	},
	interactive: {
		abbr: 'i',
		help: 'Various commands may need user input. To avoid interactive sessions and always use ' +
			'the built-in resolution options set this to false.',
		flag: true
	},
	scriptSafe: {
		full: 'script-safe',
		flag: true,
		help: 'When executing commands within an automated script or without an active terminal ' +
			'set this flag to true.'
	}
};