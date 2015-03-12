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
        help: 'The output filename for the compiled application HTML',
        default: 'index.html'
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