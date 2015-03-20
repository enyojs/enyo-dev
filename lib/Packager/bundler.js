'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	through = require('through2'),
	gulp = require('gulp'),
	less = require('less'),
	parse5 = require('parse5'),
	beautifyHtml = require('js-beautify').html;
var
	File = require('vinyl'),
	Serializer = parse5.Serializer;

var
	utils = require('../utils'),
	logger = require('./logger'),
	serializer = new Serializer();

var htmlOptions = {
	indent_inner_html: false,
	indent_size: 1,
	indent_char: '\t',
	indent_scripts: 'keep',
	wrap_line_length: 0,
	brace_style: 'collapst',
	max_preserve_newlines: 0,
	preserve_newlines: false,
	end_with_newline: false
};

module.exports = function (packager) {
	
	var
		stylesheets = [],
		assets = [],
		cssFile,
		jsFile;
	
	// our actual bundling stream that will manage our final output
	var bundler = through.obj(function (file, nil, next) {
		
		logger('Bundler: Received final JS file');
		
		// for some reason the path is coming out as a resolved path
		file.path = path.basename(file.path);
		jsFile = file;
		if (cssFile) {
			logger('Bundler: CSS file was ready, finishing');
			finish();
		} else logger('Bundler: CSS file was not ready');
		next();
	});
	// this is the interface that browserify will work with
	var plugin = function (bundle, opts) {
		
		logger('Bundler: Plugin registered and received Browserify bundle');
		
		// register to know when the bundling will not send any more files
		bundle.on('bundle', function (stream) {
			
			logger('Bundler: Received stream reference from Browserify bundle');
			
			stream.on('end', function () {
				
				logger('Bundler: Browserify stream ended, processing stylesheet ' + 
					'information -> [' + stylesheets.map(function (file) {
						return path.relative(packager.package, file)
					}).join(',') + ']');
				
				gulp
					.src(stylesheets)
					.pipe(getCssFile(packager))
					.pipe(through.obj(function (file, nil, next) {
						file.path = packager.outCssFile || 'insert.css';
						cssFile = file;
						
						logger('Bundler: Style processing complete');
						
						if (jsFile) {
							
							logger('Bundler: JS file was ready, finishing');
							
							finish();
						} else {
							logger('Bundler: JS file was not ready');
						}
						next();
					}));
			});
		});
		// now register a package handler to manage our internal dep system
		bundle.on('package', function (pkg) {
			
			logger('Bundler: Browserify reports finding a package -> ' + pkg.__dirname);
			
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
		
		logger('Bundler: Packager reported a library at -> ' + pkgDir);
		
		explodeStyle(pkg, stylesheets);
		explodeAssets(pkg, assets);
	});
	
	// we expose the final stream so that the final output js from browserify can be
	// managed by us here
	plugin.bundler = bundler;
	return plugin;
	
	function finish () {
		var output = through.obj();
		output.pipe(gulp.dest(packager.outdir));
		
		
		logger('Bundler: Finalizing package content');
		
		var
			embedJs = !packager.outJsFile,
			embedCss = !packager.outCssFile,
			ast = packager.ast,
			head = utils.getDocumentHead(ast),
			index = new File({path: packager.outfile}),
			html, styleNode, jsNode;
		
		if (embedCss) {
			
			logger('Bundler: Inlining style');
			
			styleNode = utils.createStyleNode(head, cssFile.contents.toString());
		} else {
			logger('Bundler: Creating external stylesheet -> ' + path.join(packager.outdir, cssFile.path));
			styleNode = utils.createStylesheetNode(head, cssFile.path);
			output.write(cssFile);
		}
		
		head.childNodes.push(styleNode);
		
		if (embedJs) {
			logger('Bundler: Inlining JS source');
			jsNode = utils.createScriptNode(head, jsFile.contents.toString());
		} else {
			logger('Bundler: Creating external JS script -> ' + path.join(packager.outdir, jsFile.path));
			jsNode = utils.createScriptNode(head, jsFile.path, true);
			output.write(jsFile);
		}
		
		head.childNodes.push(jsNode);
		
		html = serializer.serialize(ast);
		
		if (packager.devMode) {
			if (packager.outJsFile) {
				logger('Bundler: Beautifying HTML output for human-readability because of devMode');
				html = beautifyHtml(html, htmlOptions);
			} else {
				logger('Bundler: Skipping HTML readability because JS source is inlined');
			}
		}
		
		var pushIndex = function () {
			
			
			index.contents = new Buffer(html);
		
			logger('Bundler: Writing final output file to ' + path.join(packager.outdir, index.path));
		
			output.write(index);
			output.end();
		};
		
		if (assets.length) {
			logger(
				'Bundler: Processing assets -> [' +
				assets.map(function (file) {
					return path.relative(packager.package, file);
				}).join(',') + ']'
			);
			
			gulp
				.src(assets)
				.pipe(through.obj(function (asset, nil, next) {
					
					var
						prev = asset.path,
						// need to preserve the directory structure of the asset path
						now = path.join(packager.outAssetDir, prev);
					
					logger('Builder: Asset handling, writing ' + prev + ' to ' + path.join(packager.outdir, now));
					// @todo Not exactly sure atm why this is necessary to rewrite cwd/base but was
					// getting invalid paths as it appears the file.relative output was being used
					// by gulp.dest
					asset.path = now;
					asset.cwd = process.cwd();
					asset.base = process.cwd();
					this.push(asset);
					next();
				}, function (end) {
					pushIndex();
					end();
				}))
				.pipe(gulp.dest(packager.outdir));
		} else pushIndex();
		
	}
};


function explodeStyle (pkg, stylesheets) {
	if (pkg.style && Array.isArray(pkg.style)) {
		
		logger('Bundler.explodeStyle(): Style found for package "' + pkg.__dirname + '" -> [' + pkg.style.join(',') + ']');
		
		pkg.style.reverse().forEach(function (rel) {
			var file = path.join(pkg.__dirname, rel);
			if (stylesheets.indexOf(file) === -1) {
				stylesheets.unshift(file);
			}
		});
	}
}

function explodeAssets (pkg, assets) {
	if (pkg.assets && Array.isArray(pkg.assets)) {
		logger('Bundler.explodeAssets(): Assets found for package "' + pkg.__dirname + '" [' + pkg.assets.join(',') + ']');
		
		pkg.assets.forEach(function (rel) {
			var file = path.join(pkg.__dirname, rel);
			if (assets.indexOf(file) === -1) {
				assets.push(file);
			}
		});
	}
}

function getCssFile (packager) {
	var
		style = '';
	
	return through.obj(accumulate, end);
	
	function accumulate (file, nil, next) {
		style += (file.contents.toString() + '\n');
		next();
	}
	
	function end (done) {
		
		var base;
		
		if (packager.outCssFile) {
			base = path.relative(
				path.join(packager.outdir, path.dirname(packager.outCssFile)),
				path.join(packager.outdir, packager.outAssetDir)
			);
		}
		
		if (!base) base = packager.outAssetDir;
		
		style = translateCssPaths(style, base);
		
		less
			.render(style)
			.then(function (output) {
				
				logger('Less compilation complete');
				
				this.push(new File({contents: new Buffer(output.css)}));
				done();
			}.bind(this));
	}
}

function translateCssPaths (text, base) {
	text = text.replace(/url\((?!http)(?:\'|\")?([a-zA-Z0-9\ \.\/\-]*)(?:\'|\")?\)/g,
		function (match, exact) {
			var ret;
			// this may be a faulty assumption but we should only be seeing this match if
			// it is a path that begins from the root (or assumed root with a /) or a relative
			// path since the regex shouldn't match remote requests
			if (exact.charAt(0) != '/') {
				ret = 'url(\'' + (
					path.join(base, path.basename(exact))
					) + '\')';
				logger('Bundler: Style path translation for URL from "' + match + '" to "' + ret + '"');
				return ret;	
			} else return match;
		}
	);
	text = text.replace(/(\@import\s+(['"])(?!https?)([a-zA-Z0-9\ \/\-\.]+)\2)/g,
		function (match, full, wrap, src) {
			var ret;
			
			if (src.charAt(0) != '/') {
				ret = '@import \'' + (
						path.join(base, path.basename(src))
					) + '\'';
				logger('Bundler: Style path translation for @import from "' + match + '" to "' + ret + '"');
				return ret;
			} else return full;
		}
	);
	return text;
}