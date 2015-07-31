'use strict';

var
	util = require('util');

var
	Promise = require('bluebird'),
	clone = require('clone'),
	fs = Promise.promisifyAll(require('fs-extra'));

var
	Transform = require('stream').Transform;

var
	logger = require('../../logger'),
	utils = require('../../utils');

var
	log = logger.child({component: 'cache'}),
	resetKeys = ['request', 'dependents', 'dependencies', 'bundle', 'bundleName', 'origins', 'rawContents', 'styleEntries', 'assetEntries'];

var exports = module.exports;

exports.CacheStream = CacheStream;

function CacheStream (opts) {
	if (!(this instanceof CacheStream)) return new CacheStream(opts);
	
	opts = opts || {};
	this.options = opts;
	this._modules = [];
	this._bundles = [];
	log.level(opts.logLevel);
	
	Transform.call(this, {objectMode: true});
}

util.inherits(CacheStream, Transform);

CacheStream.prototype._transform = function (bundle, nil, next) {
	var
		stream = this,
		opts = this.options,
		modules = this._modules,
		bundles = this._bundles;
	
	if (opts.cache) {
		Object.keys(bundle.modules).forEach(function (nom) {
			modules.push(bundle.modules[nom]);
		});
		bundles.push(bundle);
		next();
	} else next(null, bundle);
};

CacheStream.prototype._flush = function (done) {
	
	var
		stream = this,
		opts = this.options,
		bundles = this._bundles,
		cache;
	
	if (opts.cache) {
		
		log.info({file: opts.cacheFile}, 'attempting to write cache file');
		
		cache = [];
		this._modules.forEach(function (entry) {
			cache.push(stream._getCacheEntry(entry));
		});
		
		this.emit('cache', cache);
		
		writeCache(opts.cacheFile, cache).then(function () {
			bundles.forEach(function (bundle) { stream.push(bundle); });
			stream.push(null);
			done();
		}, function (e) {
			utils.streamError(stream,
				'could not write cache file %s:\n\t%s', opts.cacheFile, e.message
			);
		});

	} else done();
	
};

CacheStream.prototype._getCacheEntry = function (entry) {
	
	var ret = clone(entry);

	for (var i = 0; i < resetKeys.length; ++i) {
		delete ret[resetKeys[i]];
	}
	
	ret.contents = entry.rawContents;
	
	return ret;
};

function writeCache (file, data) {
	log.debug({file: file}, 'writing cache file');
	return fs.writeJsonAsync(file, data).then(function () {
		log.info({file: file}, 'cache file written');
	});
}
exports.writeCache = writeCache;

function readCache (file) {
	log.level(logger.level());
	log.info({file: file}, 'attempting to locate and read the cache file');
	return fs.readJsonAsync(file).then(function (json) {
		log.info({file: file}, 'cache file successfully loaded');
		return validate(json);
	}, function () {
		throw new Error('could not locate the cache file');
	});
}
exports.readCache = readCache;

function validate (json) {
	var running;
	
	if (!Array.isArray(json)) throw new Error('cache file was corrupted');
	
	running = json.map(function (entry) {
		return Promise.resolve(entry.isPackage).then(function (isPackage) {
			return isPackage ? checkPackage(entry) : checkFile(entry);
		}).then(function (valid) {
			log.debug({module: entry.relName}, 'cached entry was %s, %s', valid ? 'valid' : 'invalid', valid ? 'including' : 'skipping');
			return valid ? entry : Promise.reject();
		});
	});
	
	log.info('checking %d entries from cache file', running.length);
	
	return Promise.settle(running).then(function (results) {
		var ret = results.filter(function (result) {
			return result.isFulfilled();
		}).map(function (result) {
			return result.value();
		});
		
		log.info('keeping %d cached entries from initial %d', ret.length, running.length);
		return ret;
	});
}
exports.validate = validate;

function checkPackage (entry) {
	log.debug({module: entry.relName}, 'validating cached package entry');
	return Promise.join(
		Promise.resolve(entry.main).then(function (main) {
			return main ? stat(main, entry.mtime[main]) : true;
		}),
		Promise.resolve(entry.packageFile).then(function (pkg) {
			return pkg ? stat(pkg, entry.mtime[pkg]) : true;
		}),
		function (main, pkg) {
			log.debug({module: entry.relName}, 'main was %s, package.json was %s', main ? 'valid' : 'invalid', pkg ? 'valid' : 'invalid');
			return main && pkg;
		}
	);
}
exports.checkPackage = checkPackage;

function checkFile (entry) {
	log.debug({module: entry.relName}, 'validating cache source entry');
	return stat(entry.fullpath, entry.mtime);
}
exports.checkFile = checkFile;

function stat (file, mtime) {
	// @todo add support for lstat and realpath to find the real value for symbolic links
	return fs.statAsync(file).then(function (stat) {
		return mtime >= stat.mtime.getTime();
	}, function () {
		return false;
	});
}