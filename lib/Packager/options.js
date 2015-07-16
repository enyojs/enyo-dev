'use strict';

var
	minimist = require('minimist');

var
	subargs = require('../utils').subargs;

/**
* Available options used for the CLI packager but whose keys are the valid runtime options.
*/
module.exports = {
	
	package: {
		help: 'The relative path to the application directory to package',
		position: 0,
		default: '.'
	},
	
	logLevel: {
		full: 'log-level',
		abbr: 'l',
		default: 'fatal',
		help: 'Typically only used for debugging purposes. The process pipes a JSON stream of output that ' +
			'can be piped through the bunyan utility to be human-readable. Available options ' + 
			'[fatal, error, warn, info, debug, trace]'
	},
	
	devMode: {
		full: 'dev-mode',
		abbr: 'D',
		help: 'Whether or not this build is a development build; negated if --production set',
		flag: true,
		// temporary
		default: true
	},
	
	cache: {
		help: 'Enables the use of a cache-file, if it exists and also the ability to write to the ' +
			'cache-file. This cachefile can significantly improve build-times in some cases. To ' +
			'force a clean build but cache the results simply remove the cache file. ' +
			'To disable use --no-cache.',
		flag: true,
		default: true
	},
	
	resetCache: {
		help: 'Allows you to ignore an existing cache file but still write the cached output for ' +
			'subsequent runs.',
		full: 'reset-cache',
		abbr: 'r',
		flag: true
	},
	
	trustCache: {
		full: 'trust-cache',
		help: 'Convenience flag only used during watch-mode, when set, will default to using the ' +
			'cached data without re-building the output. This should only be used when you are ' +
			'certain nothing has changed and it has no need to re-evaluate the input source or ' +
			're-produce any of the output files.',
		flag: true,
		default: false
	},
	
	cacheFile: {
		full: 'cache-file',
		help: 'Set this to a specific filename for the cache file. If it is not the default, then ' +
			'this will need to be set to the correct file name in subsequent runs to be found',
		default: '.enyocache'
	},
	
	clean: {
		help: 'This will empty the outdir before writing any new files to it.',
		flag: true,
		default: false
	},
	
	sourceMaps: {
		full: 'source-maps',
		help: 'Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps',
		flag: true,
		default: true
	},
	
	production: {
		full: 'production',
		abbr: 'P',
		help: 'Build in production mode; supersedes the --dev-mode and --no-dev-mode flag',
		flag: true
	},
	
	paths: {
		full: 'paths',
		help: 'Relative paths (comma separated) indicating where the packager should ' +
			'search for required libraries',
		transform: function (paths) {
			return paths.split(',');
		},
		default: ['lib']
	},
	
	externals: {
		help: 'To build without bundled external libraries, use --no-externals; always false ' +
			'when in --library mode. NOTE that the library is still required to compile even if ' +
			'the output will not include it',
		flag: true,
		default: true
	},
	
	listOnly: {
		full: 'list-only',
		flag: true,
		default: false,
		help: 'Set this flag to have it output the dependency tree to stdout'
	},
	
	strict: {
		full: 'strict',
		flag: true,
		default: false,
		help: 'By default, if a style-file or asset file is missing, or if an asset path cannot ' +
			'be properly translated, only a warning will be issued. ' +
			'If this is true then it will halt the compilation.'
	},
	
	skip: {
		full: 'skip',
		help: 'A comma-separated list of external libraries that should not be included in the ' +
			'output when not in --library mode\n\n\t\tExample: --skip=enyo,moonstone\n',
		transform: function (skips) {
			return skips.split(',');
		}
	},
	
	isLibrary: {
		full: 'library',
		help: 'Produce a library build instead of a packaged application build from the designated ' +
			'package and entry file; will ignore the --template-index flag',
		flag: true,
		default: false
	},
	
	wip: {
		full: 'include-wip',
		help: 'By default when building a library it will ignore modules with the string "wip" ' +
			'in the filename (for single-file modules) or if the "wip" property in the ' +
			'package.json is true. If you would like to include WIP modules set this to true or ' +
			'remove those properties.',
		flag: true,
		default: false
	},
	
	title: {
		help: 'To set the <title> of the output project index if not in --library mode'
	},
	
	outdir: {
		abbr: 'd',
		help: 'Where to place the output files, this value is relative to the current working directory. ' +
			'If the value is provided by the package.json file it will be relative to the package location.',
		default: './dist'
	},
	
	outfile: {
		abbr: 'o',
		help: 'The output filename for the compiled application HTML when not in --library mode',
		default: 'index.html'
	},
	
	lessPlugins: {
		full: 'less-plugin',
		abbr: 'L',
		help: 'Specify a plugin that should be used when compiling less. These are specified using ' +
			'subarg notation from the command-line with the first argument the name of the plugin ' +
			'that can be required by the build-tools followed by any arguments to parsed and passed to ' +
			'the plugin at runtime. This option can be submitted multiple times.\n\n\t\tExample: -L [ resolution-independence --riUnit=px ]\n',
		list: true,
		transform: function (line) {
			var
				e = subargs(line.slice(1,-1).trim()),
				t = e.shift(),
				r = e.length ? minimist(e) : {};
			e = {
				name: t,
				options: r
			};
			return e;
		}
	},
	
	assetRoots: {
		help: 'If specific libraries will be included statically (not included in the build) and ' +
			'will not be included in the default location alongside the application sources use this ' +
			'to specify the roots separately for paths using the @@LIBRARY notation. Use the reserved ' +
			'character "*" to indicate that all libraries should use the provided root if not ' +
			'specified.' +
			'\n\n\t\tExample: -Z moonstone=/opt/share/assets/ -Z enyo=/opt/share/frameworks/' +
			'\n\t\tExample: -Z *=/opt/share/ -Z moonstone=/opt/share/assets/',
		full: 'asset-root',
		abbr: 'Z',
		list: true,
		transform: function (line) {
			var
				e = line.split('=').map(function (l) { return l.trim(); }),
				r = {
					name: e[0],
					path: e[1]
				};
			return r;
		}
	},
	
	lessOnlyLess: {
		full: 'less-only-less',
		help: 'To ensure that only less files are passed through to the less compiler set this flag ' +
			'to true. Normally all CSS/style is passed through for sanity and consistency. Use ' +
			'this option sparingly.',
		flag: true,
		default: false
	},
	
	minifyCss: {
		full: 'minify-css',
		help: 'Usually minification only occurs during a production build but you can set this flag ' +
			'to true to minify even in development builds.',
		flag: true,
		default: false
	},
	
	inlineCss: {
		full: 'inline-css',
		abbr: 'c',
		help: 'Only used in production mode, whether or not to produce an output CSS file or ' +
			'inline CSS into the index.html file; turn off with --no-inline-css',
		flag: true,
		default: true
	},
	
	outCssFile: {
		full: 'css-outfile',
		help: 'Only used in production mode, the name of the output CSS file if --no-inline-css',
		default: 'output.css'
	},
	
	outJsFile: {
		full: 'js-outfile',
		help: 'Only used in production mode, the name of the output JavaScript file if --no-inline-js',
		default: 'output.js'
	},
	
	inlineJs: {
		full: 'inline-js',
		abbr: 'j',
		help: 'Only used in production mode, whether or not to produce an output JS file or ' +
			'inline JavaScript into the index.html file; turn off with --no-inline-js',
		flag: true,
		default: true
	},
	
	templateIndex: {
		full: 'template-index',
		abbr: 't',
		help: 'Instead of using the auto-generated HTML index, start from this file'
	},
	
	watch: {
		abbr: 'W',
		help: 'Will build the output and continue to monitor the filesystem for changes to the ' +
			'source files and automatically update the build.',
		flag: true,
		default: false
	},
	
	watchPaths: {
		full: 'watch-paths',
		metavar: 'PATHS',
		help: 'By default, using --watch will only target the local application (or library) source. ' + 
			'To have it also watch additional paths use this comma-separated list to name the paths. ' +
			'Note that, this should be used sparingly as it can have negative impacts on performance ' +
			'and in some cases crash the process if there are too many files.',
		transform: function (paths) {
			return paths.split(',');
		}
	},
	
	polling: {
		help: 'When using the --watch command, this will force the watcher to use filesystem ' +
			'polling instead of native (and more efficient) FSEvents. Only use this is you are ' +
			'having an issue with the number of files being watched or are using a network ' +
			'filesystem mount -- WARNING -- it will SIGNIFICANTLY reduce performance.',
		flag: true
	},
	
	pollingInterval: {
		full: 'polling-interval',
		abbr: 'I',
		help: 'When using the --polling flag, set this to the time in milliseconds to poll the ' +
			'filesystem for changes. Has no effect if --polling is not set.',
		metavar: 'INTERVAL',
		default: 100
	},
	
	// DEVELOPMENT HELPERS NOT PUBLIC
	
	TEST_LIB_MODE: {
		flag: true,
		default: false,
		hidden: true
	}
};