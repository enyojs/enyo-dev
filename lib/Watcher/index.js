'use strict';

var
	path = require('path'),
	util = require('util');

var
	chokidar = require('chokidar');

var
	logger = require('../logger');

var
	Packager = require('../Packager'),
	EventEmitter = require('events').EventEmitter;

var
	log = logger.child({component: 'watcher'});

module.exports = Watcher;

function Watcher (opts) {
	if (!(this instanceof Watcher)) return new Watcher(opts);

	EventEmitter.call(this);
	
	opts = opts || {};
	this._queue = [];
	this._building = false;
	
	Packager.initialize(opts, function (opts) {
		log.level(opts.logLevel);
		this.options = opts;
		
		if (opts.production) {
			throw new Error(
				'cannot run watch-mode on production builds'
			);
		}
		
		this._init();
	}.bind(this));
};

util.inherits(Watcher, EventEmitter);

Watcher.prototype._init = function () {

	var
		watcher = this,
		opts = this.options;
	
	log.info('initializing');
	
	this._initPackager(function () {
		
		if (!opts.trustCache || !opts.cache || !Array.isArray(opts.cache)) {
			// the first time we need to wait until a complete build has been executed to ensure the
			// cache we have is up to date before installing the system monitors
			watcher.once('end', function () {
				watcher._installMonitor();
			});
			log.debug('running the packager for the initial time');
			watcher._build();
		} else {
			
			log.debug('trusting the cache');
			watcher._cache = opts.cache;
			watcher._installMonitor();
		}
	});
};

Watcher.prototype._initPackager = function (done) {
	
	var
		watcher = this,
		opts = this.options,
		pack = this._packager = Packager(opts);
	
	log.debug('initializing new packager instance');
	
	pack.once('ready', function () {
		log.debug('received ready event from packager');
		pack.on('cache', watcher._receiveCache.bind(watcher));
		pack.on('end', watcher._buildComplete.bind(watcher));
		done();
	});
	
};

Watcher.prototype._receiveCache = function (cache) {
	log.debug('received cache from packager');
	
	this._cache = this.options.cache = cache;
	this.emit('cache', cache);
};

Watcher.prototype._buildComplete = function (e) {
	
	log.info('done building');
	
	this._building = false;
	// will submit an error marker to anyone listening can know if it was successful or not
	this.emit('end', e);
	if (!e) this._startTimer(true);
};

Watcher.prototype._build = function () {
	
	var
		pack = this._packager,
		watcher = this,
		opts = this.options;
	
	if (!this._building) {
		
		log.info('building');
		
		this._building = true;
		this.emit('build');
		
		try {
			pack.run(opts);
		} catch (e) {
		
			log.error(e, 'could not complete build due to encountered errors');
			
			this._packager.destroy();
			this._packager = null;
			// @todo do we need to wipe the cache clean
			this._initPackager(function () {
				watcher._buildComplete(e);
			});
		}
	}
};

Watcher.prototype._installMonitor = function () {
	
	if (!this._cache) return this.once('cache', this._installMonitor.bind(this));
	
	log.info('installing filesystem monitor');
	
	var
		watcher = this,
		opts = this.options,
		outdir = opts.outdir,
		config = {},
		paths, monitor;
	
	config.followSymlinks = true;
	config.cwd = opts.cwd;
	config.persistent = true;
	config.ignoreInitial = true;
	config.ignored = [path.join(opts.cwd, outdir, '**.*'), /[\/\\]\./];
	config.usePolling = !! opts.polling;
	if (opts.polling) config.interval = opts.pollingInterval;
	
	paths = this._getPaths();

	monitor = this._monitor = chokidar.watch(paths, config);

	monitor.on('ready', function () {
		log.info('monitoring filesystem from %s', opts.cwd);
		watcher.emit('ready');
	});
	monitor.on('error', function (err) { throw err; });
	monitor.on('change', this._changed.bind(this));
	monitor.on('add', this._added.bind(this));
	
};

Watcher.prototype._getPaths = function () {
	
	var
		cache = this._cache,
		opts = this.options,
		types = '*.{js,css,less}',
		paths = [], adirs = [], sdirs = [];
	
	if (opts.watchPaths && Array.isArray(opts.watchPaths)) {
		opts.watchPaths.forEach(function (p) {
			p = path.relative(opts.cwd, path.resolve(p));
			if (path.extname(p)) paths.push(p);
			else {
				paths.push(path.join(p, '**', types));
				paths.push(path.join(p, '**', 'package.json'));
			}
		});
	}
	
	cache.forEach(function (entry) {
		if (!entry.external) {
			if (entry.isPackage) {
				paths.push(path.relative(opts.cwd, entry.main));
				paths.push(path.join(path.relative(opts.cwd, entry.fullpath), types));
				paths.push(path.relative(opts.cwd, entry.packageFile));
				if (entry.assetEntries && entry.assetEntries.length) {
					entry.assetEntries.forEach(function (ae) {
						if (ae.files && ae.files.length) {
							ae.files.forEach(function (a) {
								var dir = path.dirname(a);
								if (adirs.indexOf(dir) === -1) {
									adirs.push(dir);
									paths.push(path.join(path.relative(opts.cwd, dir), '**.*'));
								}
							});
						}
					});
				}
				if (entry.styleEntries && entry.styleEntries.length) {
					entry.styleEntries.forEach(function (se) {
						if (se.files && se.files.length) {
							se.files.forEach(function (s) {
								var dir = path.dirname(s);
								if (sdirs.indexOf(dir) === -1) {
									sdirs.push(dir);
									paths.push(path.join(path.relative(opts.cwd, dir), '**.{css,less}'));
								}
							});
						}
					});
				}
			} else paths.push(path.relative(opts.cwd, entry.fullpath));
		}
	});
	
	if (log.debug()) log.debug({paths: paths}, 'determined we should watch these paths');
	
	return paths;
};

Watcher.prototype._startTimer = function (noupdate) {
	
	var
		watcher = this;
	
	// since this could be called too many times consecutively we can't afford to potentially
	// reset the timer for every file encountered in the window, so we only set it once and check
	// if other changes have taken place since we set it, in which case we reset it again and wait
	// until nothing has changed
	if (!this._tid && !noupdate) {
		
		log.debug('starting timer');
		
		this._tid = setTimeout(function () {
			watcher._tid = null;
			
			if (watcher._torig === watcher._twait && !watcher._building) {
				
				log.debug('timer fired, can process queue');
				watcher._processQueue();
			} else {
				
				log.debug('timer fired but need to restart');
				
				watcher._startTimer();
			}
		}, 100);
		// could potentially use hrtime here
		this._torig = Date.now();
		this._twait = this._torig;
	} else if (!noupdate) this._twait = Date.now();
};

Watcher.prototype._processQueue = function () {
	
	var
		queue = this._queue,
		cache = this._cache,
		seen;
	
	
	if (queue.length) {
		log.debug('processing queue %d', queue.length);
	
		// reset the queue
		this._queue = [];

		if (queue.length > 1) seen = [];

		for (var i = 0; i < queue.length; ++i) {
			if (!seen || seen.indexOf(queue[i]) === -1) {
				this._processFile(queue[i]);
				if (seen) seen.push(queue[i]);
			}
		}

		// @todo it appears the most straight-forward way to do this is actually to let it re-use
		// the cache and re-evaluate blobs...it already checks to see if the files were updated
		// and without a more sophisticated implementation of the cache and invalidator this will
		// be near impossible to make useful
		this._build();
	} else log.debug('nothing to process, queue is empty');
	
};

Watcher.prototype._processFile = function (file) {
	
	var
		ext = path.extname(file);

	if (path.basename(file) == 'package.json') {
		return this._processPackage(file);
	}

	// as is the case in a few other places this is too strict with fixed extensions but will
	// have to do for this first pass until we open it up a bit for dynamic types
	switch (ext) {
		
	case '.js':
		this._processSource(file);
		break;
	case '.css':
	case '.less':
		this._processStyle(file);
		break;
	default:
		this._processAsset(file);
		break;
	}
};

Watcher.prototype._processAsset = function (file) {

	log.debug({file: file}, 'processing asset file');
	
	var
		cache = this._cache,
		opts = this.options,
		rel = file,
		entry, aentry, found, idx;

	file = path.join(opts.cwd, file);

	for (var i = 0; i < cache.length && !found; ++i) {
		entry = cache[i];
		if (entry.isPackage) {
			if (entry.assetEntries) {
				for (var j = 0; j < entry.assetEntries.length; ++j) {
					aentry = entry.assetEntries[j];
					if (aentry.files && aentry.files.length) {
						if (aentry.files.indexOf(file) > -1) {
							found = true;
							idx = i;
							break;
						}
					}
				}
			}
		}
		if (!found) entry = null;
	}

	if (entry) {

		// currently we don't do a sophisticated caching scheme where we attempt to track exactly
		// what changed and handle accordingly, currently we try and find which module the file
		// belonged to and remove it from the cache so it will be re-built - but in the future a
		// more complicated/sophisticated scheme could supplant this

		log.debug({file: rel, module: entry.relName}, 'file belonged to module, removing from cache');

		cache.splice(idx, 1);

	} else {

		log.debug({file: rel}, 'could not find an entry for source file');

	}

};

Watcher.prototype._processStyle = function (file) {
	
	log.debug({file: file}, 'processing style file');
	
	var
		cache = this._cache,
		opts = this.options,
		rel = file,
		entry, sentry, found, idx;

	file = path.join(opts.cwd, file);

	for (var i = 0; i < cache.length && !found; ++i) {
		entry = cache[i];
		if (entry.isPackage) {
			if (entry.styleEntries) {
				for (var j = 0; j < entry.styleEntries.length; ++j) {
					sentry = entry.styleEntries[j];
					if (sentry.files && sentry.files.length) {
						if (sentry.files.indexOf(file) > -1) {
							found = true;
							idx = i;
							break;
						}
					}
				}
			}
		}
		if (!found) entry = null;
	}

	if (entry) {
	
		// currently we don't do a sophisticated caching scheme where we attempt to track exactly
		// what changed and handle accordingly, currently we try and find which module the file
		// belonged to and remove it from the cache so it will be re-built - but in the future a
		// more complicated/sophisticated scheme could supplant this
	
		log.debug({file: rel, module: entry.relName}, 'file belonged to module, removing from cache');
	
		cache.splice(idx, 1);
	
	} else {

		log.debug({file: rel}, 'could not find an entry for source file');

	}
	
};

Watcher.prototype._processPackage = function (file) {
	
	log.debug({file: file}, 'processing package file');
	
	var
		cache = this._cache,
		opts = this.options,
		rel = file,
		entry, idx;
	
	file = path.join(opts.cwd, file);
	
	for (var i = 0; i < cache.length; ++i) {
		entry = cache[i];
		if (entry.isPackage) {
			if (entry.packageFile == file) {
				idx = i;
				break;
			}
		}
		entry = null;
	}
	
	if (entry) {
		
		// currently we don't do a sophisticated caching scheme where we attempt to track exactly
		// what changed and handle accordingly, currently we try and find which module the file
		// belonged to and remove it from the cache so it will be re-built - but in the future a
		// more complicated/sophisticated scheme could supplant this
		
		log.debug({file: rel, module: entry.relName}, 'file belonged to module, removing from cache');
		
		cache.splice(idx, 1);
	} else {
	
		log.debug({file: rel}, 'could not find an entry for source file');
	
	}
};

Watcher.prototype._processSource = function (file) {
	
	log.debug({file: file}, 'processing source file');
	
	var
		cache = this._cache,
		opts = this.options,
		rel = file,
		entry, idx;
	
	// returned as relative path
	file = path.join(opts.cwd, file);
	
	for (var i = 0; i < cache.length; ++i) {
		entry = cache[i];
		if (entry.isPackage) {
			if (entry.main == file) {
				idx = i;
				break;
			}
		} else {
			if (entry.fullpath == file) {
				idx = i;
				break;
			}
		}
		entry = null;
	}
	
	if (entry) {
		
		// currently we don't do a sophisticated caching scheme where we attempt to track exactly
		// what changed and handle accordingly, currently we try and find which module the file
		// belonged to and remove it from the cache so it will be re-built - but in the future a
		// more complicated/sophisticated scheme could supplant this
		
		log.debug({file: rel, module: entry.relName}, 'file belonged to module, removing from cache');
		
		cache.splice(idx, 1);
	} else {
	
		log.debug({file: rel}, 'could not find an entry for source file');
	
	}
};

Watcher.prototype._changed = function (file) {
	
	this._startTimer();
	
	log.debug({file: file}, 'changed');
	
	this._queue.push(file);
};

Watcher.prototype._added = function (file) {
	// unfortunately due to a bug in chokidar files modified from a symlink to a symlink aren't
	// directly added until after they've changed and it incorrectly reports add for the first
	// change so we pass this on and handle as a change event
	this._changed(file);
};