'use strict';

import env       from '../env';
import templates from '../templates';

export default {
	name: 'templates',
	help: 'List, add, remove and change the default templates for the current user. This command cannot be used in non-user mode.',
	options: {
		target: {
			position: 2,
			help: 'When adding a template this is the full or relative path to the template installer. When removing a template ' +
				'this is the name of the installed template. When setting a default template this is the name of the installed template. ' +
				'When installing a template this is the URI of the remote template to fetch and install.'
		},
		action: {
			position: 1,
			help: 'This is one of "add", "remove", "list", "install" or "default". The action must be provided and all actions require a "target" ' +
				'except the "list" action. The "add" action takes a local directory you have setup as a template and creates a symbolic link internally ' +
				'so you can select it by name (or set as the default) and it will update as you make changes to your development directory. The ' +
				'"install" action will retrieve a remote URI and install it locally for selection. The "remove" action will remove either the ' +
				'symbolic link or copy of an installed template by name. The "list" command will print a list of available templates denoting the ' +
				'current default template with an asterisk (*). The "default" action allows you to set the default template of the system by name. ' +
				'Using the "default" action with no "target" will remove any default.'
		},
		logLevel: {
			full: 'log-level',
			abbr: 'l',
			help: 'Typically only used for debugging purposes. Available options are ' + 
				'[fatal, error, warn, info, debug, trace]. Defaults to "warn".'
		}
	},
	callback (opts) {
		templates({opts, env: env(opts)});
	}
};