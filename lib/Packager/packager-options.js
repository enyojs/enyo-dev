'use strict';

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
		default: 'error',
		help: 'What level of output to use [error, log, debug, info, verbose]'
	},
	
	devMode: {
		full: 'dev-mode',
		abbr: 'D',
		help: 'Whether or not this build is a development build',
		flag: true,
		// temporary
		default: true
	},
	
	libPath: {
		full: 'lib-path',
		abbr: 'L',
		help: 'The relative path from the package root to where the libraries can be found',
		default: 'lib'
	},
	
	includeLibs: {
		full: 'include-libs',
		help: 'This is a comma-separated, ordered list of libraries that have library-level options ' +
			'(package.json) that need to be included in the final build. If the library is ' +
			'explicitly required in the source it does not need to be in this list.',
		transform: function (libs) {
			return typeof libs == 'string' && libs ? libs.split(',').map(function (lib) { return lib.trim(); }) : [];
		}
	},
	
	outdir: {
		abbr: 'd',
		help: 'Where to place the output files',
		default: './dist'
	},
	
	outfile: {
		abbr: 'o',
		help: 'The output filename for the compiled application HTML',
		default: 'index.html'
	},
	
	outAssetDir: {
		full: 'asset-outdir',
		abbr: 'a',
		help: 'The directory for all assets in the package output, relative to outdir',
		default: '.'
	},
	
	outCssFile: {
		full: 'css-outfile',
		abbr: 'c',
		help: 'If the compiled CSS should not be inserted into the packaged HTML file'
	},
	
	outJsFile: {
		full: 'js-outfile',
		abbr: 'j',
		help: 'If the compiled JS should not be inserted into the packaged HTML file'
	},
	
	templateIndex: {
		full: 'template-index',
		abbr: 't',
		help: 'Instead of using the auto-generated HTML index, start from this file'
	}
};