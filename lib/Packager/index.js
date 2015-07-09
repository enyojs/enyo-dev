'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs-extra');

var
	through = require('through2'),
	merge = require('merge'),
	defined = require('defined'),
	findIndex = require('find-index'),
	findLastIndex = require('find-index/last');

var
	EventEmitter = require('events').EventEmitter;

var
	defaults = require('./defaults'),
	logger = require('../logger'),
	factor = require('./lib/factor-source-stream'),
	source = require('./lib/process-source-stream'),
	assets = require('./lib/process-assets-stream'),
	style = require('./lib/process-style-stream'),
	sort = require('./lib/sort-stream'),
	pack = require('./lib/pack-bundle-stream'),
	listDeps = require('./lib/list-dependency-stream'),
	bundle = require('./lib/bundle-output-stream'),
	output = require('./lib/write-files-stream'),
	cm = require('./lib/cache-manager');

var
	log = logger.child({component: 'Packager'});



module.exports = Packager;



function Packager (opts) {
	if (!(this instanceof Packager)) return new Packager(opts);
	
	EventEmitter.call(this);
	
	this._READY = false;
	
	var pack = this;
	process.nextTick(function () {
		if (!opts || !opts.initialized) {
			Packager.initialize(opts, function (options) {
				pack.options = options;
				pack._ready();
			});
		} else {
			pack.options = opts;
			pack._ready();
		}
	});
}

util.inherits(Packager, EventEmitter);

/**
* Does the grunt work for initializing all of the packager options giving the correct priority to
* command-line overrides of any optionally provided package.json configuration.
*/
Packager.initialize = function (opts, done) {
	
	var
		pkgPath;

	opts = (opts && merge(this.options, opts)) || merge(true, defaults);
	opts.package = path.resolve(opts.package);
	pkgPath = path.join(opts.package, 'package.json');
	fs.readJson(pkgPath, function (err, json) {
		if (err) throw new Error(
			'unable to resolve package.json file "' + pkgPath + '"'
		);
		

		if (!json) throw new Error(
			'unable to parse package.json file "' + pkgPath + '": ' + e
		);
		
		json.main = defined(json.main, 'index.js');
		// for these properties we need to ensure that, if specified in the json, are relative to
		// the json regardless of where we are executing the process from
		if (json.paths) json.paths = json.paths.map(function (libPath) {
			return path.relative(process.cwd(), path.join(opts.package, libPath)) || '.';
		});
		if (json.outdir) json.outdir = path.relative(process.cwd(), path.join(opts.package, json.outdir)) || '.';
		
		Object.keys(json).forEach(function (key) {
			if (opts[key] != null) {
				if (opts[key] === defaults[key]) opts[key] = json[key];
			} else opts[key] = json[key];
		});
		
		logger.level(opts.logLevel || 'error');
		
		opts.cwd = process.cwd();
		if (opts.isLibrary) opts.externals = false;
		if (opts.production === true || opts.production === false) {
			opts.devMode = ! opts.production;
		} else {
			opts.production = ! opts.devMode;
		}
		opts.title = defined(opts.title, path.basename(opts.cwd));
		opts.initialized = true;
		log.level(logger.level());
		
		if (opts.lessPlugins && Array.isArray(opts.lessPlugins) && opts.lessPlugins.length) {
			opts.lessPlugins.forEach(function (entry) {
				
				try {
					entry.plugin = require(entry.name);
				} catch (e) {
					log.fatal(e, 'could not find requested Less plugin, ' + entry.name);
					process.exit(-1);
				}
				
			});
		}
		
		if (opts.assetRoots && Array.isArray(opts.assetRoots) && opts.assetRoots.length) {
			var
				fn = function (e) { return e.name == '*'; },
				idx = findLastIndex(opts.assetRoots, fn);
			if (idx !== -1) {
				opts.assetRoots.all = opts.assetRoots[idx].path;
				opts.assetRoots.splice(idx, 1);
			}
			while ((idx = findIndex(opts.assetRoots, fn)) !== -1) {
				opts.assetRoots.splice(idx, 1);
			}
		}
		
		// it is possible the cache was already set to something else
		if (opts.cache && typeof opts.cache == 'boolean' && !opts.resetCache) {
			// need to attempt to find the cachefile if it exists and start from that point
			cm.readCache(opts.cacheFile, function (err, data) {
				if (!err) opts.cache = Array.isArray(data) && data.length ? data : true;
				done(opts);
			});
		} else done(opts);
	});
	
};

Packager.prototype.run = function (opts) {
	if (!this._READY) {
		this.once('ready', this.run.bind(this, opts));
		return this;
	}
	opts = opts || this.options;
	
	var
		packager = this,
		stream = source(opts),
		cacheStream = cm.CacheStream(opts);
	
	if (opts.isLibrary) {
		return this._makeLibrary(opts);
	}
	
	else if (opts.listOnly) {
		stream
			.pipe(sort(opts))
			.pipe(factor(opts))
			.pipe(sort(opts))
			.pipe(listDeps(opts))
			.pipe(process.stdout);
	}

	else {
		log.info('beginning %s build for %s', opts.production ? 'production' : 'development', opts.package);
		
		cacheStream.on('cache',
			function (cache) {
				log.info('cache ready, emitting cache event');
				packager.emit('cache', cache);
			}
		);

		stream
			.pipe(sort(opts))
			.pipe(factor(opts))
			.pipe(sort(opts))
			.pipe(style(opts))
			.pipe(assets(opts))
			.pipe(pack(opts))
			.pipe(cacheStream)
			.pipe(bundle(opts))
			.pipe(output(opts))
			.on('finish',
				function () {
					log.info('build complete');
					packager.emit('end');
				}
			);
	}

	if (opts.cache && Array.isArray(opts.cache) && opts.cache.length) {
		
		log.info('using %d cached entries', opts.cache.length);
		
		opts.cache.forEach(function (entry) { stream.write(entry); });
	}
	// this may be redundant but always be sure to have the entry
	stream.write({path: opts.package, entry: true});

	stream.end();
	
	return this;
};

Packager.prototype._ready = function () {
	this._READY = true;
	this.emit('ready', this);
};

Packager.prototype.destroy = function () {
	this.removeAllListeners();
	this._READY = false;
	this.options = null;
};

Packager.prototype._makeLibrary = function (opts) {
	
	opts = opts || this.options;
	
	log.info('building %s as a library', opts.package);
	
	var
		packager = this,
		stream = source(opts),
		cacheStream = cm.CacheStream(opts),
		lib = opts.moduleDir || 'lib';

	if (opts.listOnly) {

		stream
			.pipe(factor(opts))
			.pipe(listDeps(opts))
			.pipe(process.stdout);

	} else {

		cacheStream.on('cache',
			function (cache) {
				log.info('cache ready, emitting cache event');
				packager.emit('cache', cache);
			}
		);

		stream
			.pipe(factor(opts))
			.pipe(style(opts))
			.pipe(assets(opts))
			.pipe(pack(opts))
			.pipe(cacheStream)
			.pipe(bundle(opts))
			.pipe(output(opts))
			.on('finish',
				function () {
					log.info('build complete');
					packager.emit('end');
				}
			);
	}

	if (opts.cache && Array.isArray(opts.cache) && opts.cache.length) {
		opts.cache.forEach(function (entry) { stream.write(entry); });
	}

	stream.write({
		path: opts.package,
		entry: true,
		lib: opts.package,
		libName: opts.name,
		name: opts.name,
		relName: opts.name
	});
	
	recurse(lib, function (err, files) {
		
		if (err) throw new Error(util.format('could not read the directory %s: %s', lib, err.toString()));
		files.forEach(function (file) {
			if (file.stat.isDirectory() || file.extname == '.js') {
				stream.write({path: file.fullpath, lib: opts.package, libName: opts.name});
			}
		});
		
		stream.end();
	}, opts.wip);
};




function recurse (dir, done, wip, shared, ignore) {

	dir = path.resolve(dir);
	shared = shared || [];
	ignore = ignore || [];
	
	if (wip || dir.indexOf('wip') === -1) {
	
		fs.stat(dir, function (err, stat) {

			if (err) return done (err);

			if (stat.isDirectory()) {
				var
					pkg = path.join(dir, 'package.json');

				fs.stat(pkg, function (err) {
				
					var read = function () {
						fs.readdir(dir, function (err, files) {

							if (err) return done(err);

							(function next (err) {

								if (err) return done(err);

								var file = files.shift();

								if (!file) done(null, shared);
								else recurse(path.join(dir, file), next, wip, shared, ignore);

							})();
						});
					};

					if (!err) {
						fs.readJson(pkg, function (err, json) {
							if (wip || !json.wip) {
								shared.push({stat: stat, fullpath: dir});
								ignore.push(path.join(dir, json.main || 'index.js'));
								read();
							} else done(null, shared);
						});
					
					} else read();
				});

			} else {
			
				if (ignore.indexOf(dir) === -1) {
					shared.push({stat: stat, fullpath: dir, extname: path.extname(dir)});
				}
			
				done(null, shared);
			}

		});
	} else done(null, shared);
}