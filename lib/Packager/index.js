'use strict';

var
	path = require('path'),
	util = require('util'),
	fs = require('fs');

var
	EventEmitter = require('events').EventEmitter;

var
	browserify = require('browserify'),
	browserifyInc = require('browserify-incremental'),
	gulp = require('gulp'),
	buffer = require('vinyl-buffer'),
	source = require('vinyl-source-stream'),
	maps = require('gulp-sourcemaps'),
	parse5 = require('parse5'),
	through = require('through2'),
	glob = require('glob'),
	less = require('less'),
	collapser = require('bundle-collapser/plugin'),
	fse = require('fs-extra');

var
	rewriter = require('./rewriter'),
	utils = require('../utils'),
	logger = require('../logger'),
	defaults = require('./defaults'),
	uglifier = require('./uglifier'),
	sorter = require('./sorter'),
	styler = require('./styler');

var
	Parser = parse5.Parser,
	Serializer = parse5.Serializer,
	File = require('vinyl'),
	CleanCss = require('clean-css');

var
	validJsonKeys = Object.keys(defaults);

validJsonKeys.push('main');
validJsonKeys.push('style');
validJsonKeys.push('assets');
validJsonKeys.push('title');

module.exports = Packager;


/**
* Unify the flow of packaging the application source alongside its dependencies. Various tools
* are required to manage these dependencies and this tool facilities their interactions.
*/
function Packager (opts) {
	if (!this instanceof Packager) return new Packager(opts);
	
	// @todo clean, complete sanity checks
	this.package = path.resolve(opts.package);
	delete opts.package;
	
	logger.setLogLevel(opts.logLevel);
	logger.log('info', 'beginning execution of package "%s"', this.package);
	
	// we process the package json first so that if any options were explicitly set they will
	// override the json defined values
	this.processPackageJson();
	// runtime options have the priority over defaults (if added to the prototype) or even
	// package.json specified
	Object.keys(opts).forEach(function (key) {
		if (validJsonKeys.indexOf(key) > -1) {
			if (this[key] != null) {
				// if it is already set by the json options lets make sure the value being passed
				// in isn't the default value unintentionally overwriting our set value
				
				// if there isn't a default value or the new value is not the default value
				if (defaults[key].default == null || (defaults[key].default !== opts[key])) {
					this[key] = opts[key];
				}
			} else this[key] = opts[key];
		}
	}, this);
	
	// ordered array of libs as they are encountered whether explicitly or implicitly
	this.includeLibs = this.includeLibs || [];
}

util.inherits(Packager, EventEmitter);

Packager.prototype.run = function () {
	// ordered array of packages as they were encountered for expos facto processing
	this.packages = {order: []};

	this.knownLibs = [];
	if (this.includeLibs) this.includeLibs.forEach(function (lib) { this.addLib(lib); }, this);
	this.processLibraryPath();

	// prepare the output template
	this.processTemplate();
	
	if (this.devMode) this.development();
	else this.production();

	return this;
};

/**
* Prepares the AST of the given (or default) index HTML template. If no index was provided it falls-
* back to using the provided one (bare). This is used to rebuild the output source later with all
* of the other features having been fully resolved.
*/
Packager.prototype.processTemplate = function () {
	var
		tpl = this.templateIndex,
		content;
	
	if (tpl) {
		
		logger.log('debug', 'using the provided template index file "%s"', tpl);
		
		try {
			content = fs.readFileSync(path.resolve(tpl), 'utf8');
		} catch (e) {
			throw 'Error: Could not find requested template index file "' + tpl + '"';
		}
	} else {
		
		logger.log('debug', 'no template index file was provided, using the default');
		
		content = fs.readFileSync(path.resolve(__dirname, './template-index.html'), 'utf8');
	}
	
	this.ast = new Parser().parse(content);
	
	// if there is a title request we will go ahead and set that now
	if (this.title) {
		logger.log('debug', 'setting the #document title to "%s"', this.title);
		utils.setDocumentTitle(this.ast, this.title);
	}
};

/**
* Prepares the package's _package.json_ file so certain properties can be explored for configuration
* options at runtime. This also maps the package's `main` property to be a local property of the
* Packager instance.
*/
Packager.prototype.processPackageJson = function () {
	var json;
	
	try {
		// we store a reference to the original values for debugging purposes mostly
		json = this.packageJson = require(path.join(this.package, './package.json'));
	} catch (e) {
		throw 'Error: Could not find a package.json file in the package "' + this.package + '"';
	}
	
	if (!json.main) {
		
		logger.log('debug', 'no "main" in package.json, using default "index.js" as entry point');
		
		json.main = path.resolve(this.package, 'index.js');
	}
	else {
		logger.log('debug', 'using provided "main" value "%s" as entry point', json.main);
		
		json.main = path.resolve(this.package, json.main);
	}
	
	Object.keys(json).forEach(function (key) {
		if (validJsonKeys.indexOf(key) > -1) {
			
			// if the outdir (or others) was set by the packageJson we need to ensure that it is
			// relative to the package.json - otherwise everything is fine
			
			switch (key) {
				case 'outdir':
				case 'libPath':
					this[key] = path.relative(process.cwd(), path.join(this.package, json[key])) || '.';
					logger.log('debug', '%s => %s, %s', key, json[key], this[key]);
					break;
				default:
					this[key] = json[key];
					break;
			}
		}
	}, this);
};

/**
* We need to do a quick scan of the available libraries to know which ones to magically map when
* enountered by the re-writer. For now this is happening on an exact match basis - if the library
* was found in the provided library directory then encountered in a require statement it will be
* mapped to the correct library.
*/
Packager.prototype.processLibraryPath = function () {
	
	var libPath = path.resolve(process.cwd(), this.libPath);
	
	try {
		var files = fs.readdirSync(libPath);
		
		files.forEach(function (file) {
			var filePath, stat;
			
			filePath = path.join(libPath, file);
			try {
				stat = fs.statSync(filePath);
				if (stat.isDirectory()) this.addLib(file);
			} catch (e) {
				throw 'Error: Could not stat library "' + file + '"';
			}
		}, this);
		
	} catch (e) {
		throw 'Error: Could not read the provided library path "' + this.libPath + '"';
	}
	
};

Packager.prototype.setupBundle = function (bundle) {
	
	
	var
		transform = rewriter(this);

	bundle
		.transform(transform)
		.add(this.main)
		.on('dep', function (row) {
			this.emit('file', row.file)
		}.bind(this));

	return bundle;
};

Packager.prototype.applySorter = function (bundle) {
	var packager = this;
	bundle.plugin(function (bundle) {
		bundle.pipeline.get('sort').push(sorter(packager));
	});

	return bundle;
};

/**
* If the internal `devMode` option is set to `true` it will be used to provide source-maps in the
* final output. It will also _not_ minify the JS/CSS output.
*/
Packager.prototype.development = function () {
	
	logger.log('info', 'beginning development build');
	
	var bundle;

	if (this.incremental) {
		if (!this.bundle) {
			bundle = this.bundle = browserifyInc(browserify({
				debug: true,
				cache: {},
				packageCache: {},
				fullPaths: true,
				cacheFile: this.incremental === true ? null : this.incremental
			}));


			this.setupBundle(bundle).on('time', function (time) {
				logger.log('info', 'Build completed in %d seconds', time/1000);
			});
		} else {
			bundle = this.bundle;
		}
	} else {
		bundle = this.setupBundle(browserify({debug: true}));
	}
	
	// during development to ensure sourcemaps work correctly we force js to be exported to a
	// separate file and do the same with the sourcemaps themselves
	if (!this.outJsFile) this.outJsFile = 'output.js';

	this.applySorter(bundle)
		.bundle()
		.pipe(source(this.outJsFile))
		.pipe(buffer())
		.pipe(maps.init({loadMaps: true}))
		.pipe(maps.write('./'))
		.pipe(this.acceptJsFile());
};

Packager.prototype.production = function () {
	
	logger.log('info', 'beginning production build');
	
	var
		bundle = browserify();
	
	this.applySorter(this.setupBundle(bundle))
		.plugin(collapser)
		.bundle()
		.pipe(source(this.outJsFile || 'output.js'))
		.pipe(buffer())
		.pipe(uglifier())
		.pipe(this.acceptJsFile());
};

/**
* While it will be advised that developers explicitly require their libs, in-order, we still have
* to track them implicitly just in case and so we don't need to make them do the require if they
* don't need it.
*/
Packager.prototype.addLib = function (lib) {
	if (!this.hasLib(lib)) {
		this.knownLibs.push(lib);
		logger.log('debug', 'adding library "%s" as a known library', lib);
	}
};

/**
* Convenience method.
*/
Packager.prototype.hasLib = function (lib) {
	return this.knownLibs.indexOf(lib) >= 0;
};

/**
* Discovery of packages happens during JavaScript analysis but we don't process them until later.
* This is the interface where they are added and stored, in-order, so we can do the style and
* asset processing later.
*/
Packager.prototype.addPackage = function (pkg, unshift) {
	if (this.packages.order.indexOf(pkg.__dirname) === -1) {
		if (!unshift) this.packages.order.push(pkg.__dirname);
		else this.packages.order.unshift(pkg.__dirname);
		this.packages[pkg.__dirname] = pkg;
		this.emit('file', path.join(process.cwd(), pkg.__dirname, './package.json'));
		logger.log('debug', 'added package from "%s"', pkg.__dirname);
	}
};

/**
* Once the file is completed we will have enough information to continue processing packages for
* style and asset management. This function returns the stream that accepts the Browserify output
* file and stores it while it kicks off processing the other paths.
*/
Packager.prototype.acceptJsFile = function () {
	
	var packager = this;
	
	return through.obj(aggregate, end);
	
	function aggregate (file, nil, next) {
		if (path.extname(file.path) == '.map') {
			logger.log('info', 'sourcemap file accepted');
			file.base = packager.outdir;
			file.path = path.join(packager.outdir, packager.outJsFile + '.map');
			packager.sourceMap = file;
		} else if (path.extname(file.path) == '.js') {
			logger.log('info', 'source code analysis and compilation complete');
			if (packager.outJsFile) {
				file.path = path.join(packager.outdir, packager.outJsFile);
				file.base = packager.outdir;
			}
			packager.outputJsFile = file;
		} else {
			throw 'Error: Unknown file passed to JavaScript file handler "' + file.path + '"';
		}
		next();
	}
	
	function end (done) {
		if (packager.outputJsFile) {
			process.nextTick(function () {
				packager.processProjectDependencies();
			});
		} else {
			throw 'Error: No output JavaScript compiled source encountered';
		}
		done();
	}
};

/**
* Once the JavaScript has been completely evaluated and compiled we move on to processing the
* libraries and coalescing their minor-module-packages.
*/
Packager.prototype.processProjectDependencies = function () {
	
	logger.log('info', 'handling project non-JavaScript dependencies');
	this.findPackages();
	this.processPackages();
};

Packager.prototype.findPackages = function () {
	
	var
		sortedDeps = this.sorted,
		packages = this.packages,
		order = packages.order;
	
	logger.log('debug', 'finding packages based on the dependency map');
	
	sortedDeps.forEach(function (dep) {
		
		var
			dir = path.dirname(dep.file),
			pkgPath = path.join(dir, 'package.json'),
			pkg;
		
		if (!packages.hasOwnProperty(pkgPath)) {

			try {
				pkg = require(pkgPath);
				pkg.__dirname = path.relative(process.cwd(), dir);
				this.addPackage(pkg);
			} catch (e) {}
		}
		
	}, this);
	
};

/**
* The final packages will have their order reversed for correctness and explored for supported
* properties (e.g. "style" or "assets"). Then these will be properly collected and then handled
* separately by specific handlers.
*/
Packager.prototype.processPackages = function () {
	
	logger.log('info', 'processing the required packages');
	logger.log('debug', this.packages.order);
	
	var
		// globbed style entries in-order, de-duped
		styles = this.styles = [],
		// globbed asset entries (not order dependent but de-duped)
		assets = this.assets = [];
	
	// for keeping track of the files and de-duping
	styles.files = [];
	assets.files = [];
	
	this.packages.order.forEach(function (nom) {
		var
			pkg = this.packages[nom],
			pkgEntry = {path: pkg.__dirname, package: pkg},
			handleAssets;
		
		if (pkg.styles && Array.isArray(pkg.styles) && pkg.styles.length) {
			pkg.styles.forEach(function (entry) {
				// we have to ensure that the glob is relative to the original package
				entry = path.join(pkg.__dirname, entry);
				if (styles.files.indexOf(entry) === -1) {
					styles.files.push(entry);
					styles.push({glob: entry, package: pkg.__dirname});

					this.emit('file', entry);
				}
			}, this);
		}
		
		handleAssets = function (entries) {
			entries.forEach(function (entry) {
				// same as with the style globs have to be relative to package
				entry =  path.join(pkg.__dirname, entry);
				if (assets.files.indexOf(entry) === -1) {
					assets.files.push(entry);
					assets.push({glob: entry, package: pkg.__dirname});
				}
			});
		};
		
		if (this.devMode && pkg.devAssets && Array.isArray(pkg.devAssets) && pkg.devAssets.length) {
			handleAssets(pkg.devAssets);
		}
		
		if (pkg.assets && Array.isArray(pkg.assets) && pkg.assets.length) {
			handleAssets(pkg.assets);
		}
		
	}, this);
	
	this.processStyle();
};

/**
* Here we concatenate all of the style for the project and produce the final output as a file
* ready to be written (even if later only the content is used). We use a glob library for
* synchronous globbing operations for convenience in this scenario.
*/
Packager.prototype.processStyle = function () {
	
	// now that the pre-processing paths has been completed we can finally continue with the
	// less compilation
	logger.log('info', 'compiling less from style sources');
	
	var
		styles = this.styles,
		opts = {},
		files = [],
		map = {},
		assets = {},
		base;
	
	if (this.outCssFile) {
		base = path.relative(
			path.join(this.outdir, path.dirname(this.outCssFile)),
			path.join(this.outdir, this.outAssetDir)
		);
	}

	// if we don't have a base at this point it is safe to simply use the asset directory
	if (!base) base = this.outAssetDir;
	
	styles.forEach(function (entry) {
		glob.sync(entry.glob).forEach(function (file) {
			files.push(file);
			map[file] = entry;
		});
	});
	
	opts.preprocess = function (src, file) {
		// we have to rewrite imports now before we concat because this is our last chance
		// to know the path from which the content came
		src = utils.translateImportPaths(src, path.dirname(file), file);
		// we have to rewrite urls before we can concat because they have to be resolved
		// relative to the file they were in and the package that file came from
		src = utils.translateUrlPaths(src, base, path.dirname(file), map[file].package, file, assets);
		return src;
	};
	
	opts.plugins = this.lessPlugins;
	
	styler(files, opts)
		.then(function (compiled) {
			// assign this for later evaluation alongside the requested assets for comparative
			// purposes
			this.requiredAssets = assets;
			this.outputCssFile = new File({contents: new Buffer(compiled)});
			this.processAssets();
		}.bind(this), function (err) {
			logger.log('error', new Error('failed to process style with error: ' + err.toString()));
		});
	
	return;
};

/**
* Prepare the output files for any assets that will be copied to the final package state.
*/
Packager.prototype.processAssets = function () {
	
	logger.log('info', 'processing project assets');
	
	var
		entries = this.assets,
		assets = this.assets = [],
		known = Object.keys(this.requiredAssets),
		len = known.length;
	
	if (this.knownAssetsOnly) logger.log('debug', known);
	
	entries.forEach(function (entry) {
		var
			files = glob.sync(entry.glob);
		
		logger.log('debug', entry.package, entry.glob, files);
				
		files.forEach(function (file) {
			var
				asset,
				assetRelPath = path.join(this.outAssetDir, path.relative(entry.package, file)),
				assetPath = path.join(this.outdir, assetRelPath);
			
			if (this.knownAssetsOnly) {
				if (known.indexOf(assetRelPath) === -1) {
					return logger.log('debug', 'skipping %s because it is not a required asset', assetRelPath);
				}
			}
			
			assets.push({from: file, to: assetPath});
			logger.log('debug', 'created asset "%s" from "%s"', assetPath, file);
			
		}, this);
	}, this);
	
	if (assets.length > len) {
		logger.log(
			'warn',
			'only %d% (%d of %d) of the assets being copied to the final package are actually referenced ' +
			'by the compiled CSS',
			((len / assets.length) * 100).toFixed(2),
			len,
			assets.length
		);
	}
	
	this.processIndex();
};

/**
*
*/
Packager.prototype.processIndex = function () {
	
	logger.log('info', 'processing the HTML output');
	
	var
		ast = this.ast,
		head = utils.getDocumentHead(ast),
		index = this.index = new File({path: path.join(this.outdir, this.outfile), base: this.outdir}),
		serializer = new Serializer(),
		minifier = new CleanCss({
			processImport: false,
			rebase: false,
			roundingPrecision: -1,
			keepSpecialComments: 0
		}), node, html;
	
	// @todo This may not be necessary anymore, leave formatting and entries alone, placeholder
	// in case we decide to check for hardcoded script loading of the generated scripts which we
	// automatically add - but this would be ill-advised anyway...
	// utils.scrubDocumentHead(head);
	
	if (!this.devMode) {
		this.outputCssFile.contents = new Buffer(minifier.minify(this.outputCssFile.contents.toString()).styles);
	}
	
	// are we outputting a separate css file or inline it
	if (this.outCssFile) {
		this.outputCssFile.path = path.join(this.outdir, this.outCssFile);
		this.outputCssFile.base = this.outdir;
		logger.log('info', 'exporting CSS file "%s"', this.outputCssFile.path);
		node = utils.createStylesheetNode(head, path.relative(this.outdir, this.outputCssFile.path));
	} else {
		logger.log('info', 'embedding CSS in HTML output');
		node = utils.createStyleNode(head, this.outputCssFile.contents.toString());
	}
	
	// ensure the node is a part of the head's childNodes
	head.childNodes.push(node);
	
	if (this.outJsFile) {
		logger.log('info', 'exporting JavaScript file "%s"', this.outputJsFile.path);
		node = utils.createScriptNode(head, path.relative(this.outdir, this.outputJsFile.path), true);
	} else {
		logger.log('info', 'embedding JavaScript in HTML output');
		node = utils.createScriptNode(head, this.outputJsFile.contents.toString());
	}
	
	// ensure the node is a part of the head's childNodes
	head.childNodes.push(node);
	
	logger.log('info', 'rendering final HTML');
	html = serializer.serialize(ast);
	index.contents = new Buffer(html);
	
	this.completeBuild();
};

/**
*
*/
Packager.prototype.completeBuild = function () {
	
	var
		output = through.obj();
	
	// we pipe the output of our stream to gulps writing utility
	output.pipe(gulp.dest(this.outdir));
	
	logger.log('info', 'writing final HTML index file "%s"', this.index.path);
	output.write(this.index);
	
	if (this.assets && this.assets.length) {
		logger.log('info', 'writing final assets to "%s"', path.join(this.outdir, this.outAssetDir));
		
		this.assets.forEach(function (asset) {
			logger.log('debug', 'writing "%s"', asset.to);
			
			// @todo This is slow there are better ways but for now quick fixing the previous
			// implementation to keep from storing all assets in memory and allow the build to
			// keep going even if individual assets fail to copy
			try {
				fse.copySync(asset.from, asset.to);
			} catch (e) {
				logger.log('error', 'could not copy asset %s from %s\n%s', asset.to, asset.from, e.msg);
			}
		});
	}
	
	if (this.outCssFile) {
		logger.log('info', 'writing final CSS file "%s"', this.outputCssFile.path);
		output.write(this.outputCssFile);
	}
	
	if (this.outJsFile) {
		logger.log('info', 'writing final JavaScript file "%s"', this.outputJsFile.path);
		output.write(this.outputJsFile);
	}
	
	if (this.sourceMap) {
		logger.log('info', 'writing JavaScript source map file "%s"', this.sourceMap.path);
		output.write(this.sourceMap);
	}
	
	logger.log('info', '%s build complete', this.devMode ? 'development' : 'production');
	
	output.on('end', function () { this.emit('done'); }.bind(this));
	output.end();
};