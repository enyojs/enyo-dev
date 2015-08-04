'use strict';

var
	util = require('util'),
	path = require('path'),
	fs = require('fs');

var
	Transform = require('stream').Transform;

var
	uglify = require('uglify-js'),
	combine = require('combine-source-map'),
	convert = require('convert-source-map'),
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	hasher = require('../hasher'),
	utils = require('../../../utils');

var
	log = logger.child({component: 'pack-bundle-stream'});


var MODULE_START = '[function (module,exports,global,require,request){\n';
var MODULE_METHOD_END = '\n},{';
var MODULE_END = '}]';
// var BUNDLE_START = '!function(e,n){var t={';
// var BUNDLE_ENTRIES = '},r={},o=[';
// var BUNDLE_END = '];if(e=window.require=e||function(o){var i,u,f,s,d,l,a=o;if("string"==typeof(i=t[a])&&(a=i),i=r[a])return i;if(!(i=t[a]))throw"unable to find module "+o;return u=i[0],f=i[1],s={exports:{}},d=function(n){return e(null==f[n]?n:f[n])},l=function(e){return n(null==f[e]?e:f[e])},u(s,s.exports,window,d,l),r[a]=s.exports},n=window.request=n||function(o,i){if(!(this instanceof n))return new n(o,i);var u,f,s,d,l=o,a=[],c=!1,h=!1;if("string"==typeof(u=t[l])&&(l=u),this.then=function(e){return a.push(e),h?d(o):c||s(),this},d=function(n){setTimeout(function(){for(var t=a.shift();t;)t(n&&e(n)),t=a.shift()},0)},s=function(){if(c=!0,u.bundles&&u.bundles.length){var e=u.bundles.shift();return n(e,!0).then(s)}u.source&&(f=document.createElement("script"),f.onload=function(){h=!0,d(!i&&o)},f.onerror=function(){throw"failed to retrieve requested bundle for module "+o+" from "+u.source},f.async=!0,f.src=u.source,document.head.appendChild(f)),u.style&&(f=document.createElement("link"),f.rel="stylesheet",f.href=u.style,document.head.appendChild(f))},u=r[l])return void(h=!0);if("object"!=typeof(u=t[l]))throw"unable to find bundle for module "+o},e.manifest){for(var i in t){var u=e.manifest[i];u&&u instanceof Array||(e.manifest[i]=t[i])}t=e.manifest}else e.manifest=t;for(var f=0;f<o.length;++f)e(o[f])}(window.require,window.request);';

var BUNDLE_START = fs.readFileSync(path.resolve(__dirname, 'parts/bundle_start.js'), 'utf8');
var BUNDLE_ENTRIES = fs.readFileSync(path.resolve(__dirname, 'parts/bundle_entries.js'), 'utf8');
var BUNDLE_END = fs.readFileSync(path.resolve(__dirname, 'parts/bundle_end.js'), 'utf8');

module.exports = PackBundleStream;

function nCount (src) {
	if (!src) return 0;
	var n = src.match(/\n/g);
	return n ? n.length : 0;
}

function PackBundleStream (opts) {
	if (!(this instanceof PackBundleStream)) return new PackBundleStream(opts);
	
	opts = opts || {};
	log.level(opts.logLevel);
	this.options = opts;
	this._bundles = {};
	this._order = [];
	this._ids = {};
	Transform.call(this, {objectMode: true});
}

util.inherits(PackBundleStream, Transform);

PackBundleStream.prototype._transform = function (bundle, nil, next) {
	
	var
		opts = this.options;

	this._bundles[bundle.name] = bundle;
	this._order.push(bundle.name);
	next();
};

PackBundleStream.prototype._flush = function (done) {
	
	var
		opts = this.options,
		bundles = this._bundles,
		order = this._order,
		stream = this;
	
	if (opts.production) {
		
		log.info('handling output JavaScript source in production mode by merging all modules ' +
			'into a single bundle for output');
		
		this._mergeBundles();
		order.forEach(function (nom) {
			stream.push(bundles[nom]);
		});
	} else {
		order.forEach(function (nom) {
			stream.push(stream._wrap(bundles[nom]));
		});
	}

	stream.push(null);
	done();
};

PackBundleStream.prototype._getIdFor = function (nom) {
	return this._ids[nom] || (this._ids[nom] = hasher(nom));
};

PackBundleStream.prototype._getBundleFor = function (req) {
	var
		bundles = this._bundles,
		opts = this.options,
		module, bundle;
	
	for (var nom in bundles) {
		if ((module = bundles[nom].modules[req.name])) {
			bundle = bundles[nom];
			break;
		}
	}
	
	if (!bundle && !opts.library) utils.streamError(this, 'cannot find the bundle for module %s', req.name);
	
	if (bundle) log.info({module: module.relName, bundle: bundle.name}, 'found bundle %s for module %s', bundle.name, module.relName);
	
	return bundle;
};

PackBundleStream.prototype._mergeBundles = function () {
	
	var
		opts = this.options,
		stream = this,
		bundles = this._bundles,
		order = this._order,
		modules = {},
		orderedModules = [],
		masterBundle = bundles[order[order.length - 1]];
	
	order.forEach(function (nom, i) {
		var bundle = bundles[nom];
		
		if (!bundle.ignore) {
		
			for (var mod in bundle.modules) {
				modules[mod] = bundle.modules[mod];
			}
		
			orderedModules = orderedModules.concat(bundle.order);
			// this won't be a permanent change in cases where we're reading from cached content
			// because we only hit this in production mode and never store the cache in production
			// mode so we clear the contents of the other bundles so it won't get included in the
			// final output later
			if (i++ !== order.length) bundle.contents = null;
		}
	});
	
	masterBundle.order = orderedModules;
	masterBundle.modules = modules;
	
	this._wrap(masterBundle);
};

PackBundleStream.prototype._addRequestsEntry = function (requests, bundleName, moduleName) {
	
	var
		stream = this,
		bundles = this._bundles,
		idx = findIndex(requests, function (req) { return req.name == bundleName; }),
		entry = idx === -1 ? {name: bundleName} : requests[idx],
		bundle = bundles[bundleName];
	
	if (moduleName) {
		if (!entry.modules) entry.modules = [moduleName];
		else if (entry.modules.indexOf(moduleName) === -1) entry.modules.push(moduleName);
	}
	
	if (bundle.hard_dependencies) {
		
		log.info({bundle: bundleName}, 'has hard dependencies');
		if (log.debug()) log.debug({bundle: bundleName, hard_dependencies: bundle.hard_dependencies});
		
		entry.bundles = entry.bundles || [];
		bundle.hard_dependencies.forEach(function (dep) {
			if (entry.bundles.indexOf(dep) === -1) {
				
				log.info({bundle: bundleName}, 'adding bundle %s as an implicit runtime dependency', dep);
				entry.bundles.push(dep);
				// we need to ensure that the containing bundle has knowledge of the location for
				// this hard dependency as it will most likely not be present without another
				// module directly requiring it -- note it doesn't know about any specific modules
				// because its a fixed/hard dependency so the entire bundle is loaded already
				stream._addRequestsEntry(requests, dep);
			}
		});
	}
	
	if (idx === -1) requests.push(entry);
};

PackBundleStream.prototype._wrap = function (bundle) {
	
	if (!bundle.ignore) {
	
		var
			opts = this.options,
			stream = this,
			bundles = this._bundles,
			bundleSrc = BUNDLE_START,
			entries = [],
			requests = [],
			devMode = opts.devMode,
			sourceMap,
			ln = 0;
	
		log.info({bundle: bundle.name}, 'wrapping');
	
		if (devMode && opts.sourceMaps) {
			sourceMap = combine.create();
			ln = nCount(BUNDLE_START) + 1;
		}
	
		bundle.order.forEach(function (nom, i) {
			var
				entry = bundle.modules[nom],
				src = MODULE_START + entry.contents + MODULE_METHOD_END,
				id = stream._getIdFor(nom);
		
			log.info({bundle: bundle.name, module: entry.relName}, 'wrapping module %s', entry.relName);
		
			if (devMode && entry.contents && opts.sourceMaps) {
				var rel = path.relative(opts.cwd, entry.fullpath);
				sourceMap.addFile({
					sourceFile: path.relative(opts.cwd, entry.main || entry.fullpath),
					source: entry.contents
				}, {line: ln});
			}
			bundleSrc += ('"' + id + '"' + ':');
			if (entry.dependencies && entry.dependencies.length) {
				var hasMap = false;
				entry.dependencies.forEach(function (req) {
					var
						idx = bundle.order.indexOf(req.name),
						rbundle = stream._getBundleFor(req),
						reqEntry;
				
					rbundle = (rbundle && rbundle.name != bundle.name) ? rbundle : null;
					if (idx > -1 || rbundle) {
						// only hit if it is an internal request
						src += ('"' + req.alias + '":"' + stream._getIdFor(req.name) + '",');
						hasMap = true;
					}
					// if this is a request bundle we need to make sure there is a manifest entry 
					// for it mapping the module to the bundle - once
					if (rbundle && rbundle.request) {
						stream._addRequestsEntry(requests, rbundle.name, req.name);
					}
				});
				// remove the trailing comma if necessary
				if (hasMap) src = src.substring(0, src.length - 1);
			}
			src += MODULE_END;
			if (devMode && opts.sourceMaps) {
				ln += nCount(src);
			}
			bundleSrc += src;
			bundleSrc += (',' + '"' + (entry.relName) + '":"' + id + '"');
			if (entry.entry) entries.push('"' + id + '"');
			if (++i < bundle.order.length) bundleSrc += ',';
		});
	
		// if there are requests we need to add them to the manifest now
		if (requests.length) {
			requests.forEach(function (rbundle) {
				var
					bundle = bundles[rbundle.name],
					id = stream._getIdFor(bundle.name),
					data = {source: bundle.name + '.js'};
				if (bundle.style) data.style = bundle.name + '.css';
				if (rbundle.bundles) {
					data.bundles = rbundle.bundles.map(function (nom) { return stream._getIdFor(nom); });
				}
				bundleSrc += ',';
				bundleSrc += ('"' + id + '":');
				bundleSrc += JSON.stringify(data);
				// map only the actually requested modules by id to the bundle entry for the request
				// note that these entries will actually be overwritten when the bundle is loaded
				// which is why subsequent requests will automatically have the value
				if (rbundle.modules) rbundle.modules.forEach(function (nom) {
					bundleSrc += ',';
					bundleSrc += ('"' + stream._getIdFor(nom) + '":"' + id + '"');
				});
			});
		}
	
		bundleSrc += BUNDLE_ENTRIES;
	
		if (entries.length) {
			bundleSrc += entries.join(',');
		}
	
		bundleSrc += BUNDLE_END;
	
		log.info({bundle: bundle.name}, 'source has been wrapped');
	
		if (opts.production) {
		
			log.info({bundle: bundle.name}, 'running UglifyJS, this may take a while');
		
			try {
				bundleSrc = uglify.minify(bundleSrc, {
					fromString: true,
					mangle: {
						except: ['require', 'request']
					},
					output: {
						space_colon: false,
						beautify: false,
						semicolons: false
					}
				}).code;
			
				log.info({bundle: bundle.name}, 'done uglifying');
			
			} catch (e) {
				utils.streamError(stream,
					'UglifyJS error while parsing "%s"\noriginal: %s', bundle.name, e.toString()
				);
			}
		}
		bundle.contents = bundleSrc;
		if (devMode && opts.sourceMaps) {
			bundle.sourceMap = convert.fromBase64(sourceMap.base64()).toJSON();
			bundle.sourceMapFile = bundle.name + '.js.map';
			bundle.contents += ('\n//# sourceMappingURL=' + bundle.sourceMapFile);
		}
	}
	return bundle;
};