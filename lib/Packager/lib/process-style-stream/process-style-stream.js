'use strict';

var
	fs = require('fs'),
	path = require('path'),
	util = require('util');

var
	Transform = require('stream').Transform;

var
	Promise = require('bluebird'),
	CleanCss = require('clean-css');

var
	glob = Promise.promisify(require('glob')),
	isGlob = require('is-glob'),
	slash = require('slash'),
	lessc = require('less');

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	outfileSource = require('../outfile-source');

var
	log = logger.child({component: 'process-style-stream'});

var
	readFile = Promise.promisify(fs.readFile);



function ProcessStyleStream (opts) {
	if (!(this instanceof ProcessStyleStream)) return new ProcessStyleStream(opts);

	Transform.call(this, {objectMode: true});

	opts = opts || {};
	this.options = opts;
	this.bundles = [];
	this.lessOnlyLess = !! opts.lessOnlyLess;

	log.level(opts.logLevel);

	var base;
	if (opts.outCssFile) {
		base = path.relative(opts.outdir, path.join(opts.outdir, path.dirname(opts.outCssFile)));
	}
	if (!base) base = opts.outdir;
	this.basePath = base;
}

util.inherits(ProcessStyleStream, Transform);

module.exports = ProcessStyleStream;

var proto = ProcessStyleStream.prototype;

proto._transform = function (bundle, nil, next) {

	log.info({bundle: bundle.name}, 'storing');

	this.bundles.push(bundle);
	next();
};

proto._flush = function (done) {

	var
		stream = this,
		lessOnlyLess = this.lessOnlyLess;

	log.info('processing all %d bundles', this.bundles.length);

	this.findAllFiles().then(function (files) {
		if (!files.length) {
			log.debug('there were no files to process');
			return;
		}
		if (lessOnlyLess && (!files.lessFiles || !files.lessFiles.length)) {
			log.info('less-only-less is set and there are no less files to compile');
			return;
		}

		var toCompile;

		if (lessOnlyLess) {
			log.info('compiling only the %d less files', file.lessFiles.length);
			toCompile = files.lessFiles;
		} else {
			log.info('compiling all %d style files', files.length);
			toCompile = files;
		}

		return stream.compile(toCompile);
	}).catch(function (e) {
		utils.streamError(stream, 'There was an error processing the style:\n\t\t%s,%s', e);
	}).then(function () {
		return stream.postProcess();
	}).then(function () {
		return stream.finish();
	}).finally(done);
};

proto.finish = Promise.method(function () {
	this.bundles.forEach(function (bundle) { this.push(bundle); }, this);
	this.push(null);
});

proto.findAllFiles = function () {

	var
		stream = this,
		files = this.files = [],
		lessOnlyLess = this.lessOnlyLess,
		bundles = this.resolveBundles();

	log.info('resolving all files');

	return Promise.settle(bundles).then(function (results) {
		results.forEach(function (result) {
			result.value().forEach(function (entry) {
				files.push(entry);
				if (entry.isLess && lessOnlyLess) {
					if (!files.lessFiles) files.lessFiles = [];
					files.lessFiles.push(entry);
				}
			});
		});

		if (log.debug()) log.debug(
			files.map(function (file) { return file.fullpath; })
		);

		return (stream.files = files);
	});
};

proto.resolveBundles = function () {
	return this.bundles.map(function (bundle) {
		bundle.style = '';
		return this.resolveBundle(bundle);
	}, this);
};

proto.resolveBundle = function (bundle) {

	var order, modules, stream, entry, resolving;

	order = bundle.order;
	modules = bundle.modules;
	stream = this;
	resolving = [];

	log.info({bundle: bundle.name}, 'resolving bundle style files');

	for (var i = 0; i < order.length; ++i) {
		entry = modules[order[i]];
		if (entry.isPackage) {
			if (entry.json.styles) {
				if (log.debug()) log.debug({module: entry.relName}, 'module %s is a package and ' +
					'has %d style entries', entry.relName, entry.json.styles.length);
				entry.styles = [];
				entry.json.styles.forEach(function (op) {
					resolving.push(this.resolve(op, entry, bundle));
				}, this);
			}
		}
	}

	return Promise.settle(resolving).then(function (results) {
		var files = [];
		results.forEach(function (result) {
			result.value().forEach(function (file) { files.push(file); });
		});
		return files;
	});
};

proto.resolve = Promise.method(function (globish, entry, bundle) {

	var stream = this, fp;

	if (log.debug()) log.debug({module: entry.relName, bundle: bundle.name}, 'attempting to ' +
			'resolve style entry %s', globish);

	if (isGlob(globish)) {

		if (log.debug()) log.debug({module: entry.relName, bundle: bundle.name}, 'determined that ' +
			' %s is a glob pattern, resolving matches', globish);

		return glob(globish, {cwd: entry.fullpath})
			.then(function (files) {
				var reading = files.map(function (file) {
					fp = path.join(entry.fullpath, file);
					entry.styles.push(fp);
					return stream.resolveContents({
						fullpath: fp,
						entry: entry,
						bundle: bundle
					});
				});
				return Promise.settle(reading).then(function (results) {
					var files = [];
					results.forEach(function (result) {
						files.push(result.value());
					});
					return files;
				});
			})
			.catch(function (e) {
				log.error(e);
				return [];
			});
	} else {

		if (log.debug()) log.debug({module: entry.relName, bundle: bundle.name}, 'determined that ' +
			'%s is a direct file reference, resolving as a file', globish);

		fp = path.join(entry.fullpath, globish);
		entry.styles.push(fp);

		return this.resolveContents({fullpath: fp, entry: entry, bundle: bundle})
			.then(function (file) {
				return [file];
			})
			.catch(function (e) {
				log.error(e);
				return [];
			});
	}

});

proto.resolveContents = function (file) {

	var opts = this.options;

	return readFile(file.fullpath, 'utf8').then(function (contents) {
		if (path.extname(file.fullpath) == '.less') file.isLess = true;
		contents = translateImportPaths(contents, path.dirname(file.fullpath), path.relative(opts.cwd, file.fullpath), file.entry);
		contents = translateUrlPaths(contents, file.fullpath, file.entry, opts);
		file.contents = contents;
		return file;
	});
};

proto.compile = Promise.method(function (files) {
	log.debug('compiling %d files via the less compiler', files.length);

	var src, cfg, opts, stream;

	stream = this;
	opts = this.options;
	src = '';
	cfg = {};

	if (opts.lessPlugins) {
		cfg.plugins = opts.lessPlugins.map(function (entry) {
			log.info('using Less pluging %s', entry.name);
			return new entry.plugin(entry.options || {});
		});
	}

	files.forEach(function (file) {
		file.token = util.format('/*%s*/', file.fullpath);
		src += '\n' + file.token;
		src += file.contents;
		src += file.token + '\n';
	});

	return lessc.render(src, cfg)
		.then(function (compiled) {
			return stream.deconstruct(compiled.css, files);
		})
		.catch(function (e) {
			log.error(e, 'failed to compile less, will continue without compiled style');
		});
});

proto.postProcess = Promise.method(function () {

	log.info('post-processing style');

	var files, opts, minify, minifier, bundles;

	opts = this.options;
	minify = opts.minifyCss || opts.production;
	files = this.files;
	bundles = this.bundles;

	if (minify) {
		minifier = new CleanCss({
			processImport: false,
			rebase: false,
			roundingPrecision: -1,
			keepSpecialComments: 0
		});
	}

	files.forEach(function (file) {
		file.bundle.style += file.contents;
	});

	if (minify) bundles.forEach(function (bundle) {
		if (bundle.style) bundle.style = minifier.minify(bundle.style).styles;
	});
});

proto.deconstruct = Promise.method(function (src, files) {
	files.forEach(function (file) {
		var start, end;
		start = src.indexOf(file.token) + file.token.length + 1;
		end = src.lastIndexOf(file.token);
		file.rawContents = file.contents;
		file.contents = src.slice(start, end);
	});
});

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
