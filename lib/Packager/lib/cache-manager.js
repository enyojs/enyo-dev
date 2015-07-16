'use strict';

var
	fs = require('fs-extra'),
	util = require('util');

var
	clone = require('clone');

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
		
		writeCache(opts.cacheFile, cache, function (err) {
			if (err) return utils.streamError(stream,
				'could not write cache file %s:\n\t %s', opts.cacheFile, err.toString()
			);
			
			bundles.forEach(function (bundle) { stream.push(bundle); });
			
			stream.push(null);
			done();
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

function writeCache (file, cache, done) {
	
	log.debug({file: file}, 'writing cache file');
	
	fs.writeJson(file, cache, function (err) {
		if (err) return done(err);
		
		log.info({file: file}, 'cache file written');
		done();
	});
}
exports.writeCache = writeCache;

function readCache (file, done) {
	
	log.level(logger.level());
	
	log.info({file: file}, 'attempting to locate and read the cache file');
	
	fs.readJson(file, function (err, data) {
		
		if (err) {
			log.info({file: file}, 'could not locate cache file');
			return done(err);
		}
		
		log.info({file: file}, 'cache file successfully loaded');
		
		validate(data, done);
	});
	
}
exports.readCache = readCache;

function validate (data, done) {
	
	// @todo if this winds up being a problem opening too many files will need to throttle open
	// file descriptors arbitrarily
	
	var
		counter = 0,
		clean = true,
		entry, finish;
	
	if (!data || !(data instanceof Array)) {
		log.warn('cache file was corrupted, unable to use');
		return done(new Error('cache file was corrupt'));
	}
	
	if (!data.length) {
		log.debug('cache data had 0 length');
		return done(new Error('cannot use cache data with 0 length'));
	}
	
	finish = function () {
		var entry, len;

		len = data.length;

		if (!clean) {
			log.debug('there were invalid cache entries, removing them');
			
			for (var i = data.length - 1; i >= 0; --i) {
				entry = data[i];
				if (entry.invalid) data.splice(i, 1);
			}
		}
		
		log.debug('final number of valid entries %d of %d', data.length, len);
		
		done(null, data);
	};
	
	data.forEach(function (entry) {
		counter++;
	
		log.debug({module: entry.relName}, 'checking status of cached module entry');
	
		if (entry.isPackage) {
			checkPackage(entry, function (valid) {
				
				log.debug({module: entry.relName}, 'cached module entry was %s', valid ? 'valid' : 'invalid');
				
				if (!valid) {
					entry.invalid = true;
					clean = false;
				}
				
				if (--counter === 0) finish();
			});
		} else {
			checkFile(entry.fullpath, entry.mtime, function (valid) {
				
				log.debug({module: entry.relName}, 'cached module entry was %s', valid ? 'valid' : 'invalid');
				
				if (!valid) {
					entry.invalid = true;
					clean = false;
				}
				
				if (--counter === 0) finish();
			});
		}
	
	});
	
}
exports.validate = validate;

function checkPackage (entry, done) {
	
	log.debug({module: entry.relName}, 'checking package entry');

	var
		counter = 0,
		clean = true,
		checkDone;
	
	checkDone = function (valid) {
		if (!valid) clean = false;
		if (--counter === 0) {
			done(clean);
		}
	};
	
	if (entry.main) {
		counter++;
		checkFile(entry.main, entry.mtime[entry.main], checkDone);
	}

	if (entry.packageFile) {
		counter++
		checkFile(entry.packageFile, entry.mtime[entry.packageFile], checkDone);
	}
}
exports.checkPackage = checkPackage;

function checkFile (file, mtime, done) {
	fs.stat(file, function (err, stat) {
		
		if (!err && stat) {
			var curr = stat.mtime.getTime();
		
			log.debug({file: file}, 'comparing %s to %s', mtime, curr)
		}
		
		done(!(err || mtime < curr));
	});
}
exports.checkFile = checkFile;