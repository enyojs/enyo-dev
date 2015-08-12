'use strict';

var
	path = require('path'),
	util = require('util');

var
	Transform = require('stream').Transform,
	Promise = require('bluebird'),
	CleanCss = require('clean-css');

var
	glob = Promise.promisify(require('glob')),
	slash = require('slash'),
	lessc = require('less'),
	fs = Promise.promisifyAll(require('fs-extra'));

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	hasher = require('../hasher'),
	outfileSource = require('../outfile-source');

var
	log = logger.child({component: 'process-style-stream'});



function ProcessStyleStream (opts) {
	if (!(this instanceof ProcessStyleStream)) return new ProcessStyleStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.bundles = [];
	this.sources = {};
	this.lessOnlyLess = !! opts.lessOnlyLess;
	this.relative = function (p) { return path.relative(opts.cwd, p); };
	log.level(opts.logLevel);

	var base;
	if (opts.outCssFile && opts.production) {
		base = path.relative(opts.outdir, path.join(opts.outdir, path.dirname(opts.outCssFile)));
	}
	if (!base) base = opts.outdir;
	this.basePath = base;
}

util.inherits(ProcessStyleStream, Transform);

module.exports = ProcessStyleStream;

var proto = ProcessStyleStream.prototype;

proto._transform = function (bundle, nil, next) {
	this.bundles.push(bundle);
	next();
};

proto._flush = function (done) {
	log.info('attempting to process %d bundles for style', this.bundles.length);
	this.processStyle().then(done);
};

proto.processStyle = function () {
	var stream;
	stream = this;
	return this.getFiles().then(function (files) {
		if (files.length) return stream.compile(files);
		log.info('there were no styles found');
	}).then(function () {
		return stream.finalize();
	});
};

proto.finalize = Promise.method(function () {
	var stream, bundles;
	stream = this;
	bundles = this.bundles;
	bundles.push(null);
	if (log.info()) log.info('style processing complete');
	bundles.forEach(function (bundle) { stream.push(bundle); });
});

proto.compile = function (files) {
	var opts, stream, lessOnlyLess;
	opts = this.options;
	stream = this;
	lessOnlyLess = opts.lessOnlyLess;
	return this.fetch(files).then(function (entries) {
		return Promise.resolve(lessOnlyLess).then(function (filter) {
			return entries.filter(function (entry) {
				// @todo we should allow this to be dynamically specified in a range not fixed
				// file extension
				return entry.contents && (!filter || (filter && path.extname(entry.fullpath) == '.less'));
			});
		}).then(function (toCompile) {
			return stream.precompile(toCompile).then(function (source) {
				return stream.lessc(source);
			}).then(function (compiled) {
				return stream.postcompile(toCompile, compiled);
			}).then(function () {
				return stream.postprocess(entries);
			});
		})
	});
};

proto.precompile = Promise.method(function (files) {
	var stream, source;
	stream = this;
	source = '';
	files.forEach(function (entry) {
		var tok = entry.token = ('/* ' + hasher(entry.fullpath) + ' */');
		source += ('\n' + tok + entry.contents + tok);
	});
	return source;
});

proto.postcompile = Promise.method(function (entries, compiled) {
	var stream = this;
	entries.forEach(function (entry) {
		var start, end;
		start = compiled.indexOf(entry.token) + entry.token.length + 1;
		end = compiled.lastIndexOf(entry.token);
		if (isNaN(start) || isNaN(end) || start === -1 || end === -1) {
			log.warn({
				bundle: entry.bundle.name,
				module: entry.module.relName,
				file: stream.relative(entry.fullpath)
			}, 'unable to locate parsing tokens for compiled Less content, will continue with uncompiled source');
		} else {
			entry.contents = compiled.slice(start, end);
		}
	});
});

proto.postprocess = Promise.method(function (entries) {
	var opts;
	opts = this.options;
	entries.forEach(function (entry) {
		var bundle = entry.bundle;
		if (entry.contents) {
			if (!bundle.style) bundle.style = (entry.contents + '\n');
			else bundle.style += (entry.contents + '\n');
		}
	});
	if (opts.minifyCss) return this.minify();
});

proto.lessc = function (source) {
	var opts, stream, cfg;
	opts = this.options;
	stream = this;
	cfg = {paths: [opts.cwd]};
	if (opts.lessPlugins) {
		cfg.plugins = opts.lessPlugins.map(function (entry) {
			log.info('using Less pluging %s', entry.name);
			return new entry.plugin(entry.options || {});
		});
	}
	if (log.debug()) log.debug('beginning Less compilation of %d characters', source.length);
	return lessc.render(source, cfg).then(function (compiled) {
		if (log.debug()) log.debug('Less compilation complete, final length %d characters', compiled.css.length);
		return compiled.css;
	}, function (e) {
		log.error(e, 'failed to compile Less, will attempt to continue with uncompiled style');
		return source;
	});
};

proto.minify = Promise.method(function () {
	var minifier, bundles;
	bundles = this.bundles;
	minifier = new CleanCss({
		processImport: false,
		rebase: false,
		roundingPrecision: -1,
		keepSpecialComments: 0
	});
	if (log.info()) log.info('the minifyCss option was set, minifying bundle style');
	bundles.forEach(function (bundle) {
		if (bundle.style) bundle.style = minifier.minify(bundle.style).styles;
	});
});

proto.fetch = function (files) {
	var stream, opts, sources;
	stream = this;
	opts = this.options;
	sources = this.sources;
	return Promise.map(files, function (file) {
		var bundle, entry, source;
		source = sources[file];
		bundle = source.bundles[source.bundles.length - 1];
		entry = source.modules[source.modules.length - 1];
		return fs.readFileAsync(file, 'utf8').then(function (contents) {
			if (contents) {
				contents = translateImportPaths(contents, stream.relative(path.dirname(file)), stream.relative(file), entry, bundle);
				contents = translateUrlPaths(contents, path.dirname(file), stream.relative(file), entry, bundle, opts);
				return {contents: contents, fullpath: file, module: entry, bundle: bundle};
			} else if (log.info()) {
				log.info({bundle: bundle.name, module: entry.relName, file: stream.relative(file)}, 'style file had no content, ignoring');
			}
			return {contents: '', fullpath: file, module: entry, bundle: bundle};
		}, function (e) {
			if (opts.strict) {
				log.error(e, util.format('failed to retrieve style file %s in strict mode, stopping build', stream.relative(file)));
				process.exit(-1);
			} else {
				log.warn('unable to retrieve style file %s, will continue without it if possible', stream.relative(file));
				return {contents: '', fullpath: file, module: entry, bundle: bundle};
			}
		});
	});
};

proto.getFiles = function () {
	var stream;
	stream = this;
	return Promise.map(this.bundles, function (bundle) {
		return stream.resolve(bundle);
	}).reduce(function (ret, next) {
		return ret.concat(next);
	}, []).then(function (files) {
		return stream.unique(files);
	});
};

proto.resolve = Promise.method(function (bundle) {
	var order, modules, stream;
	stream = this;
	order = bundle.order;
	modules = bundle.modules;
	if (!order || !Array.isArray(order) || !modules) return files;
	return Promise.map(order, function (name) {
		var entry = modules[name];
		if (entry.isPackage && entry.json.styles && entry.json.styles.length) {
			log.info({bundle: bundle.name, module: entry.relName}, 'has %d style entr%s', entry.json.styles.length, entry.json.styles.length === 1 ? 'y' : 'ies');
			return stream.globs(entry.json.styles, entry, bundle);
		}
	}).filter(function (result) {
		return result && Array.isArray(result) && result.length;
	}).reduce(function (results, files) {
		return results.concat(files);
	}, []);
});

proto.globs = function (globs, entry, bundle) {
	var stream, sources, source, warning;
	stream = this;
	sources = this.sources;
	return Promise.map(globs, function (globish) {
		if (log.debug()) log.debug({bundle: bundle.name, module: entry.relName}, 'resolving pattern %s from %s', globish, stream.relative(entry.fullpath));
		return glob(globish, {cwd: entry.fullpath, nodir: true}).then(function (files) {
			if (log.debug()) log.debug({bundle: bundle.name, module: entry.relName, glob: globish, files: files}, 'resolved %d file%s', files.length, files.length === 1 ? '' : 's');
			return files.map(function (file) {
				var fullpath = path.join(entry.fullpath, file);
				if (sources.hasOwnProperty(fullpath) && log.debug()) {
					source = sources[fullpath];
					warning = 'style file has already been encountered';
					if (source.bundles.indexOf(bundle) === -1) {
						warning += util.format(
							', previously belonged to bundle%s',
							source.bundles.length === 1 ? util.format(' %s', source.bundles[0].name) : util.format(
								's %s', source.bundles.map(function (bundle) { return bundle.name; }).join(', ')
							)
						);
					}
					if (source.modules.indexOf(entry) === -1) {
						warning += util.format(
							', previously belonged to module%s',
							source.modules.length === 1 ? util.format(' %s', source.modules[0].relName) : util.format(
								's %s', source.modules.map(function (entry) { return entry.relName; }).join(', ')
							)
						);
					}
					log.debug({
						file: stream.relative(fullpath),
						bundle: bundle.name,
						module: entry.relName,
						glob: globish
					}, warning);
				}
				if (!(source = sources[fullpath])) source = sources[fullpath] = {};
				if (!source.bundles) source.bundles = [];
				if (!source.modules) source.modules = [];
				if (source.bundles.indexOf(bundle) === -1) source.bundles.push(bundle);
				if (source.modules.indexOf(entry) === -1) source.modules.push(entry);
				return fullpath;
			});
		});
	}).reduce(function (results, files) {
		return results.concat(files);
	}, []).then(function (files) {
		if (log.debug()) log.debug({bundle: bundle.name, module: entry.relName, files: files});
		// assign the styles for this entry in this way so that they are cached and thus usable
		// by the watcher utility or human readable for inspection later
		entry.styles = files;
		return files;
	});
};

proto.unique = function (files) {
	var result, i, e, seen, file, elif, c, sources, source;
	sources = this.sources;
	seen = {};
	result = [];
	i = 0;
	for (i = 0; i < files.length; ++i) {
		file = files[i];
		if (!isNaN((c = seen[file]))) {
			// this means it is now time to go ahead and add the entry
			if (c === i) result.push(file);
		} else {
			for (e = files.length - 1; e >= i; --e) {
				elif = files[e];
				if (elif == file) {
					if (e > i) {
						source = sources[file];
						if (log.info()) log.info(
							{file: this.relative(file), bundles: source.bundles.map(function (bundle) { return bundle.name; }).join(', '), modules: source.modules.map(function (entry) { return entry.relName; }).join(', ')},
							'style file included multiple times, it will be included with %s in the %s bundle',
							source.modules[source.modules.length - 1].relName,
							source.bundles[source.bundles.length - 1].name
						);
						seen[file] = e;
						break;
					} else {
						result.push(file);
						break;
					}
				}
			}
		}
	}
	return result;
};

function translateImportPaths (contents, base, file, entry, bundle) {
	return contents.replace(/(\@import\s+(['"])(?!https?)([a-zA-Z0-9\ \/\-\.\@\{\}]+)\2)/g,
		function (match, full, wrap, src) {
			var ret;
			if (!utils.isAbsolute(src)) {
				ret = '@import \'' + (
						// we simply convert the relative path to the actual path
						slash(path.join(base, src))
					) + '\'';
				if (log.debug()) log.debug({file: file, module: entry.relName, bundle: bundle.name}, 'translating import from %s to %s', full, ret);
				return ret;
			} else return full;
		}
	);
}

function translateUrlPaths (contents, base, file, entry, bundle, opts) {
	var actual, ret;
	return contents.replace(/url\((?!(['"])?((http|data)\S+))(['"]?)(\S+?)\4\)/g, function (match, n0, n1, n2, n3, sub) {
		if (!utils.isAbsolute(sub)) {
			actual = outfileSource(path.join(base, sub), entry, opts);
			ret = 'url(\'' + actual + '\')';
			if (log.debug()) log.debug(
				{module: entry.relName, file: file, bundle: bundle.name},
				'translating url from %s to %s',
				match,
				ret
			);
			return ret;
		}
		return match;
	});
}