'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	glob = require('glob'),
	isGlob = require('is-glob'),
	slash = require('slash'),
	merge = require('merge'),
	less = require('less'),
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	outfileSource = require('../outfile-source');

var
	Transform = require('stream').Transform,
	CleanCss = require('clean-css');

var
	log = logger.child({component: 'process-style-stream'});

module.exports = ProcessStyleStream;

function ProcessStyleStream (opts) {
	if (!(this instanceof ProcessStyleStream)) return new ProcessStyleStream(opts);
	
	Transform.call(this, {objectMode: true});
	
	var base;
	
	opts = opts || {};
	this.options = opts;
	this._bundles = [];
	
	log.level(opts.logLevel);
	
	if (opts.lessPlugins) log.debug(opts.lessPlugins);
	
	if (opts.outCssFile) {
		base = path.relative(
			opts.outdir,
			path.join(opts.outdir, path.dirname(opts.outCssFile))
		);
	}
	
	if (!base) base = opts.outdir;
	
	this._basePath = base;
}

util.inherits(ProcessStyleStream, Transform);

ProcessStyleStream.prototype._transform = function (bundle, nil, next) {
	this._bundles.push(bundle);
	next();
};

ProcessStyleStream.prototype._flush = function (done) {
	
	var
		bundles = this._bundles,
		stream = this;
	
	this._processBundles(bundles.slice(), function (err) {
		
		// as noted further below, this is due to a bug in Less...
		if (err) return process.nextTick(function () {
			utils.streamError(stream, 'failed to compile less: %s', err);
		});
		
		log.info('done processing all bundle styles');
		
		bundles.forEach(function (bundle) { stream.push(bundle); });
		stream.push(null);
		done();
	});
	
};

ProcessStyleStream.prototype._processBundles = function (bundles, done) {

	var
		stream = this,
		bundle = bundles.shift();
	
	if (!bundle) return this._renderStyles(done);
	
	this._processBundle(bundle, function () {
		stream._processBundles(bundles, done);
	});
};

ProcessStyleStream.prototype._processBundle = function (bundle, done) {
	
	var
		stream = this,
		modules = bundle.modules,
		order = bundle.order,
		entries = [],
		entry;
	
	log.info({bundle: bundle.name}, 'processing bundle style');
	
	for (var i = 0; i < order.length; ++i) {
		entry = modules[order[i]];
		if (entry.isPackage) {
			if (entry.json.styles) {
				
				if (entry.styleEntries) {
					log.info({bundle: bundle.name, module: entry.relName},
						'package %s has previously been processed and has %d known %s; ' +
						'we will be able to use this but will also need to re-scan for new files ' +
						'if they are based on dynamic globs',
						entry.relName,
						entry.styleEntries.length,
						entry.styleEntries.length === 1 ? 'entry' : 'entries'
					);
					entries = entries.concat(entry.styleEntries.map(function (style) {
						style.module = entry; return style;
					}));
				} else {
				
					log.info({bundle: bundle.name, module: entry.relName},
						'package %s has %d style %s',
						entry.relName,
						entry.json.styles.length,
						entry.json.styles.length === 1 ? 'entry' : 'entries'
					);
				
					entry.styleEntries = entry.json.styles.map(function (style) {
						// note that we will remove the module property later to avoid circular
						// references but is useful in debugging so we can associate output with
						// the correct module and bundle; also for correct pathing
						return {glob: style, module: entry};
					});
					
					entries = entries.concat(entry.styleEntries);
				}
			}
		}
	}
	
	this._findFiles(entries.slice(), function () {
		
		log.debug({bundle: bundle.name}, 'done processing raw style content');
		
		// here we concatenate the ordered content from the files that were found
		bundle.rawStyle = '';
		
		entries.forEach(function (entry) {
			bundle.rawStyle += ((bundle.rawStyle ? '\n' : '') + entry.source);
			// here is where we clean up the circular reference
			delete entry.module;
		});
		
		done();
	});
};

ProcessStyleStream.prototype._findFiles = function (entries, done) {
	
	var
		entry = entries.shift(),
		stream = this,
		file;
	
	if (!entry) return done();
	
	log.info({bundle: entry.module.bundleName, module: entry.module.relName},
		'finding style files associated with module %s in bundle %s',
		entry.module.relName,
		entry.module.bundleName
	);

	// always reset these so we only ever cache and use the correct files and avoid using ones
	// that were removed
	entry.files = [];
	if (!entry.sources) entry.sources = {};

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
				'found %d files associated with style glob pattern %s',
				files.length,
				entry.glob
			);
			
			// reset the combined source
			entry.source = '';
			
			entry.files = files.map(function (e) { return path.join(entry.module.fullpath, e); });
			files = entry.files.slice();
			
			(fp = function () {
				var file = files.shift();
				if (!file) {
					// if we are working with cached entries then there is a chance that we will
					// have unused entries so we try to find and remove them
					known = Object.keys(entry.sources);
					if (known.length > entry.files.length) {
						known.forEach(function (kf) {
							idx = entry.files.indexOf(kf);
							if (idx === -1) {
								log.debug(
									{module: entry.module.relName, bundle: entry.module.bundleName},
									'removing stale style file entry %s',
									kf
								);
								delete entry.sources[kf];
							}
						});
					}
					
					log.debug({module: entry.module.relName, bundle: entry.module.bundleName},
						'done processing glob entry %s',
						entry.glob
					);
					return stream._findFiles(entries, done);
				}
				stream._getFileContents(file, entry, function (data) {
					entry.sources[file] = data;
					entry.source += ((entry.source ? '\n' : '') + data);
					fp();
				});
			})();
		});
		
	} else {

		file = path.join(entry.module.fullpath, entry.glob);

		log.debug({module: entry.module.relName, bundle: entry.module.bundleName},
			'attempting to %s file %s',
			entry.source ? 'update if necessary' : 'read',
			file
		);

		entry.files.push(file);
		this._getFileContents(file, entry, function (data) {
			entry.source = entry.sources[file] = typeof data == 'string' ? data : '';
			stream._findFiles(entries, done);
		});
	}
};

ProcessStyleStream.prototype._renderStyles = function (done) {

	log.info('rendering final, cumulative styles');
	
	var
		bundles = this._bundles,
		opts = this.options,
		src = '',
		cfg = {},
		minifier;
	
	bundles.forEach(function (bundle) {
		if (bundle.rawStyle) {

			log.info({bundle: bundle.name}, 'using style');

			var tok = bundle.token = '/*bundle=' + bundle.name + '*/';
			src += '\n' + tok;
			src += bundle.rawStyle;
			src += tok + '\n';
		}
	});
	
	if (!src) {
		log.info('no style to process');
		return done();
	}
	
	if (opts.lessPlugins) {
		cfg.plugins = opts.lessPlugins.map(function (entry) {
			
			log.info('using plugin %s', entry.name);
			
			return new entry.plugin(entry.options);
		});
	}
	
	less
		.render(src, cfg)
		.then(function (compiled) {
			
			log.info('done compiling less');
			
			var css = compiled.css;
			bundles.forEach(function (bundle) {

				if (bundle.rawStyle) {
					var
						start = css.indexOf(bundle.token) + bundle.token.length + 1,
						end = css.lastIndexOf(bundle.token);
					
					log.debug({bundle: bundle.name}, 'attempting to separate bundle style');

					bundle.style = css.slice(start, end);
					if (opts.production) {
						if (!minifier) {
							minifier = new CleanCss({
								processImport: false,
								rebase: false,
								roundingPrecision: -1,
								keepSpecialComments: 0
							});
						}
						
						log.debug({bundle: bundle.name}, 'minifying style source');
						
						bundle.style = minifier.minify(bundle.style).styles;
					}
					
					log.debug({bundle: bundle.name}, 'done separating style');
				}
			});
			
			done();
		}, function (err) {
			log.error('there was an error compiling less');
			// there appears to be a bug where Less wraps the error callback handlers so re-throwing
			// is caught by them...
			done(err);
		});
	
};

ProcessStyleStream.prototype._getFileContents = function (file, entry, done) {

	var
		stream = this,
		opts = this.options,
		base = this._basePath;
	
	log.debug({file: file, bundle: entry.module.bundleName, module: entry.module.relName},
		'attempting to stat and potentially read file %s',
		file
	);
	
	fs.stat(file, function (err, stat) {
		if (err) {
			if (opts.strict) {
				utils.streamError(stream,
					'could not stat style file %s from module %s in bundle %s',
					file,
					entry.module.relName,
					entry.module.bundleName
				);
			} else {
				log.warn({file: file, module: entry.module.relName, bundle: entry.module.bundleName},
					'could not find style-file %s',
					file
				);
				return done();
			}
		}
		
		var prev = entry.module.mtime[file];
		
		// update the mtime for the newly read file
		entry.module.mtime[file] = stat.mtime.getTime();
		
		if (prev && prev == entry.module.mtime[file] && entry.sources[file]) {
			log.debug({file: file, module: entry.module.relName, bundle: entry.module.bundleName},
				'determined that the file is current'
			);
			
			return done(entry.sources[file]);
		}
		
		log.debug(
			{file: path.relative(opts.cwd, file), module: entry.module.relName, bundle: entry.module.bundleName}, 'reading'
		);
		
		fs.readFile(file, 'utf8', function (err, data) {
			if (err) utils.streamError(stream,
				'could not read style file %s from module %s in bundle %s',
				file,
				entry.module.relName,
				entry.module.bundleName
			);
			
			log.debug(
				{file: path.relative(opts.cwd, file), module: entry.module.relName, bundle: entry.module.bundleName}, 'done reading'
			);
			
			// we need to update all of the paths for the data
			data = translateImportPaths(data, path.dirname(file), path.relative(opts.cwd, file), entry.module);
			data = translateUrlPaths(data, file, entry.module, opts);
			done(data);
		});
	});
}

function translateImportPaths (text, base, file, pkg) {
	text = text.replace(/(\@import\s+(['"])(?!https?)([a-zA-Z0-9\ \/\-\.\@\{\}]+)\2)/g,
		function (match, full, wrap, src) {
			var ret;
			if (!utils.isAbsolute(src)) {
				ret = '@import \'' + (
						// we simply convert the relative path to the actual path
						slash(path.join(base, src))
					) + '\'';
				if (log.debug()) log.debug({file: file, module: pkg.relName, bundle: pkg.bundleName}, 'translating import from %s to %s', full, ret);
				return ret;
			} else return full;
		}
	);
	return text;
}

function translateUrlPaths (data, file, entry, opts) {
	
	var
		dir = path.dirname(file);
	
	return data.replace(/url\((?!(['"])?((http|data)\S+))(['"]?)(\S+?)\4\)/g, function (match, n0, n1, n2, n3, sub) {
		
		var
			actual, ret;
		
		if (!utils.isAbsolute(sub)) {
			actual = outfileSource(path.join(dir, sub), entry, opts);
			ret = 'url(\'' + actual + '\')';
			
			if (log.debug()) log.debug(
				{module: entry.relName, file: file, bundle: entry.bundleName},
				'translating url from %s to %s',
				match,
				ret
			);
			
			return ret;
		}
		
		return match;
	});
}