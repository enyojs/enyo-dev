'use strict';

var
	path = require('path'),
	fs = require('fs');

var
	browserify = require('browserify'),
	gulp = require('gulp'),
	buffer = require('vinyl-buffer'),
	source = require('vinyl-source-stream'),
	maps = require('gulp-sourcemaps'),
	parse5 = require('parse5');

var
	rewriter = require('./rewriter'),
	packageSpy = require('./package-spy'),
	logger = require('../logger');

var
	Parser = parse5.Parser;


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
	
	logger.level = opts.logLevel;
	logger.log('info', 'current package location "%s"', this.package);
	
	// we process the package json first so that if any options were explicitly set they will
	// override the json defined values
	this.processPackageJson();
	
	Object.keys(opts).forEach(function (key) { this[key] = opts[key]; }, this);
	
	// ordered array of libs as they are encountered whether explicitly or implicitly
	this.knownLibs = [];
	this.includeLibs = this.includeLibs || [];
	
	if (this.includeLibs) this.includeLibs.forEach(function (lib) { this.addLib(lib); }, this);
	this.processLibraryPath();
	
	// ordered array of packages as they were encountered for expos facto processing
	this.packages = {order: []};
	
	// prepare the output template
	this.processTemplate();
	
	if (this.devMode) this.development();
	else this.production();
}

/**
* Prepares the AST of the given (or default) index HTML template. If no index was provided it falls-
* back to using the provided one (bare). This is used to rebuild the output source later with all
* of the other features having been fully resolved.
*/
Packager.prototype.processTemplate = function () {
	var
		tpl = this.templateIndex;
	
	if (tpl) {
		
		logger.log('info', 'using provided template index file "%s"', tpl);
		
		try {
			this.templateIndex = fs.readFileSync(path.resolve(tpl), 'utf8');
		} catch (e) {
			throw 'Error: Could not find requested template index file "' + tpl + '"';
		}
	} else {
		
		logger.log('info', 'using the default template index file');
		
		this.templateIndex = fs.readFileSync(path.resolve(__dirname, './template-index.html'), 'utf8');
	}
	
	this.ast = new Parser().parse(this.templateIndex);
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
		
		logger.log('info', 'no "main" in package.json, using default "index.js"');
		
		json.main = path.resolve(this.package, 'index.js');
	}
	else {
		logger.log('info', 'using provided "main" "%s"', json.main);
		
		json.main = path.resolve(this.package, json.main);
	}
	
	Object.keys(json).forEach(function (key) { this[key] = json[key]; }, this);
};

/**
* We need to do a quick scan of the available libraries to know which ones to magically map when
* enountered by the re-writer. For now this is happening on an exact match basis - if the library
* was found in the provided library directory then encountered in a require statement it will be
* mapped to the correct library.
*/
Packager.prototype.processLibraryPath = function () {
	
	var libPath = path.resolve(this.package, this.libPath);
	
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

/**
* If the internal `devMode` option is set to `true` it will be used to provide source-maps in the
* final output. It will also _not_ minify the JS/CSS output.
*/
Packager.prototype.development = function () {
	
	logger.log('info', 'beginning development build');
	
	var
		bundle = browserify({debug: true}),
		transform = rewriter(this),
		plugin = packageSpy(this);
	bundle
		.transform(transform)
		.plugin(plugin)
		.add(this.main)
		.bundle()
		.pipe(source(this.outJsFile || 'insert.js'))
		.pipe(buffer())
		.pipe(maps.init({loadMaps: true}))
		.pipe(maps.write())
		.pipe(this.acceptJsFile());
};

Packager.prototype.production = function () {
	logger.log('error', 'production builds not currently available');
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
* During processing of the JavaScript we report the libraries that were actually encountered not
* just ones we found so that we know which ones to include. If the library was already mentioned
* explicitly by a setting then we don't re-order based on the fact we found it, otherwise we do
* to preserve the natural ordering.
*/
Packager.prototype.includeLib = function (lib) {
	if (this.includeLibs.indexOf(lib) === -1) {
		this.includeLibs.push(lib);
		logger.log('debug', 'adding library "%s" as an implicit include', lib);
	}
};

/**
* Discovery of packages happens during JavaScript analysis but we don't process them until later.
* This is the interface where they are added and stored, in-order, so we can do the style and
* asset processing later.
*/
Packager.prototype.addPackage = function (pkg) {
	if (this.packages.order.indexOf(pkg.__dirname) === -1) {
		this.packages.order.push(pkg.__dirname);
		this.packages[pkg.__dirname] = pkg;
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
	
	return through.obj(function (file, nil, next) {
		logger.log('info', 'sourcecode analysis and compilation complete');
		packager.outputJsFile = file;
		packager.processProjectDependencies();
	});
	
};

/**
* Once the JavaScript has been completely evaluated and compiled we move on to processing the
* libraries and coalescing their minor-module-packages.
*/
Packager.prototype.processProjectDependencies = function () {
	
	logger.log('info', 'handling project non-JavaScript dependencies');
	
	// the first thing to do is process the known libraries, determine which ones have packages
	// and order them for the next step of package explosion
	
};