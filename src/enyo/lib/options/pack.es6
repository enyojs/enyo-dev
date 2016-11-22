'use strict';

import minimist   from 'minimist';
import nom from 'nomnom';
import {packager} from '../../../../index';
import {subargs}  from '../../../utils';

let pack = {
	name: 'pack',
	help: 'Package an Enyo application or library for use in a browser.',
	callback (opts) {
		return packager(opts);
	},
	options: {
		package: {
			help: 'The path to the package to bundle and prepare for deployment. This can be a ' +
				'relative or full path. If omitted the current working directory will be used.',
			position: 1
		},
		name: {
			help: 'In rare cases you may wish to override the current project\'s configured "name". If so ' +
				'set this value to modify the output "name". NOTE: this is not the same as the "title" of the ' +
				'HTML (if applicable) that is produced. See "--title" for more information. This value must be ' +
				'a valid POSIX filename.'
		},
		production: {
			full: 'production',
			abbr: 'P',
			help: 'Build in production mode; supersedes the --dev-mode and --no-dev-mode flags. Defaults ' +
				'to false.',
			flag: true
		},
		devMode: {
			full: 'dev-mode',
			abbr: 'D',
			help: 'Whether or not this build is a development build; negated if --production set. Defaults ' +
				'to true.',
			flag: true
		},
		cache: {
			help: 'Enables the use of a cache-file, if it exists and also the ability to write to the ' +
				'cache-file. This cache-file can significantly improve build times in some cases. To ' +
				'force a clean build but cache the results simply remove the cache-file. ' +
				'To disable use --no-cache. Defaults to true.',
			flag: true
		},
		resetCache: {
			help: 'Allows you to ignore an existing cache-file but still write the cached output for ' +
				'subsequent runs. Defaults to false. The same as removing the current cache-file.',
			full: 'reset-cache',
			abbr: 'r',
			flag: true
		},
		trustCache: {
			full: 'trust-cache',
			help: 'Convenience flag only used during watch-mode, when set, will default to using the ' +
				'cached data without re-building the output. This should only be used when you are ' +
				'certain nothing has changed and it has no need to re-evaluate the input source or ' +
				're-produce any of the output files. Defaults to false.',
			flag: true
		},
		clean: {
			help: 'This will empty the outdir before writing any new files to it. Helpful when switching ' +
				'build modes or when assets/styles have changed and old files may be lingering. Defaults ' +
				'to false.',
			flag: true
		},
		sourceMaps: {
			full: 'source-maps',
			help: 'Whether or not to build source-maps when in --dev-mode; disable with --no-source-maps. ' +
				'Defaults to true (only applies to --dev-mode).',
			flag: true
		},
		paths: {
			full: 'paths',
			help: 'A command separated list of paths to search for libraries and their modules. Specifying these ' +
				'from the command-line will override any found in the configuration files. NOTE: the paths in ' +
				'the configuration file are relative to the package location but paths interpreted from the ' +
				'command-line should be relative to the current working directory (unless full). Also NOTE: ' +
				'the packager will still search the value of the "libDir" of when any additional paths have been ' +
				'exhausted.',
			transform (paths) {
				return paths ? paths.trim().split(',').map(p => p && p.trim()) : null;
			}
		},
		externals: {
			help: 'To build without bundled external libraries, use --no-externals; always false ' +
				'when in --library mode. NOTE: the library is still required to compile even if ' +
				'the output will not include it. Defaults to true.',
			flag: true
		},
		strict: {
			full: 'strict',
			flag: true,
			help: 'By default, if a style-file or asset file is missing, or if an asset path cannot ' +
				'be properly translated, only a warning will be issued. If this is true then it will halt ' +
				'the compilation. Defaults to false.'
		},
		skip: {
			full: 'skip',
			help: 'A comma-separated list of external libraries that should not be included in the ' +
				'output when not in --library mode.\n\n\t\tExample: --skip=enyo,moonstone\n',
			transform (libs) {
				return libs ? libs.trim().split(',').map(l => l && l.trim()) : null;
			}
		},
		library: {
			full: 'library',
			help: 'Produce a library build instead of a packaged application build from the designated ' +
				'package and entry file; will ignore the --template-index flag. Defaults to false.',
			flag: true
		},
		wip: {
			full: 'include-wip',
			help: 'By default when building a library it will ignore modules with the string "wip" ' +
				'in the filename (for single-file modules) or if the "wip" property in the ' +
				'package.json is true. If you would like to include WIP modules set this to true or ' +
				'remove those properties. Defaults to false.',
			flag: true
		},
		title: {
			help: 'To set the <title/> of the output project index if not in --library mode. Usually ' +
				'set in the configuration so it will consistently build with the same title. If not ' +
				'specified here or in the configuration will default to the name of the project.'
		},
		outDir: {
			abbr: 'd',
			help: 'Where to place the output files, this value is relative to the current working directory. ' +
				'If the value is provided by the configuration file it will be relative to the package location. ' +
				'Defaults to "./dist"'
		},
		outFile: {
			abbr: 'o',
			help: 'The output filename for the compiled application HTML when not in --library mode. ' +
				'Defaults to "index.html".'
		},
		lessPlugins: {
			full: 'less-plugin',
			abbr: 'L',
			help: 'Specify a plugin that should be used when compiling Less. These are specified using ' +
				'subarg notation from the command-line with the first argument the name of the plugin ' +
				'that can be required by the build-tools followed by any arguments to be parsed and passed to ' +
				'the plugin at runtime. This option can be submitted multiple times. It can be configured ' +
				'in the configuration file as an array of objects with a "name" and "options" properties where ' +
				'the "options" property is an object of key-value options to be passed to the plugin. If specified ' +
				'from the command-line it will supersede any values from the configuration file.' +
				'\n\n\t\tExample: -L [ resolution-independence --riUnit=px ]\n',
			list: true,
			transform (line) {
				let   e = subargs(line.slice(1,-1).trim())
					, t = e.shift()
					, r = e.length ? minimist(e) : {};
				return {name: t, options: r};
			}
		},
		assetRoots: {
			help: 'If specific libraries will be included statically (not included in the build) and ' +
				'will not be included in the default location alongside the application sources use this ' +
				'to specify the roots separately for paths using the @@LIBRARY notation. Use the reserved ' +
				'character "*" to indicate that all libraries should use the provided root if not ' +
				'specified. These can be configured in the configuration file as an array of objects ' +
				'with a "name" (the library) and "path" (the prefix).' +
				'\n\n\t\tExample: -Z moonstone=/opt/share/assets/ -Z enyo=/opt/share/frameworks/' +
				'\n\t\tExample: -Z *=/opt/share/ -Z moonstone=/opt/share/assets/',
			full: 'asset-root',
			abbr: 'Z',
			list: true,
			transform (line) {
				let e = line.split('=').map(l => l.trim());
				return {name: e[0], path: e[1]};
			}
		},
		lessOnlyLess: {
			full: 'less-only-less',
			help: 'To ensure that only less files are passed through to the less compiler set this flag ' +
				'to true. Normally all CSS/style is passed through for sanity and consistency. Use ' +
				'this option sparingly. Defaults to false.',
			flag: true
		},
		lessVars: {
			help: 'Add a less variable to the end of all concatenated Less before compilation. Less evaluates ' +
				'all of its variables before processing meaning the last definition of a variable will be used. ' +
				'This can be specified as many times as is necessary in the form of --less-var=@NAME:VALUE. ' +
				'Remember that the value will be used as-is so wrap it with quotes if it is a string (e.g. --less-var=@lessvar:\'string\') ' +
				'[.enyoconfig option "lessVars" - ARRAY - objects with name and value properties].',
			full: 'less-var',
			list: true,
			transform (line) {
				let e = line.split(':').map(l => l.trim());
				return {name: e[0], value: e[1]};
			}
		},
		minifyCss: {
			full: 'minify-css',
			help: 'Usually minification only occurs during a production build but you can set this flag ' +
				'to true to minify even in development builds. Defaults to false',
			flag: true
		},
		inlineCss: {
			full: 'inline-css',
			abbr: 'c',
			help: 'Only used in production mode, whether or not to produce an output CSS file or ' +
				'inline CSS into the index.html file; turn off with --no-inline-css. Defaults to true.',
			flag: true
		},
		outCssFile: {
			full: 'css-outfile',
			help: 'Only used in production mode, the name of the output CSS file if --no-inline-css. Defaults ' +
				'to "output.css"'
		},
		outJsFile: {
			full: 'js-outfile',
			help: 'Only used in production mode, the name of the output JavaScript file if --no-inline-js. ' +
				'Defaults to "output.js"'
		},
		inlineJs: {
			full: 'inline-js',
			abbr: 'j',
			help: 'Only used in production mode, whether or not to produce an output JS file or ' +
				'inline JavaScript into the index.html file; turn off with --no-inline-js. Defaults to ' +
				'true.',
			flag: true
		},
		templateIndex: {
			full: 'template-index',
			abbr: 't',
			help: 'Instead of using the auto-generated HTML index, start from this file. Can be configured ' +
				'but does not have a specified default value.'
		},
		watch: {
			abbr: 'W',
			help: 'Will build the output and continue to monitor the filesystem for changes to the ' +
				'source files and automatically update the build. Defaults to false.',
			flag: true
		},
		polling: {
			help: 'When using the --watch command, this will force the watcher to use filesystem ' +
				'polling instead of native (and more efficient) FSEvents. Only use this is you are ' +
				'having an issue with the number of files being watched or are using a network ' +
				'filesystem mount -- WARNING -- it will SIGNIFICANTLY reduce performance. Defaults to false.',
			flag: true
		},
		pollingInterval: {
			full: 'polling-interval',
			abbr: 'I',
			help: 'When using the --polling flag, set this to the time in milliseconds to poll the ' +
				'filesystem for changes. Has no effect if --polling is not set. Defaults to "100".',
			metavar: 'INTERVAL'
		},
		headScripts: {
			full: 'head-scripts',
			transform (paths) {
				return !paths ? [] : paths.trim().split(',');
			},
			help: 'A comma-separated list of paths relative to the current working directory of ordered ' +
				'JavaScript files to arbitrarily add at the beginning of all JavaScript source. In development mode ' +
				'these files will be loaded separately while in production they will be inlined unless the --no-inline-js ' +
				'flag is used. Without strict mode enabled, warnings will be issued when named files cannot ' +
				'be resolved. This option has no meaning in library mode [.enyoconfig option "headScripts" - ARRAY - ' +
				'relative paths to project].'
		},
		tailScripts: {
			full: 'tail-scripts',
			transform (paths) {
				return !paths ? [] : paths.trim().split(',');
			},
			help: 'A comma-separated list of paths relative to the current working directory of ordered ' +
				'JavaScript files to arbitrarily add at the end of all JavaScript source. In development mode ' +
				'these files will be loaded separately while in production they will be inlined unless the --no-inline-js ' +
				'flag is used. Without strict mode enabled, warnings will be issued when named files cannot ' +
				'be resolved. This option has no meaning in library mode [.enyoconfig option "tailScripts" - ARRAY - ' +
				'relative paths to project].'
		},
		promisePolyfill: {
			full: 'promise-polyfill',
			flag: true,
			help: 'When using the request feature for asynchronous loading the platform needs to have support ' +
				'for Promises. If the target platform does not support Promises or to ensure that the application ' +
				'can support platforms that do not have Promise support set this flag to true ' +
				'[.enyoconfig option "promisePolyfill" - BOOLEAN - false].'
		},
		styleOnly: {
			full: 'style-only',
			flag: true,
			help: 'Set this flag to only output final style files. All other settings apply normally ' +
				'[.enyoconfig option "styleOnly" - BOOLEAN - false].'
		},
		
		// PRIVATE HELPERS NOT FOR PUBLIC

		subpackage: {
			hidden: true,
			full: 'subpackage',
			abbr: 'S',
			help: 'Specify a subpackage within the current package that should also be built, with the ability ' +
				'for shared assets. After a suppackage is declared, any standard enyo-dev package options are allowed. ' +
				'May be used multiple times for multiple subpackages. Note: paths used in options must be relative to ' +
				'the subpackage itself. Subpackage will be skipped/ignored when --Watch option is in usage.' +
				'\n\n\t\tExample: -S [ ./subapp --production ]\n',
			list: true,
			transform (line) {
				let   e = subargs(line.slice(1,-1).trim())
					, t = e.shift()
					, r = {};
				if(e.length) {
					nom();
					r = nom.parse(e);
				}
				return {name: t, options: r};
			}
		},
		
		// DEVELOPMENT HELPERS NOT PUBLIC
	
		TEST_LIB_MODE: {
			flag: true,
			default: false,
			hidden: true
		}
	}
};

export default pack;
