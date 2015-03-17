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
		
		packager.log('Bundler: Received final JS file');
		
		// for some reason the path is coming out as a resolved path
		file.path = path.basename(file.path);
		jsFile = file;
		if (cssFile) {
			packager.log('Bundler: CSS file was ready, finishing');
			finish();
		} else packager.log('Bundler: CSS file was not ready');
		next();
	});
	// this is the interface that browserify will work with
	var plugin = function (bundle, opts) {
		
		packager.log('Bundler: Plugin registered and received Browserify bundle');
		
		// register to know when the bundling will not send any more files
		bundle.on('bundle', function (stream) {
			
			packager.log('Bundler: Received stream reference from Browserify bundle');
			
			stream.on('end', function () {
				
				packager.log('Bundler: Browserify stream ended, processing stylesheet information -> ' + stylesheets.join(','));
				
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
			
			packager.log('Bundler: Browserify reports finding a package -> ' + pkg.__dirname);
			
			explodeStyle(pkg, stylesheets);
		});
		
	};
	
	packager.on('lib', function (lib) {
		var
			// currently hard coded to lib and assuming cwd is root of project...temporary!
			pkgDir = path.resolve(process.cwd(), './lib/', lib),
			pkgFile = path.join(pkgDir, './package.json'),
			pkg = require(pkgFile);

		pkg.__dirname = pkgDir;
		
		packager.log('Bundler: Packager reported a library at -> ' + pkgDir);
		
		explodeStyle(pkg, stylesheets);
	});
	
	// we expose the final stream so that the final output js from browserify can be
	// managed by us here
	plugin.bundler = bundler;
	return plugin;
	
	function finish () {
		var output = through.obj();
		output.pipe(gulp.dest(packager.outdir));
		
		
		packager.log('Bundler: Finalizing package content');
		
		var
			embedJs = !packager.outJsFile,
			embedCss = !packager.outCssFile,
			ast = packager.ast,
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