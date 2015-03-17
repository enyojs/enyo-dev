'use strict';

var
	path = require('path'),
	fs = require('fs'),
	util = require('util');

var
	browserify = require('browserify'),
	gulp = require('gulp'),
	buffer = require('vinyl-buffer'),
	source = require('vinyl-source-stream'),
	maps = require('gulp-sourcemaps'),
	parse5 = require('parse5'),
	chalk = require('chalk');

var
	rewriter = require('./rewriter'),
	bundler = require('./bundler');

var
	Parser = parse5.Parser,
	EventEmitter = require('events').EventEmitter;


module.exports = Packager;


function Packager (opts) {
	if (!this instanceof Packager) return new Packager(opts);
	
	Object.keys(opts).forEach(function (key) { this[key] = opts[key]; }, this);
	
	this.libs = [];
	
	// @todo clean, complete sanity checks
	this.package = path.resolve(this.package);
	
	this.log('Packager(): Package location: ' + this.package);
	
	// prepare the output template
	this.prepareTemplate();
	this.preparePackageJson();
	
	if (this.devMode) this.development();
	else this.production();
}

// ensure we inherit the ability to use events
util.inherits(Packager, EventEmitter);

/**
* Prepares the AST of the given (or default) index HTML template. If no index was provided it falls-
* back to using the provided one (bare). This is used to rebuild the output source later with all
* of the other features having been fully resolved.
*/
Packager.prototype.prepareTemplate = function () {
	var
		tpl = this.templateIndex;
	
	if (tpl) {
		
		this.log('Packager.prepareTemplate(): Using provided template index file: ' + tpl);
		
		try {
			this.templateIndex = fs.readFileSync(path.resolve(tpl), 'utf8');
		} catch (e) {
			throw 'Error: Could not find requested template index file "' + tpl + '"';
		}
	} else {
		
		this.log('Packager.prepareTemplate(): Using default template index file');
		
		this.templateIndex = fs.readFileSync(path.resolve(__dirname, './template-index.html'), 'utf8');
	}
	
	this.ast = new Parser().parse(this.templateIndex);
};

/**
* Prepares the package's _package.json_ file so certain properties can be explored for configuration
* options at runtime. This also maps the package's `main` property to be a local property of the
* Packager instance.
*/
Packager.prototype.preparePackageJson = function () {
	var json;
	
	try {
		json = this.packageJson = require(path.join(this.package, './package.json'));
	} catch (e) {
		throw 'Error: Could not find a package.json file in the package "' + this.package + '"';
	}
	
	if (!json.main) {
		
		this.log('Packager.preparePackageJson(): No "main" provided, using default "index.js"');
		
		json.main = path.resolve(this.package, 'index.js');
	}
	else {
		this.log('Packager.preparePackageJson(): Using provided "main": ' + json.main);
		
		json.main = path.resolve(this.package, json.main);
	}
	
	this.main = json.main;
};

/**
* If the internal `devMode` option is set to `true` it will be used to provide source-maps in the
* final output. It will also _not_ minify the JS/CSS output while _beautifying_ the HTML output for
* human readability.
*/
Packager.prototype.development = function () {
	var
		bundle = browserify({debug: true}),
		plugin = bundler(this),
		transform = rewriter(this);
	bundle
		.transform(transform)
		.plugin(plugin)
		.add(packager.main)
		.bundle()
		.pipe(source(packager.outJsFile || 'insert.js'))
		.pipe(buffer())
		.pipe(maps.init({loadMaps: true}))
		.pipe(maps.write())
		.pipe(plugin.bundler);
};

Packager.prototype.production = function () {
	console.log(
		chalk.red('Production mode not currently available');
	);
};

/**
* Internally the Packager instance is used to communicate to various portions of the streams
* simultaneously so we can keep related functionality separate. These are libraries that are
* found during exploration of the transform that is mapping require statements to their literal
* paths prior to resolution (in both application source and library sources with dependencies on
* other library sources).
*/
Packager.prototype.addLib = function (lib) {
	if (this.libs.indexOf(lib) === -1) {
		this.libs.push(lib);
		this.log('Packager.addLib(): Adding library ' + lib + ' -> ' + this.libs.join(', '));
		this.emit('lib', lib);
	}
};

/**
* Used internally to write messages to output for debugging purposes.
*/
Packager.prototype.log = function (msg) {
	if (this.verbose) {
		console.log(
			chalk.blue(msg);
		);
	}
};