'use strict';

module.exports = {

	configFile: {
		full: 'config-file',
		abbr: 'c',
		help: 'The configuration file to read, defaults first to a .enyoconfig in the current ' +
			'directory or looks for one in the users (platform specific) HOME directory'
	},
	
	interactive: {
		abbr: 'i',
		help: 'For some operations user input may be required and with interactive enabled it will ' +
			'request this input during the session. If interactive is disabled it will use all ' +
			'default values where necessary. Only disable this if you are sure the defaults will ' +
			'produce the desired results (default true).',
		flag: true
	}

};