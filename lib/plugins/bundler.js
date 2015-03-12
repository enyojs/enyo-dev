'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	through = require('through2'),
	gulp = require('gulp'),
	less = require('less'),
	parse5 = require('parse5');
var
	File = require('vinyl'),
	Serializer = parse5.Serializer;

var
	utils = require('../utils'),
	serializer = new Serializer();

module.exports = function (packager) {
	
	var
		stylesheets = [],
		cssFile,
		jsFile;
	
	// our actual bundling stream that will manage our final output
	var bundler = through.obj(function (file, nil, next) {
		jsFile = file;
		if (cssFile) finish();
		next();
	});
	// this is the interface that browserify will work with
	var plugin = function (bundle, opts) {
		
		// register to know when the bundling will not send any more files
		bundle.on('bundle', function (stream) {
			stream.on('end', function () {
				gulp
					.src(stylesheets)
					.pipe(getCssFile())
					.pipe(through.obj(function (file, nil, next) {
						file.path = packager.outCssFile || 'insert.css';
						cssFile = file;
						if (jsFile) finish();
						next();
					}));
			});
		});
		// now register a package handler to manage our internal dep system
		bundle.on('package', function (pkg) {
			explodeStyle(pkg, stylesheets);
		});
		
	};
	
	// we expose the final stream so that the final output js from browserify can be
	// managed by us here
	plugin.bundler = bundler;
	return plugin;
	
	function finish () {
		var output = through.obj();
		output.pipe(gulp.dest(packager.outdir));
		
		
		var
			embedJs = !packager.outJsFile,
			embedCss = !packager.outCssFile,
			ast = packager.indexAST,
			head = utils.getDocumentHead(ast),
			index = new File({path: packager.outfile}),
			html, styleNode, jsNode;
		
		if (embedCss) {
			styleNode = utils.createStyleNode(head, cssFile.contents.toString());
		} else {
			styleNode = utils.createStylesheetNode(head, cssFile.path);
			output.write(cssFile);
		}
		
		head.childNodes.push(styleNode);
		
		if (embedJs) {
			jsNode = utils.createScriptNode(head, jsFile.contents.toString());
		} else {
			jsNode = utils.createScriptNode(head, jsFile.path, true);
			output.write(jsFile);
		}
		
		head.childNodes.push(jsNode);
		
		html = serializer.serialize(ast);
		index.contents = new Buffer(html);
		output.write(index);
		output.end();
	}
};


function explodeStyle (pkg, stylesheets) {
	if (pkg.style && Array.isArray(pkg.style)) {
		pkg.style.reverse().forEach(function (rel) {
			var file = path.join(pkg.__dirname, rel);
			if (stylesheets.indexOf(file) === -1) {
				stylesheets.unshift(file);
			}
		});
	}
}

function getCssFile () {
	var
		style = '';
	
	return through.obj(accumulate, end);
	
	function accumulate (file, nil, next) {
		style += (file.contents.toString() + '\n');
		next();
	}
	
	function end (done) {
		less
			.render(style)
			.then(function (output) {
				this.push(new File({contents: new Buffer(output.css)}));
				done();
			}.bind(this));
	}
}