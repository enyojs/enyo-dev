'use strict';

var
	assert = require('assert'),
	path = require('path'),
	fs = require('fs');

var
    browserify = require('browserify'),
    gulp = require('gulp'),
    buffer = require('vinyl-buffer'),
    source = require('vinyl-source-stream'),
    maps = require('gulp-sourcemaps');

var
    requireRewrite = require('./transforms/require-rewrite');

module.exports = Packager;

/**
* Responsible for packaging an Enyo 2.6+ application.
*/
function Packager (opts) {
	if (!(this instanceof Packager)) return new Packager(opts);
	
	Object.keys(opts).forEach(function (key) { this[key] = opts[key]; }, this);
	
	assert(this.package, 'Must provide a package directory');
	this.package = path.resolve(this.package);
	
    assert(this.outdir, 'Must provide an output directory');
    assert(this.outfile, 'Must provide a destination filename');
    
	try {
		var stats = fs.statSync(this.package);
		assert(stats.isDirectory(), 'Package directory path must be a directory');
	} catch(e) {
		throw new TypeError('Could not find the requested package directory: ' + this.package);
	}
	
	try {
		var packageJson = this.packageJson = require(path.join(this.package, './package.json'));
	} catch (e) {
		throw new TypeError('Could not find a package.json file in the requested package directory');
	}
	
	// default to root file main.js
	if (!packageJson.main) packageJson.main = path.resolve(this.package, 'index.js');
	else packageJson.main = path.resolve(this.package, packageJson.main);
	
	// but of course we have to check for its existence
	try {
		stats = fs.statSync(packageJson.main);
		assert(stats.isFile(), 'Requested entry file is not actually a file: ' + packageJson.main);
	} catch (e) {
		throw new TypeError('Could not find the requested entry file: ' + packageJson.main);
	}
    
    this.main = packageJson.main;
    this.browserify();
}

// temporary (hopefully...) as this lets browserify dynamically load the libs own components
// that are currently designed to be loaded from a relative path without relative notation
// this could potentially be removed as a dependency (and speedup packaging) if they used
// relative mapping notation
var paths = [
    'node_modules/enyo/build',
    'node_modules/moonstone/build',
    'node_modules/layout/build',
    'node_modules/spotlight/build'
];

Packager.prototype.browserify = function () {
    
    var bundle = browserify({debug: this.devMode, paths: paths});
    
    bundle.transform(requireRewrite);
    bundle.add(this.main);
    bundle
        .bundle()
        .pipe(source(this.outfile))
        .pipe(buffer())
        .pipe(gulp.dest(this.outdir));
};