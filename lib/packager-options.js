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
	
	devMode: {
		full: 'dev-mode',
		abbr: 'D',
		help: 'Whether or not this build is a development build',
		flag: true,
		// temporary
		default: true
	},
	
    outdir: {
        abbr: 'd',
        help: 'Where to place the output files',
        default: './dist'
    },
    
    outfile: {
        abbr: 'o',
        help: 'The output filename for the compiled application source',
        default: 'app.js'
    }
};