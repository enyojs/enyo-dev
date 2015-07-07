'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	glob = require('glob'),
	isGlob = require('is-glob'),
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	outfileSource = require('../outfile-source');

var
	Transform = require('stream').Transform;

var
	log = logger.child({component: 'process-assets-stream'});

module.exports = ProcessAssetsStream;

function ProcessAssetsStream (opts) {
	if (!(this instanceof ProcessAssetsStream)) return new ProcessAssetsStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	opts = opts || {};
	this.options = opts;
	log.level(opts.logLevel);
	
	this._bundles = [];
}

util.inherits(ProcessAssetsStream, Transform);

ProcessAssetsStream.prototype._transform = function (bundle, nil, next) {
	this._bundles.push(bundle);
	next();
};

ProcessAssetsStream.prototype._flush = function (done) {
	
	var
		bundles = this._bundles,
		stream = this;

	this._processBundles(bundles.slice(), function (err) {
	
		log.info('done processing all bundle assets');
	
		bundles.forEach(function (bundle) { stream.push(bundle); });
		stream.push(null);
		done();
	});
	
};

ProcessAssetsStream.prototype._processBundles = function (bundles, done) {

	var
		stream = this,
		bundle = bundles.shift();

	if (!bundle) return done();

	this._processBundle(bundle, function () {
		stream._processBundles(bundles, done);
	});
	
};

ProcessAssetsStream.prototype._processBundle = function (bundle, done) {
	
	var
		stream = this,
		opts = this.options,
		modules = bundle.modules,
		order = bundle.order,
		entries = [],
		files = [],
		entry;

	log.info({bundle: bundle.name}, 'processing bundle assets');

	for (var i = 0; i < order.length; ++i) {
		entry = modules[order[i]];
		if (entry.isPackage) {
			if (entry.json.assets || entry.json.devAssets) {
				if (entry.assetEntries) {
					log.info({bundle: bundle.name, module: entry.relName},
						'package %s has previously been processed and has %d known %s; ' +
						'we will be able to use this but will also need to re-scan for new files ' +
						'if they are based on dynamic globs',
						entry.relName,
						entry.assetEntries.length,
						entry.assetEntries.length === 1 ? 'entry' : 'entries'
					);
					entries = entries.concat(entry.assetEntries.map(function (asset) {
						asset.module = entry; return asset;
					}));
				} else {
			
					log.info({bundle: bundle.name, module: entry.relName},
						'package %s has %d asset %s%s',
						entry.relName,
						entry.json.assets ? entry.json.assets.length : 0,
						entry.json.assets ? entry.json.assets.length === 1 ? 'entry' : 'entries' : 'entries',
						entry.json.devAssets && opts.devMode ? util.format(
							' and %d devAsset %s',
							entry.json.devAssets.length,
							entry.json.devAssets.length === 1 ? 'entry' : 'entries'
						) : ''
					);
					
					if (entry.json.assets) {
						entry.assetEntries = entry.json.assets.map(function (asset) {
							// note that we will remove the module property later to avoid circular
							// references but is useful in debugging so we can associate output with
							// the correct module and bundle; also for correct pathing
							return {glob: asset, module: entry};
						});
					}
					
					if (entry.json.devAssets && entry.json.devAssets.length && opts.devMode) {
						if (!entry.assetEntries) entry.assetEntries = [];
						
						entry.assetEntries = entry.assetEntries.concat(
							entry.json.devAssets.map(function (asset) {
								return {glob: asset, module: entry}
							})
						);
					}
				
					if (entry.assetEntries) entries = entries.concat(entry.assetEntries);
				}
			}
		}
	}
	
	this._findFiles(entries.slice(), function () {
		entries.forEach(function (entry) {
			
			if (entry.updated && entry.updated.length) {
				entry.updated.forEach(function (file) {
					if (findIndex(files, function (e) { return e.source == file; }) === -1) {
					
						files.push({
							source: file,
							outfile: path.join(
								opts.outdir,
								outfileSource(file, entry.module, opts)
							),
							copy: true,
							packagePath: entry.module.fullpath,
							// pass the actual mtime through
							mtime: entry.module.mtime[file]
						});
					}
				});
			}
			
			// here is where we clean up the circular reference
			delete entry.module;
		});
		
		log.debug({bundle: bundle.name}, 'done processing asset files (%d)', files.length);
		
		bundle.assetFiles = files;
		done();
	});
};

ProcessAssetsStream.prototype._findFiles = function (entries, done) {
	
	var
		entry = entries.shift(),
		stream = this,
		file;

	if (!entry) return done();

	log.info({bundle: entry.module.bundleName, module: entry.module.relName},
		'finding asset files associated with module %s in bundle %s',
		entry.module.relName,
		entry.module.bundleName
	);

	// always reset these so we only ever cache and use the correct files and avoid using ones
	// that were removed
	entry.files = [];
	entry.updated = [];
	
	if (isGlob(entry.glob)) {
		
		log.debug({bundle: entry.module.bundleName, module: entry.module.relName},
			'determined that entry %s is a glob and must be re-scanned for new or missing files',
			entry.glob
		);
		
		glob(entry.glob, {cwd: entry.module.fullpath}, function (err, files) {
			
			var
				i, idx, fp, known;
			
			if (err) utils.streamError(stream,
				'failed to read files from glob entry %s from module %s in bundle %s: %s',
				entry.glob,
				entry.module.relName,
				entry.module.bundleName,
				err
			);
			
			log.debug({module: entry.module.relName, bundle: entry.module.bundleName},
				'found %d %s associated with asset glob pattern %s',
				files.length,
				files.length === 1 ? 'file' : 'files',
				entry.glob
			);
			
			entry.files = files.map(function (e) { return path.join(entry.module.fullpath, e); });
			files = entry.files.slice();
			
			(fp = function () {
				var file = files.shift();
				if (!file) {
					log.debug({module: entry.module.relName, bundle: entry.module.bundleName},
						'done processing glob entry %s',
						entry.glob
					);
					return stream._findFiles(entries, done);
				}
				stream._checkFile(file, entry, function (include) {
					if (include) {
						if (entry.updated.indexOf(file) === -1) {
							entry.updated.push(file);
						}
					}
					fp();
				});
			})();
		});
		
	} else {

		file = path.join(entry.module.fullpath, entry.glob);

		log.debug({module: entry.module.relName, bundle: entry.module.bundleName},
			'attempting to stat file %s',
			file
		);

		entry.files.push(file);
		
		this._checkFile(file, entry, function (include) {
			if (include) {
				if (entry.updated.indexOf(file) === -1) {
					entry.updated.push(file);
				}
			}
			stream._findFiles(entries, done);
		});
	}
};

ProcessAssetsStream.prototype._checkFile = function (file, entry, done) {
	var
		stream = this,
		opts = this.options;
	
	fs.stat(file, function (err, stat) {
		if (err) {
			if (opts.strict) {
				utils.streamError(stream,
					'could not stat asset file %s from module %s in bundle %s',
					file,
					entry.module.relName,
					entry.module.bundleName
				);
			} else {
				log.warn({file: path.relative(opts.cwd, file), module: entry.module.relName, bundle: entry.module.bundleName},
					'could not find asset file %s from module %s in bundle %s',
					path.relative(opts.cwd, file),
					entry.module.relName,
					entry.module.bundleName
				);
				return done(false);
			}
		}
		
		var prev = entry.module.mtime[file];
		
		// update the mtime for the newly read file
		entry.module.mtime[file] = stat.mtime.getTime();
		
		if (prev && prev == entry.module.mtime[file]) {
			log.debug({file: path.relative(opts.cwd, file), module: entry.module.relName, bundle: entry.module.bundleName},
				'determined that the file is current'
			);
			
			// return done(false);
			// without a way to efficiently determine that the file, if it exists in the output
			// directory, is the same as this file, we can't just ignore the file
			
			// @todo this can be undone by having the write file stream actually update the mtime
			// of the files it copies to match so we can do a direct comparison of the mtimes but
			// this is tricky to ensure they are actually consistent across platforms as some
			// systems only support it up to the second and not subsecond precision
			
			return done(true);
		} else done(true);
	});
};