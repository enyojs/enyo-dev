'use strict';


module.exports = {
	
	init: {
		help: 'Initialize the target directory as an Enyo project.',
		flag: true
	},
	
	package: {
		help: 'The relative path to the target directory, if it does not exist it will be created',
		position: 0,
		default: '.'
	},
	
	logLevel: {
		full: 'log-level',
		abbr: 'l',
		default: 'info',
		help: 'What level of output to use [error, log, debug, info, verbose]'
	}
	
};