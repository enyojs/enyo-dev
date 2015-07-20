'use strict';

var
	path = require('path'),
	util = require('util');

var
	Promise = require('bluebird'),
	Transform = require('stream').Transform;

var
	glob = Promise.promisify(require('glob')),
	fs = Promise.promisifyAll(require('fs-extra')),
	uniq = require('array-uniq');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	outfileSource = require('../outfile-source');

var
	log = logger.child({component: 'process-assets-stream'});

function ProcessAssetsStream (opts) {
	if (!(this instanceof ProcessAssetsStream)) return new ProcessAssetsStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	opts = opts || {};
	this.options = opts;
	log.level(opts.logLevel);
	
	this.bundles = [];
}

module.exports = ProcessAssetsStream;

util.inherits(ProcessAssetsStream, Transform);

var proto = ProcessAssetsStream.prototype;

proto._transform = function (bundle, nil, next) {
	this.bundles.push(bundle);
	next();
};

proto._flush = function (done) {
	
	var bundles, stream;

	stream = this;
	bundles = this.bundles.map(function (bundle) {
		return stream.processBundle(bundle).then(function () {
			log.info({bundle: bundle.name}, 'done processing %d asset%s for %s',
				bundle.assets.length, bundle.assets.length === 1 ? '' : 's', bundle.name);
		});
	});
	
	Promise.all(bundles).then(function () {
		return stream.finish();
	}).then(function () {
		log.info('done processing all assets');
		done();
	});
	
};

proto.finish = Promise.method(function () {
	var stream = this;
	this.bundles.forEach(function (bundle) {
		stream.push(bundle);
	});
	stream.push(null);
});

proto.processBundle = function (bundle) {
	
	var modules, stream;
	
	stream = this;
	modules = Object.keys(bundle.modules).map(function (key) {
		return bundle.modules[key];
	}).filter(function (entry) {
		return entry.isPackage && (entry.json.assets || entry.json.devAssets);
	}).map(function (entry) {
		log.info({module: entry.relName, bundle: bundle.name}, 'processing module for assets');
		return stream.processModule(entry);
	});
	
	return Promise.all(modules).then(function () {
		return stream.resolveBundleAssets(bundle);
	});
};

proto.processModule = function (entry) {
	// we first have to re-check all glob patterns even if we have cached files, once we have
	// a complete list of the required files, remove any cached unnecessary files,
	// validate the remaining cached files, and grab any new ones
	var globs, opts, files, stream;
	
	opts = this.options;
	stream = this;
	globs = [];
	files = [];
	
	// if there is a previous reference to known assets we move it temporarily for later
	// comparison
	if (entry.assets) entry._assets = entry.assets;
	
	if (entry.json.assets) globs = globs.concat(entry.json.assets);
	if (opts.devMode && entry.json.devAssets) globs = globs.concat(entry.json.devAssets);
	
	if (log.debug()) log.debug({module: entry.relName, patterns: globs}, 'module has %d asset entr%s to search', globs.length, globs.length === 1 ? 'y' : 'ies');
	
	globs = globs.map(function (pat) {
		return glob(pat, {cwd: entry.fullpath, nodir: true}).catch(function (e) {
			return Promise.reject(new Error(util.format(
				'Failed to process asset file or pattern %s (module %s):\n\t%s', pat, entry.relName, e.toString()
			)));
		});
	});
	
	return Promise.settle(globs).then(function (results) {
		results.forEach(function (res) {
			if (res.isRejected()) log.error(res.reason());
			else files = files.concat(res.value());
		});
		entry.assets = uniq(files).map(function (file) {
			return path.join(entry.fullpath, file);
		});
	}).then(function () {
		return stream.updateModuleCache(entry);
	});
};

proto.resolveBundleAssets = function (bundle) {
	
	var assets, modules, stream, opts;
	
	opts = this.options;
	stream = this;
	assets = bundle.assets = [];
	
	Object.keys(bundle.modules).map(function (key) {
		return bundle.modules[key];
	}).filter(function (entry) {
		return entry.assets && entry.assets.length;
	}).forEach(function (entry) {
		entry.assets.forEach(function (file) {
			assets.push({
				source: file,
				outfile: path.join(
					opts.outdir,
					outfileSource(file, entry, opts, true)
				),
				copy: true,
				mtime: entry.mtime[file]
			});
		});
	});
};

proto.updateModuleCache = function (entry) {
	
	var prev, curr, updating;

	curr = entry.assets;
	
	if (entry._assets) {
		prev = entry._assets;
		delete entry._assets;
		prev.forEach(function (file) {
			if (curr.indexOf(file) === -1) delete entry.mtime[file];
		});
	}
	
	updating = curr.map(function (file) {
		return fs.statAsync(file).then(function (ostat) {
			entry.mtime[file] = ostat.mtime.getTime();
		}).catch(function (e) {
			log.error(e, util.format('Could not stat asset file %s', file));
		});
	});
	
	return Promise.all(updating);
};