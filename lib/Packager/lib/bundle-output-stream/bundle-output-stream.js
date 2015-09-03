'use strict';

var
	util = require('util'),
	path = require('path');

var
	Promise = require('bluebird'),
	Transform = require('stream').Transform;

var
	logger = require('../../../logger'),
	utils = require('../../../utils'),
	jade = require('jade'),
	uniq = require('array-uniq');

var
	fs = Promise.promisifyAll(require('fs-extra')),
	log = logger.child({component: 'bundle-output-stream'});

module.exports = BundleOutputStream;
	
function BundleOutputStream (opts) {
	if (!(this instanceof BundleOutputStream)) return new BundleOutputStream(opts);
	Transform.call(this, {objectMode: true});
	opts = opts || {};
	this.options = opts;
	this.bundles = [];
	this.files = [];
	this.scripts = [];
	this.stylesheets = [];
	log.level(opts.logLevel);
}

util.inherits(BundleOutputStream, Transform);

var proto = BundleOutputStream.prototype;

proto._transform = function (bundle, nil, next) {
	this.bundles.push(bundle);
	next();
};

proto._flush = function (done) {
	var stream, opts;
	stream = this;
	opts = this.options;
	this.prepareStyles().then(function () {
		return !opts.styleOnly && stream.prepareScripts();
	}).then(function () {
		return !opts.styleOnly && stream.prepareAssets();
	}).then(function () {
		return !opts.styleOnly && stream.prepareArbitraryScripts();
	}).then(function () {
		return !opts.styleOnly && stream.prepareTemplate();
	}).then(function () {
		stream.files.forEach(function (file) { stream.push(file); });
		stream.push(null);
	}).then(done);
};

proto.prepareTemplate = Promise.method(function () {
	var opts, template, stream;
	stream = this;
	opts = this.options;
	if (!opts.library || (opts.library && opts.TEST_LIB_MODE)) {
		template = opts.templateIndex  || path.join(__dirname, 'index.tpl');
		return fs.readFileAsync(template, 'utf8').then(function (contents) {
			return stream.prepareIndex(contents);
		}).catch(function (e) {
			utils.fatal('failed to retrieve the template file %s: %s', template, e.message);
		});
	}
});

proto.prepareIndex = Promise.method(function (contents) {
	var opts, stream, ctx, compile;
	opts = this.options;
	stream = this;
	ctx = {
		title: opts.title,
		scripts: this.scripts,
		stylesheets: this.stylesheets,
		devMode: opts.devMode
	};
	compile = jade.compile(contents, {pretty: true});
	if (log.info()) log.info('rendering HTML');
	contents = compile(ctx);
	ctx = {
		outfile: path.join(opts.outdir, opts.outfile),
		contents: contents
	};
	this.files.push(ctx);
});

proto.prepareStyles = Promise.method(function () {
	var opts, stream, bundles, concat, file;
	opts = this.options;
	stream = this;
	bundles = this.bundles;
	concat = '';
	if (log.info()) log.info('preparing final style output');
	bundles.forEach(function (bundle) {
		if (bundle.style && !bundle.ignore) {
			if (opts.devMode || opts.library || bundle.request) {
				file = {
					href: bundle.name + '.css',
					outfile: path.join(opts.outdir, bundle.name + '.css'),
					contents: bundle.style
				};
				if (!bundle.request) stream.stylesheets.push(file);
				stream.files.push(file);
			} else {
				concat += bundle.style + '\n';
			}
		}
	});
	if (concat && !(opts.devMode || opts.library)) {
		if (opts.inlineCss) {
			this.stylesheets.push({contents: concat});
		} else {
			file = {
				href: opts.outCssFile,
				outfile: path.join(opts.outdir, opts.outCssFile),
				contents: concat
			};
			this.stylesheets.push(file);
			this.files.push(file);
		}
	}
	if (log.debug()) log.debug('producing %d stylesheets', this.stylesheets.length, this.stylesheets.map(function (file) {
		return file.href ? file.outfile : 'inline';
	}));
});

proto.prepareScripts = Promise.method(function () {
	var opts, stream, bundles, concat, file;
	opts = this.options;
	stream = this;
	bundles = this.bundles;
	concat = '';
	if (log.info()) log.info('preparing final JavaScript output');
	bundles.forEach(function (bundle) {
		if (bundle.contents && !bundle.ignore) {
			if (opts.devMode || opts.library || bundle.request) {
				file = {
					src: bundle.name + '.js',
					outfile: path.join(opts.outdir, bundle.name + '.js'),
					contents: bundle.contents
				};
				if (!bundle.request) stream.scripts.push(file);
				stream.files.push(file);
				if (bundle.sourceMap && opts.devMode && opts.sourceMaps) {
					stream.files.push({
						contents: bundle.sourceMap,
						outfile: path.join(opts.outdir, bundle.sourceMapFile)
					});
				}
			} else {
				concat += bundle.contents + '\n';
			}
		}
	});
	if (concat && !(opts.devMode || opts.library)) {
		if (opts.inlineJs) {
			this.scripts.push({contents: concat});
		} else {
			file = {
				src: opts.outJsFile,
				outfile: path.join(opts.outdir, opts.outJsFile),
				contents: concat
			};
			this.scripts.push(file);
			this.files.push(file);
		}
	}
	if (log.debug()) log.debug('producing %d JavaScript source files', this.scripts.length, this.scripts.map(function (file) {
		return file.src ? file.outfile : 'inline';
	}));
});

proto.prepareAssets = Promise.method(function () {
	var opts, bundles, stream;
	stream = this;
	opts = this.options;
	bundles = this.bundles;
	if (log.info()) log.info('preparing final asset files');
	bundles.forEach(function (bundle) {
		if (!bundle.ignore && bundle.assets) {
			bundle.assets.forEach(function (asset) {
				stream.files.push(asset);
			});
		}
	});
});

proto.prepareArbitraryScripts = Promise.method(function () {
	var opts, stream;
	opts = this.options;
	stream = this;
	if (opts.library) return;
	return Promise.resolve(opts.headScripts).then(function (scripts) {
		if (opts.promisePolyfill) {
			scripts = scripts && Array.isArray(scripts) ? scripts : [];
			scripts.unshift(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'promise-polyfill', 'Promise.js'));
		}
		if (scripts && Array.isArray(scripts) && scripts.length) {
			return stream.prependScripts(uniq(scripts));
		}
	}).then(function () {
		return Promise.resolve(opts.tailScripts);
	}).then(function (scripts) {
		if (scripts && Array.isArray(scripts) && scripts.length) {
			return stream.appendScripts(uniq(scripts));
		}
	});
});

proto.prependScripts = function (scripts) {
	var stream = this;
	return this.preprocessArbitraryScripts(scripts).then(function (scripts) {
		if (log.info()) log.info('prepending %d head scripts', scripts.length);
		stream.scripts = scripts.concat(stream.scripts);
		scripts.forEach(function (script) {
			if (script.outfile) stream.files.push(script);
		});
	}).catch(function (e) {
		utils.fatal('failed to add head scripts: %s', e.message);
	});
};

proto.appendScripts = function (scripts) {
	var stream = this;
	return this.preprocessArbitraryScripts(scripts).then(function (scripts) {
		if (log.info()) log.info('appending %d tail scripts', scripts.length);
		stream.scripts = stream.scripts.concat(scripts);
		scripts.forEach(function (script) {
			if (script.outfile) stream.files.push(script);
		});
	}).catch(function (e) {
		utils.fatal('failed to add tail scripts: %s', e.message);
	});
};

proto.preprocessArbitraryScripts = function (scripts) {
	var stream, opts, errored;
	stream = this;
	opts = this.options;
	errored = [];
	return Promise.map(scripts, function (file) {
		return fs.statAsync(file).then(function (stat) {
			if (stat.isFile()) {
				return fs.readFileAsync(file, 'utf8').then(function (contents) {
					var entry = {contents: contents};
					if (opts.devMode || !opts.inlineJs) {
						entry.src = path.basename(file);
						entry.outfile = path.join(opts.outdir, entry.src);
					}
					return entry;
				});
			} else throw new Error(util.format('unable to process %s, not actually a file', file));
		}, function (e) {
			errored.push(file);
		});
	}).call('filter', function (result) {
		return result;
	}).then(function (scripts) {
		if (errored.length) {
			if (opts.strict) throw new Error(util.format('unable to find files: %s', errored.join(', ')));
			log.warn('unable to find files: %s', errored.join(', '));
		}
		return scripts;
	});
};