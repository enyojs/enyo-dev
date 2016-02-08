'use strict';




import {Transform}               from 'stream';
import clone                     from 'clone';
import {fsync}                   from '../../util-extra';
import {default as logger,fatal} from '../../logger';

let log = logger.child({component: 'cache'});

const resetKeys = ['request', 'dependents', 'dependencies', 'bundle', 'bundleName', 'origins', 'rawContents', 'styleEntries', 'assetEntries', 'trace'];

class CacheStream extends Transform {
	constructor (opts) {
		super({objectMode: true});
		this.options = opts;
		this._modules = [];
		this._bundles = [];
		log.level(opts.logLevel || 'warn');
	}
	_transform (bundle, nil, next) {
		let   opts    = this.options
			, modules = this._modules
			, bundles = this._bundles;
		if (opts.cache) {
			Object.keys(bundle.modules).forEach(name => {
				modules.push(bundle.modules[name]);
			});
			bundles.push(bundle);
			next();
		} else next(null, bundle);
	}
	_flush (done) {
		let   opts    = this.options
			, bundles = this._bundles
			, modules = this._modules
			, cache
			, err;
		if (opts.cache) {
			log.info({file: opts.cacheFile}, 'Attempting to write the cache file');
			cache = [];
			modules.forEach(mod => cache.push(this._getCacheEntry(mod)));
			this.emit('cache', cache);
			err = writeCache(opts.cacheFile, cache);
			if (err) {
				log.trace(`Failed to write the cache file "${opts.cacheFile}"`, err);
				fatal(`Failed to write the cache file "${opts.cacheFile}"`);
			}
			bundles.forEach(bundle => this.push(bundle));
			this.push(null);
		}
		done();
	}
	_getCacheEntry (mod) {
		let ret = clone(mod);
		resetKeys.forEach(key => delete ret[key]);
		ret.contents = mod.rawContents;
		return ret;
	}
}

export default function cacheStream (opts) {
	return new CacheStream(opts);
}

function writeCache (file, data) {
	return fsync.writeJson(file, data);
}

function readCache (file) {
	log.level(logger.level());
	log.debug({file}, `Attempting to read and validate the cache "${file}"`);
	let {result: json, error} = fsync.readJson(file);
	if (!error) {
		log.debug(`Successfully read the cache file "${file}"`);
		return validate(json);
	} else {
		log.trace(`Failed to reach cache file "${file}"`, error);
		return error;
	}
}

function validate (json) {

	log.level(logger.level());

	if (!Array.isArray(json)) {
		log.debug('JSON file was corrupt');
		return false;
	}
	
	let ret = json.filter(entry => {
		return entry.isPackage ? validatePackage(entry) : validateFile(entry);
	});
	
	log.debug(`Able to retain ${ret.length} of ${json.length} entries from the cache`);
	
	return ret;
}

function validatePackage (entry) {
	let   main = entry.main
		, pkg  = entry.packageFile;
	return (
		(main ? stat(main, entry.mtime[main]) : true) &&
		(pkg ? stat(pkg,  entry.mtime[pkg]) : true)
	);
}

function validateFile (entry) {
	return stat(entry.fullpath, entry.mtime);
}

function stat (file, mtime) {
	let stat = fsync.stat(file);
	return stat ? (mtime >= stat.mtime.getTime()) : false;
}

export {writeCache,readCache,validate,CacheStream};