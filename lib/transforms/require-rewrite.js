'use strict';

var
	path = require('path');

var
	through = require('through2');

// for now we will hardcode which libraries we know to look for but in
// future versions this should be more intelligently derived and/or configurable
var libs = ['enyo', 'moon', 'layout', 'onyx', 'spotlight'];

module.exports = function (filename) {
	if (path.extname(filename) != '.js') return through();
	
	var src;
	
	function write (buf, nil, next) {
		src = buf.toString();
		next();
	}
	
	// where the magic happens
	function end (done) {
		src = src.replace(/require\((['"])(.*)\1\)/g, function (match, sep, module) {
			var parts = module.split('/'), repl;
			// determine if this module is a request for one of our known libs
			if (libs.indexOf(parts[0]) > -1) {
				parts.splice(1, 0, 'build');
				repl = parts.join('/');
				return match.replace(module, repl);
			}
			return match;
		});
		
		this.push(new Buffer(src));
		
		done();
	}
	
	return through(write, end);
};



function getRequires (src) {
	return /require\((.*)\)/g.exec(src);
}