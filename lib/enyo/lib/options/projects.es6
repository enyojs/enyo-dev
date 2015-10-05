'use strict';

import env from '../env';
import projects from '../projects';
import cli from '../../../cli-logger';

export default {
	name: 'projects',
	help: 'List, add or remove project entries in the user-level projects registry.',
	options: {
		project: {
			position: 1,
			help: 'When registering or unregistering a project, set this to the path for the project. ' +
				'Defaults to the current working directory if it has a valid enyo configuration file.'
		},
		register: {
			abbr: 'r',
			flag: true,
			help: 'To register a new project without using the enyo init command, set this and provide ' +
				'a path to the project to register. Defaults to the current working directory if it has ' +
				'a valid enyo configuration file.'
		},
		unregister: {
			abbr: 'u',
			flag: true,
			help: 'To unregister a project set this and provide a path to the project to unregister. Defaults ' +
				'to the current working directory if it has a valid enyo configuration file.'
		},
		list: {
			abbr: 'l',
			flag: true,
			help: 'To list all known projects by name and location, set this flag (default action if none specified). ' +
				'To list all locations for a project of a specific name, pass the name as the project.'
		}
	},
	callback (opts) {
		if (opts.project && !opts.list) opts.cwd = opts.project;
		env(opts).then(projects).catch(e => {
			cli(e.message);
			cli('is this a valid enyo project?');
		});
	}
};