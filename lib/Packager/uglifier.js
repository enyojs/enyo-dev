'use strict';

var
	through = require('through2'),
	uglify = require('uglify-js');

var
	logger = require('../logger');

module.exports = function () {
	return through.obj(function (file, nil, next) {
		
		var
			src = file.contents.toString();
		
		try {
			src = uglify.minify(src, {
				fromString: true,
				output: {
					space_colon: false,
					beautify: false,
					semicolons: false
				}
			}).code;
		} catch (e) {
			logger.log('error', '\nUglifyJS has thrown an error for file -> ' +
				fileSrc + '...will continue without minifying that file\n' +
				e.toString()
			);
		}
		
		file.contents = new Buffer(src);
		this.push(file);
		next();
	});
};