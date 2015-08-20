'use strict';

var
	util = require('util'),
	path = require('path');

var
	Transform = require('stream').Transform;

var
	BundleSource = require('./lib/BundleSource');

var
	logger = require('../../../logger'),
	utils = require('../../../utils');

var
	log = logger.child({component: 'pack-bundle-stream'});

module.exports = PackBundleStream;

function PackBundleStream (opts) {
	if (!(this instanceof PackBundleStream)) return new PackBundleStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.bundles = [];
	this.store = {modules: {}, bundles: {}};
	this.requests = false;
	this.wrappers = {};
	log.level(opts.logLevel);
}

util.inherits(PackBundleStream, Transform);

var proto = PackBundleStream.prototype;

proto._transform = function (bundle, nil, next) {
	this.load(bundle);
	next();
};

proto._flush = function (done) {
	this.packBundles();
	done();
};

proto.load = function (bundle) {
	var store = this.store;
	this.bundles.push(bundle);
	store.bundles[bundle.name] = bundle;
	bundle.order.forEach(function (name) {
		store.modules[name] = bundle.modules[name];
	});
	if (bundle.request) this.requests = true;
};

proto.getModuleFromName = function (name) {
	return this.store.modules[name];
};

proto.getBundleFromName = function (name) {
	return this.store.bundles[name];
};

proto.getBundleForModule = function (entry) {
	if (typeof entry == 'string') entry = this.getModuleFromName(entry);
	return this.getBundleFromName(entry.bundleName);
};

proto.packBundles = function () {
	var opts, stream;
	stream = this;
	opts = this.options;
	if (opts.production) this.prepareForProduction();
	this.bundles.forEach(function (bundle) {
		if (!bundle.ignore) stream.pack(bundle);
		stream.push(bundle);
	});
	stream.push(null);
};

proto.prepareForProduction = function () {
	var opts, stream;
	opts = this.options;
	stream = this;
	if (log.info()) log.info('preparing for a production build');
	
};

proto.pack = function (bundle) {
	var opts, src;
	opts = this.options;
	
	src = new BundleSource(bundle, opts, this);
	bundle.contents = src.contents;
	if (opts.devMode && opts.sourceMaps) {
		bundle.sourceMap = src.sourceMap;
		bundle.sourceMapFile = src.sourceMapFile;
		bundle.contents += src.sourceMapPragma;
	}
};
