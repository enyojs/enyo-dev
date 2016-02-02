'use strict';

import env       from '../env';
import templates from '../templates';

export default {
	name: 'templates',
	help: 'List, add, remove and change the default templates for the current user. This command cannot be used in script-safe mode.',
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
				'except the "list" action.'
		}
	},
	callback (opts) {
		env(opts).then(templates);
	}
};