'use strict';

var
	util = require('util'),
	path = require('path');

var
	Promise = require('bluebird'),
	EventEmitter = require('events').EventEmitter;

var
	fs = Promise.promisifyAll(require('fs-extra'));

var
	logger = require('../logger').default,
	factor = require('./lib/factor-source-stream'),
	source = require('./lib/process-source-stream'),
	assets = require('./lib/process-assets-stream'),
	style = require('./lib/process-style-stream'),
	sort = require('./lib/sort-stream'),
	pack = require('./lib/pack-bundle-stream'),
	bundle = require('./lib/bundle-output-stream'),
	output = require('./lib/write-files-stream'),
	cm = require('./lib/cache-manager').default,
	getModules = require('./lib/recurse-library'),
	utils = require('../utils');

var log, proto;

function Packager (params) {
	var opts = params.opts;
	opts.env = params.env;
	if (!(this instanceof Packager)) return new Packager(params);
	EventEmitter.call(this);
	log = logger(opts).child({component: 'packager'})
	this.options = opts;
	this.options.logger = log;
	log.level(opts.logLevel || 'warn');
}
module.exports = Packager;

util.inherits(Packager, EventEmitter);

proto = Packager.prototype;

proto.run = function (opts) {
	opts = opts || this.options;
	if (opts.library) return this.buildLibrary(opts);
	else return this.buildPackage(opts);
};

proto.buildPackage = function (opts) {
	
	var packager, stream, cache;
	
	opts = opts || this.options;
	
	log.info('beginning %s build for %s', opts.production ? 'production' : 'development', path.relative(opts.cwd, opts.package) || (opts.env.local.package && opts.env.local.package.name) || path.basename(opts.package));
	
	packager = this;
	stream = source(opts);
	
	cache = cm(opts);

	cache.on('cache', function (data) {
		log.debug('cache ready, emitting cache event');
		packager.emit('cache', data);
	});

	stream
		.pipe(sort(opts))
		.pipe(factor(opts))
		.pipe(sort(opts))
		.pipe(style(opts))
		.pipe(assets(opts))
		.pipe(pack(opts))
		.pipe(cache)
		.pipe(bundle(opts))
		.pipe(output(opts))
		.on('finish', function () {
			log.info('build complete');
			packager.emit('end');
		});
	
	if (opts.cache && Array.isArray(opts.cache) && opts.cache.length) {
		log.info('using %d cached entries', opts.cache.length);
		opts.cache.forEach(function (entry) { stream.write(entry); });
	}
	// this may be redundant but always be sure to have the entry
	stream.write({path: opts.package, entry: true});
	stream.end();
	return this;
};

proto.destroy = function () {
	this.removeAllListeners();
	this.options = null;
};

proto.buildLibrary = function (opts) {
	
	var packager, stream, cache, initial;
	
	opts = opts || this.options;
	
	log.info('building %s as a library', opts.name);
	
	packager = this;
	stream = source(opts);

	initial = {
		path: opts.package,
		entry: false,
		lib: opts.package,
		libName: opts.name,
		name: opts.name,
		relName: opts.name
	};
	
		
	cache = cm(opts);
	
	cache.on('cache', function (data) {
		log.info('cache ready, emitting cache event');
		packager.emit('cache', data);
	});

	stream
		.pipe(sort(opts))
		.pipe(factor(opts))
		.pipe(style(opts))
		.pipe(assets(opts))
		.pipe(pack(opts))
		.pipe(cache)
		.pipe(bundle(opts))
		.pipe(output(opts))
		.on('finish', function () {
			log.info('build complete');
			packager.emit('end');
		});
	
	if (opts.cache && Array.isArray(opts.cache) && opts.cache.length) {
		log.info('using %d cached entries', opts.cache.length);
		opts.cache.forEach(function (entry) { stream.write(entry); });
	}
	
	stream.write(initial);
	getModules(opts).then(function (modules) {
		modules.forEach(function (entry) {
			if (log.debug()) log.debug({file: entry}, 'writing library module %s', path.relative(opts.package, entry));
			stream.write({path: entry, lib: opts.package, libName: opts.name});
		});
		stream.end();
	}, function (e) {
		utils.fatal('could not complete a scan of the library modules: %s', e.message);
	}).catch(function (e) {
		utils.fatal(e);
	});
	return this;
};