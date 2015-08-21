'use strict';

var
	path = require('path'),
	fs = require('fs'),
	util = require('util');

var
	uglify = require('uglify-js'),
	combine = require('combine-source-map'),
	convert = require('convert-source-map');

var
	BundleManifest = require('./BundleManifest');

var
	BUNDLE_WRAPPER = fs.readFileSync(path.join(__dirname, 'bundle-wrapper.js'), 'utf8'),
	BUNDLE_REQUEST = fs.readFileSync(path.join(__dirname, 'request.js'), 'utf8');

module.exports = BundleSource;

function BundleSource (bundler, bundle, opts) {
	if (!(this instanceof BundleSource)) return new BundleSource(bundle, opts, bundler);
	this.bundler = bundler;
	this.options = opts;
	this.bundle = bundle;
	this.requests = bundle.includeRequest;
	this.debug = opts.DEBUG_WRAPPER;
	this.src = BUNDLE_WRAPPER;
	this.sourceMaps = opts.devMode && opts.sourceMaps;
	this.map = this.sourceMaps ? combine.create() : null;
	// @todo: this will have to be updated if the bundle-wrapper gets updated
	this.line = 8;
	this.production = opts.production;
	this.entries = [];
	this.manifest = new BundleManifest(bundler, bundle, opts, this.map, this.line);
	this.contents = '';
	this.sourceMap = '';
	this.sourceMapFile = '';
	this.sourceMapPragma = '';
	this.logger = opts.logger.child({component: 'BundleSource', bundle: bundle.name});
	this.log = this.logger.debug.bind(this.logger);
	this.pack();
}

var proto = BundleSource.prototype;

proto.pack = function () {
	var packer, bundler, bundle, manifest;
	packer = this;
	bundler = this.bundler;
	bundle = this.bundle;
	manifest = this.manifest;
	if (this.log()) this.log('packing');
	bundle.order.forEach(function (name) {
		var entry;
		entry = bundler.getModuleFromName(name);
		manifest.insert(entry);
		if (entry.entry) packer.entries.push(entry);
	});
	this.compile();
};

proto.compile = function () {
	var packer, manifest, production, src;
	packer = this;
	manifest = this.manifest;
	production = this.production;
	src = this.src;
	if (this.log()) this.log('compiling bundle source');
	var t = manifest.compile();
	// the following does not work because apparently large numbers of characters can't all be
	// placed into the buffer (no error, but bad result)
	// src = src.replace('/*manifest*/', manifest.compile());
	// console.log('size', this.bundle.name, t.length);
	src = src.split('/*{manifest}*/');
	src = src[0] + t + src[1];
	src = src.replace('/*{entries}*/', this.compileEntries());
	src = src.replace('/*{request}*/', this.compileRequest());
	if (!this.debug) {
		if (this.log()) this.log('removing debugging statements from wrapper code');
		src = src.replace(/\/\*{debug}\*\/[^\n]+$/gm, '');
	}
	this.src = src;
	this.compileMap();
	if (production) this.uglify();
	this.contents = this.src;
};

proto.compileEntries = function () {
	var entries;
	entries = this.entries;
	if (!entries.length) return 'entries = null;\n';
	if (this.log()) this.log('compiling %d entries', entries.length);
	return 'entries = [' + entries.map(function (e) {
		return util.format('\'%s\'', e.relName);
	}).join(',') + '];\n';
};

proto.compileRequest = function () {
	if (!this.requests) return '';
	if (this.log()) this.log('adding request function to bundle source');
	return BUNDLE_REQUEST;
};

proto.compileMap = function () {
	if (this.map) {
		if (this.log()) this.log('compiling the sourceMap data');
		this.sourceMap = convert.fromBase64(this.map.base64()).toJSON();
		this.sourceMapFile = this.bundle.name + '.js.map';
		this.sourceMapPragma = '\n//# sourceMappingURL=' + this.sourceMapFile;
	}
};

proto.uglify = function () {
	var src, uglified;
	src = this.src;
	if (this.log()) this.log('uglifying final output, %d characters', src.length);
	try {
		src = uglify.minify(src, {
			fromString: true,
			mangle: {
				except: ['require', 'request']
			},
			output: {
				space_colon: false,
				beautify: false,
				semicolons: false
			}
		}).code;
	} catch (e) {
		throw new Error(util.format('failed to uglify code for bundle %s: %s', this.bundle.name, e.stack));
	}
	if (this.log()) this.log('done uglifying, reduced source to %d characters from %d', src.length, this.src.length);
	this.src = src;
};