'use strict';

var
	Generator = require('./');

module.exports = [
	{
		name: 'init',
		help: 'Initialize the target as an enyo project by installing necessary components in ' +
			'default locations. If no libs are specified, the default collection of enyo-' +
			'related libraries will be installed. If a bower.json already exists with dependencies they will ' +
			'be used instead of the defaults (with preference given to any specified with the --libs option). ' +
			'To combine them with the defaults, use the --defaults flag.',
		options: {
			package: {
				help: 'The relative path to the target directory, if it does not exist it will be created.',
				default: '.',
				position: 1
			},
			name: {
				help: 'The name of the project. If not set it will attempt to find it from an available ' +
					'package.json file and if not found will default to the package name (directory)'
			},
			libs: {
				help: 'A comma-separated list of libraries to include that overrides the default of all enyo-related ' +
					'libraries. Additional libraries can be installed from git paths or bower.' +
					'\n\n\t\tExample: --libs=moonstone,enyo=git@github.com:enyojs/enyo.git#master,enyo-ilib\n',
				transform: function (entry) {
					return entry && typeof entry == 'string' ? entry.split(',') : null;
				}
			},
			linkLibs: {
				full: 'link-libs',
				help: 'A comma-separated list of libraries to link from locally installed, bower-linked versions of the named ' +
					'dependent library. Note this requires the libraries to have been checked out on ' +
					'the current system and have had `bower link` executed in each.' +
					'\n\n\t\tExample: --link-libs=moonstone,enyo\n',
				transform: function (entry) {
					return entry && typeof entry == 'string' ? entry.split(',') : null;
				}
			},
			linkAllLibs: {
				full: 'link-all-libs',
				flag: true,
				help: 'Use this to indicate that all requested libraries are to be linked.',
				default: false
			},
			defaults: {
				flag: true,
				default: false,
				help: 'Use this when you already have dependencies in your bower.json file but also want to install any ' +
					'missing defaults. If any of the default libraries are listed their version will be used instead of the default'
			},
			save: {
				flag: true,
				default: false,
				help: 'When installing dependencies, set this to preserve them to your bower.json file.'
			}
		},
		callback: function (opts) {
			new Generator(opts).init();
		}
	}
];