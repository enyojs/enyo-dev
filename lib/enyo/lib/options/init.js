'use strict';

var
	path = require('path');

var
	env = require('../env'),
	cli = require('../../../cli-logger');

module.exports = {
	name: 'init',
	help: 'Initialize a new or existing Enyo project to generate required files and ensure dependencies.',
	options: {
		project: {
			position: 1,
			help: 'The relative path to the project to initialize. Defaults to the current working directory. ' +
				'If the project directory does not exist it will be created.'
		},
		name: {
			help: 'This is the name of the project for the project-level configuration. If not provided and a ' +
				'package.json exists then it will use its "name" value. If not provided and neither ' +
				'a package.json or project-level configuration exists it will default to using the ' +
				'directory name.'
		},
		title: {
			help: 'This is the title that will be applied to the project-level configuration and ' +
				'ultimately used when packaging (if the project is not a library).'
		},
		package: {
			flag: true,
			default: true,
			help: 'By default this will initialize a package.json file. If this is not desired ' +
				'set this to false with --no-package.'
		},
		config: {
			flag: true,
			default: true,
			help: 'By default this will initialize a .enyoconfig file. If this is not desired ' +
				'set this to false with --no-config.'
		},
		gitIgnore: {
			full: 'git-ignore',
			flag: true,
			default: true,
			help: 'By default this will initialize or update a .gitignore file. If this is not desired ' +
				'set this to false with --no-git-ignore.'
		},
		dependencies: {
			full: 'dependencies',
			flag: true,
			default: true,
			help: 'To initialize the repository but without initializing any dependencies set this ' +
				'flag to false with --no-dependencies.'
		},
		libraries: {
			abbr: 'L',
			help: 'Only initialize this comma-separated list of library names. If the --save option ' +
				'is set will save this value as the project\'s only libraries.',
			transform: function (list) {
				return list && typeof list == 'string' ? list.trim().split(',') : '';
			}
		},
		links: {
			help: 'A comma-separated list of specific libraries to install as a linked library. If ' +
				'provided, these links will be merged with any existing directives from the configuration ' +
				'unless the --save flag is set in which case it will replace any existing values ' +
				'and be stored. If a link is specified but already exists and is not a link it will ' +
				'be replaced by the link - LOCAL CHANGES WILL BE LOST AND ARE UNRECOVERABLE. To avoid ' +
				'this behavior, use the --safe flag.',
			transform: function (list) {
				return list && typeof list == 'string' ? list.trim().split(',') : '';
			}
		},
		linkAllLibs: {
			full: 'link-all-libs',
			help: 'Set this to link from the linkable libraries instead of installing a local ' +
				'repository for each. If a library already exists and is not a link it will be ' +
				'replaced by the link - LOCAL CHANGES WILL BE LOST AND ARE UNRECOVERABLE. To avoid ' +
				'this behavior, use the --safe flag. If the --save flag is set, this option will ' +
				'be set to true in the project-level configuration.',
			flag: true
		},
		linkAvailable: {
			full: 'link-available',
			flag: true,
			help: 'Set this to link any of the target libraries that are linkable on the system and ' +
				'fallback to installing normally when they cannot be linked. Ensure that you use --safe ' +
				'when you have local modifications to a local repository already installed.'
		},
		save: {
			flag: true,
			help: 'Set this flag to save specified options for the libraries, links and link-all-libs ' +
				'command options.'
		},
		safe: {
			flag: true,
			help: 'Set this flag to ensure that links for existing directories will not replace ' +
				'the existing library and potentially lose local changes.'
		},
		library: {
			flag: true,
			help: 'When initializing a library use this flag so that it will not attempt to apply ' +
				'normal project defaults such as dependencies or other unnecessary options.'
		},
		reset: {
			flag: true,
			help: 'Convenience flag to use to reset your project-level configuration when initializing. ' +
				'This will only reset your .enyoconfig, not your .gitignore or package.json files. ' +
				'Resetting your project configuration will start from your current defaults settings. ' +
				'This option is ignored if --no-config is set.'
		},
		register: {
			flag: true,
			help: 'Be default the current project will have a reference saved in your user-projects ' +
				'directory that enables other tools, such as the serve command, to be able to be ' +
				'aware of these projects on the system. If for some reason you do not wich to have this ' +
				'project referenceable, use the --no-register option.'
		}
	},
	callback: function (opts) {
		opts.project = path.resolve(opts.project || process.cwd());
		opts.cwd = opts.project;
		env(opts).then(require('../init')).then(function (results) {
			if (results) {
				results.forEach(function (result) {
					if (result.isRejected()) {
						cli(result.reason().message);
					}
				});
			}
		});
	}
};