'use strict';

var
	dev = require('../../'),
	findLinks = require('./lib/find-links'),
	config = require('./lib/config'),
	link = require('./lib/link'),
	unlink = require('./lib/unlink'),
	init = require('./lib/init'),
	packOpts = require('../Packager/options'),
	servOpts = require('../Server/options');

// update because when run separately from this command the position of the package argument would
// be 0 but now it will be 1
packOpts.package.position = 1;
servOpts.package.position = 1;

module.exports = [
	{
		name: 'init',
		help: 'Generate the necessary files for a brand-new enyo project or add to an existing ' +
			'project based on what files are missing. It will also read configuration options and ' +
			'ensure dependent libraries are present as needed.',
		options: {
			project: {
				position: 1,
				help: 'The relative path to the project root, defaults to current working directory.',
			},
			name: {
				help: 'If provided, will be set as the "name" property of the package.json file even ' +
					'if it already existed. If not provided will default first to any value that ' +
					'already exists and then the directory name of the project.'
			},
			linkAllLibs: {
				flag: true,
				full: 'link-all-libs',
				abbr: 'L',
				help: 'Command line override for the "linkAllLibs" configuration option. This is ' +
					'mostly helpful when developing against sources you already have on your local ' +
					'system and have discovered and shared your linkable libraries via the find-links ' +
					'or manual execution of the link command.'
			},
			replaceLinked: {
				flag: true,
				full: 'replace-linked',
				help: 'If you have linked particular libraries but they are not specified as being ' +
					'linked from the configuration file, the default behavior is to preserve those ' +
					'links. If, instead, you want to remove the links and replace them with the ' +
					'sandboxed copy of the repository, set this to true.'
			},
			ignore: {
				abbr: 'I',
				help: 'A comma-seprated list of libraries to ignore when initializing. This can be ' +
					'used to re-initialize all libraries except the named ones to preserve their ' +
					'current state.',
				transform: function (i) {
					return i && typeof i == 'string' ? i.trim().split(',') : null;
				}
			}
		},
		callback: init
	},
	{
		name: 'link',
		help: 'When used without a target will make the current library/project linkable from other ' +
			'projects. See the configurable options to modify the behavior of this command.',
		options: {
			'as': {
				help: 'If set when creating a link entry for the current project it will override ' +
					'the given "name" property of the package.json file. The new name will be the ' +
					'one referenced by projects that wish to include it by link. When linking locally ' +
					'this will override the default name from target.'
			},
			save: {
				flag: true,
				help: 'When used to create a link from a linkable library/project to the current ' +
					'project, will add an entry to the local or specified configuration file or ' +
					'create it, if necessary. When saving it only creates an entry in libraries but ' +
					'does not save the linked status.'
			},
			target: {
				position: 1,
				help: 'The name of the linkable library/project to add to the current project if ' +
					'it is linkable.'
			}
		},
		callback: link
	},
	{
		name: 'unlink',
		help: 'A convenience method to safely remove a linkable entry for the given library/project ' +
			'or, if a target is specified, the local link in the current project will be removed.',
		options: {
			'as': {
				help: 'If the current library was linked as a name other than the "name" property ' +
					'of its package.json file this must be set to the same.'
			},
			save: {
				flag: true,
				help: 'If removing a local link from the given project and an entry for the library ' +
					'exists in the configuration file it will be removed.'
			},
			target: {
				position: 1,
				help: 'The locally linked target to remove.'
			}
		},
		callback: unlink
	},
	{
		name: 'find-links',
		help: 'Search for libraries from the target location (or current working directory) and ' +
			'make it available to be linked by other projects. For individual linking see the ' +
			'link command. This will create a linkable entry for any top-level directories found ' +
			'that have a package.json file with a name property (used as the linkable name, not ' +
			'the directory name). These libraries will then be able to be linked into projects that ' +
			'specify them as linkable via the "link" array (defaults.link) or by using the ' +
			'"linkAllLibs" configuration option (defaults.linkAllLibs).',
		options: {
			target: {
				help: 'The target directory to search for linkable libraries relative to the current ' +
					'working directory. Defaults to the current working directory.',
				position: 1
			},
			skip: {
				help: 'A comma-separated list of linkable libraries to skip. This should be the ' +
					'name as specified in the libraries own package.json not the directory name ' +
					'where it is found.',
				transform: function (skips) {
					return skips && typeof skips == 'string' ? skips.trim().split(',') : null;
				}
			}
		},
		callback: findLinks
	},
	{
		name: 'config',
		help: 'Set a particular configuration option that will be interpreted by other commands.',
		options: {
			global: {
				abbr: 'g',
				help: 'Set this flag to ensure that the setting will be applied to the global user\'s ' +
					'configuration otherwise it will use the specified configuration file or the ' +
					'local configuration file (in the current directory).',
				flag: true
			},
			init: {
				flag: true,
				help: 'Initialize a new configuration file. If used with the --global flag this will ' +
					'generate a new user-level (global) configuration file if one does not exist ' +
					'otherwise it will generate one specified via the --config-file option or in ' +
					'the current directory, if one does not already exist.'
			},
			get: {
				flag: true,
				help: 'Set this flag to read the requested option from the configuration.'
			},
			remove: {
				flag: true,
				abbr: 'r',
				help: 'If set and a value exists in the targeted array it will be removed. If set ' +
					'and the key exists on the targeted configuration object the entry will be removed.'
			},
			copyConfig: {
				full: 'copy',
				flag: true,
				help: 'The default behavior for configuration when a file does not exist is to supply ' +
					'the defaults; set this flag to instead use your current global configuration as ' +
					'a starting place. This can also be set in your defaults.copyConfig option.'
			},
			listProperties: {
				full: 'list',
				abbr: 'l',
				help: 'Print a list of valid configuration properties and their types as expected ' +
					'in the configuration file. Arrays and objects are updated with new entries and ' +
					'cannot be set directly from the CLI (at this time).',
				flag: true
			},
			option: {
				position: 1,
				metavar: 'OPTION',
				help: 'The option to be updated. Use dot-notation to indicate sub-options. You cannot ' +
					'set an object directly but you can update valid sub-entries. Setting a value on ' +
					'an array will add the unique value to the array.'
			},
			value: {
				position: 2,
				metavar: 'VALUE',
				help: 'The new value to assign to OPTION. If not provided the OPTION will be removed ' +
					'from the configuration. Note that all values are converted to their JSON ' +
					'appropriate types.'
			}
		},
		callback: config
	},
	{
		name: 'serve',
		help: 'Executes an HTTP server capabale of automatically rebuilding a ' +
			'project\'s source when changes occur. With watch set to false, is a simple web-server.',
		options: servOpts,
		callback: dev.serve
	},
	{
		name: 'pack',
		help: 'Build an Enyo 2.6 application and optionally watch for changes and automatically ' +
			'rebuild.',
		options: packOpts,
		callback: dev.package
	}
];