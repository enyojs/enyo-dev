'use strict';

import link                from '../link';
import env                 from '../env';

export default {
	name: 'link',
	help: 'Manage linkable libraries. Make the current library linkable or add a linkable library as a dependency of ' +
		'the current project. List known linkable libraries and their real locations or linked libraries of the ' +
		'current project. This command is not available in non-user mode.',
	options: {
		target: {
			position: 1,
			help: 'If linking a library into the current project, this is the name of the library to link. If ' +
				'omitted the current library will be made linkable to other projects. This can also be a comma-separated ' +
				'list of libraries to link into the current project.'
		},
		listLocal: {
			full: 'list-local',
			abbr: 'r',
			flag: true,
			default: false,
			help: 'Print a list of the libraries already linked in the current project. If "target" is provided with this flag ' +
				'it will attempt to print links from the project at that location.'
		},
		listLinkable: {
			full: 'list-linkable',
			abbr: 'L',
			flag: true,
			default: false,
			help: 'Print a list of the linkable libraries known on the system.'
		},
		force: {
			flag: true,
			default: false,
			help: 'Forces a link to be made regardless of whether or not the dependency already exists. This should ' +
				'be used with caution as it may overwrite an existing local repository. All local changes in the repository ' +
				'would be lost.'
		}
	},
	callback (opts) {
		link({opts, env: env(opts)});
	}
};