'use strict';

var
	path = require('path'),
	fs = require('fs'),
	util = require('util');

var
	EventEmitter = require('events').EventEmitter,
	Promise = require('promise');

var
	clone = require('clone'),
	defined = require('defined'),
	endpointParser = require('bower-endpoint-parser'),
	findIndex = require('find-index'),
	findLastIndex = require('find-index/last'),
	fse = require('fs-extra'),
	unq = require('array-uniq');

var
	logger = require('../logger');





function Generator (opts) {
	if (!(this instanceof Generator)) return new Generator(opts);

	this.options = opts = clone(opts);
	this.package = opts.package = path.resolve(opts.package);

	logger.setLogLevel(opts.logLevel);

	this.initPackageDirectory();
}



module.exports = Generator;


util.inherits(Generator, EventEmitter);



Generator.prototype.initPackageDirectory = function () {

	// @todo Either leverage bower internals (if possible) to adjust the file contents based on
	// existing values or have a better scheme for porting the information
	// ideally this would be capable of setting up the package.json as well...

	logger.log('debug', 'initializing target package directory %s', this.package);

	var
		bowerFile = path.join(this.package, 'bower.json'),
		pkgFile = path.join(this.package, 'package.json');

	validateProjectDirectory(this.package);
	// ensure the bower.json file exists
	fse.ensureFileSync(bowerFile);
	fse.ensureFileSync(pkgFile);

	// now try and read in any available package.json file
	try {
		var pkg = this.pkgInfo = require(pkgFile);
		logger.log('debug', 'package.json existed');
	} catch (e) {
		logger.log('debug', 'package.json did not exist, will create it');
		pkg = this.pkgInfo = {};
	}

	// try and read in the bower.json file
	try {
		var bowerInfo = this.bowerInfo = require(bowerFile);
		logger.log('debug', 'bower.json existed');
	} catch (e) {
		logger.log('debug', 'bower.json did not exist, will create it');
		// nope...
		bowerInfo = this.bowerInfo = {};
	}

	// if the bowerInfo already has a name no need to update
	bowerInfo.name = defined(bowerInfo.name, this.options.name, pkg.name, path.basename(this.package));
	pkg.name = defined(pkg.name, bowerInfo.name);

	// by default we assume projects will want to remain private unless they've explicitly said
	// otherwise...this can be re-visited
	bowerInfo.private = defined(bowerInfo.private, true);

	// have to make sure that the file has json content or bower will complain later
	logger.log('debug', 'writing the bower.json file contents');
	fse.outputJsonSync(bowerFile, bowerInfo);
	logger.log('debug', 'writing the package.json file contents');
	fse.outputJsonSync(pkgFile, pkg);

	validateGitIgnoreFile(this.package);
};


function validateProjectDirectory (dir) {
	try {

		dir = fs.lstatSync(dir);

	} catch (e) {

		logger.log('debug', 'package directory did not exist, creating it');

		// @todo Do we need to set the mode here or is 0777 ok?
		// if either of these fail then we want the error to be uncaught for now
		fs.makedirSync(dir);
		dir = fs.lstatSync(dir);
	}

	if (!dir.isDirectory()) {
		throw new Error(
			'Error: the target package location exists but is not a directory'
		);
	}
}

function validateGitIgnoreFile (dir) {

	var
		ignores = [
			'node_modules',
			'lib',
			'dist'
		];

	var
		gitFile = path.join(dir, '.gitignore'),
		contents, len;

	fse.ensureFileSync(gitFile);

	contents = fs.readFileSync(gitFile, 'utf8');
	contents = contents ? contents.split('\n') : [];
	len = contents.length;

	contents = unq(contents.concat(ignores));
	logger.log('debug', 'writing .gitignore file contents back to file, added %d entries', contents.length - len);
	fs.writeFileSync(gitFile, contents.join('\n'));
}



Generator.prototype.init = function () {

	var
		rcPath = path.join(this.package, '.bowerrc'),
		tpl = require('./bowerrc.json'),
		generator = this,
		rc;

	this.once('done', function () {
		logger.log('info',
			'The initialization is complete. Please note that this generator is in ALPHA state and ' +
			'will support many more features in the future.'
		);

		logger.log('info',
			'Make sure to run `npm init` if you have not already setup a package.json file officially. ' +
			'If one did not already exist, one was created for you.'
		);

		logger.log('info',
			'To udpate any versions of the dependent libraries simply run a command of this form: ' +
			'`egen init --lib={LIBRARY}#{BRANCH OR TAG}` and it will be updated for you.'
		);
	});

	logger.log('info', 'initializing %s', this.package);

	// test to see if a .bowerrc file already exists because we will need to do some updates
	// if so instead of just blindly overwriting it
	try {
		rc = fs.readFileSync(rcPath, 'utf8');
	} catch (e) {}

	if (rc) {
		// alright, one already existed...
		logger.log('debug', 'found existing .bowerrc file in package');
		rc = JSON.parse(rc);
		Object.keys(tpl).forEach(function (key) {
			rc[key] = defined(rc[key], tpl[key]);
		});
	} else {
		// nope get to start fresh
		rc = tpl;
	}

	logger.log('debug', 'writing .bowerrc file to package location');
	fs.writeFile(path.join(this.package, '.bowerrc'), JSON.stringify(rc, null, 2), function (err) {
		if (err) throw err;
		generator.installBowerDeps();
	});
};

Generator.prototype.installBowerDeps = function () {

	logger.log('info', 'installing bower dependencies');

	// @todo
	var deps = [
		{name: 'enyo', source: 'git@github.com:enyojs/enyo.git', target: '2.6.0-dev'},
		{name: 'moonstone', source: 'git@github.com:enyojs/moonstone.git', target: '2.6.0-dev'},
		{name: 'spotlight', source: 'git@github.com:enyojs/spotlight.git', target: '2.6.0-dev'},
		{name: 'enyo-ilib', source: 'git@github.com:enyojs/enyo-ilib.git', target: '2.6.0-dev'},
		{name: 'layout', source: 'git@github.com:enyojs/layout.git', target: '2.6.0-dev'},
		{name: 'enyo-cordova', source: 'git@github.com:enyojs/enyo-cordova.git', target: '2.6.0-dev'},
		{name: 'enyo-webos', source: 'git@github.com:enyojs/enyo-webos.git', target: '2.6.0-dev'},
		{name: 'onyx', source: 'git@github.com:enyojs/onyx.git', target: '2.6.0-dev'},
		{name: 'canvas', source: 'git@github.com:enyojs/canvas.git', target: '2.6.0-dev'},
		{name: 'moonstone-extra', source: 'git@github.com:enyojs/moonstone-extra.git', target: 'master'},
		{name: 'svg', source: 'git@github.com:enyojs/svg.git', target: 'master'}
	];

	var bowerToName = {
		'enyo-moonstone': 'moonstone',
		'enyo-moonstone-extra': 'moonstone-extra',
		'enyo-layout': 'layout',
		'enyo-spotlight': 'spotlight',
		'enyo-canvas': 'canvas',
		'enyo-svg': 'svg',
		'enyo-onyx': 'onyx'
	};

	var nameToBower = {
		'enyo': 'enyo',
		'enyo-webos': 'enyo-webos',
		'enyo-cordova': 'enyo-cordova',
		'enyo-ilib': 'enyo-ilib',
		'moonstone': 'enyo-moonstone',
		'moonstone-extra': 'enyo-moonstone-extra',
		'layout': 'enyo-layout',
		'spotlight': 'enyo-spotlight',
		'canvas': 'enyo-canvas',
		'svg': 'enyo-svg',
		'onyx': 'enyo-onyx'
	};

	var
		linked = this.options.linkAllLibs || this.options.linkLibs,
		useDefaults = this.options.defaults === true,
		libs;

	// @todo Should we worry about devDependencies or other variations?
	if (this.bowerInfo.dependencies) {
		var ldeps = useDefaults && deps.slice();

		libs = Object.keys(this.bowerInfo.dependencies).map(function (nom) {

			if (useDefaults) {
				// if this entry from bower.json is one of our defaults we remove it so we know
				// which ones we need to add at the end
				var idx = findIndex(ldeps, function (comp) { return nom == comp.name; });
				if (idx > -1) ldeps.splice(idx, 1);
			}

			return nom + '=' + this.bowerInfo.dependencies[nom];
		}, this);

		if (useDefaults && ldeps.length) libs = libs.concat(ldeps);
	}

	// if there are cli defined libs they take precedence but rather than parse them all here
	// separately and again later we combine them at the end and will give last-in priority
	// once processed
	if (this.options.libs) {
		if (libs) libs = libs.concat(this.options.libs);
		else libs = this.options.libs;
	}

	if (libs) {
		libs = libs.map(function (lib) {
			if (typeof lib == 'string') {
				var comp = endpointParser.decompose(lib);

				if (!comp.name) comp.name = defined(bowerToName[comp.source], comp.source);

				var idx = findIndex(deps, function (dep) { return dep.name == comp.name; });
				if (idx > -1) {
					comp.source = bowerToName[comp.source] || nameToBower[comp.source] ? deps[idx].source : comp.source;
					comp.target = comp.target == '*' ? deps[idx].target : comp.target;
				}

				logger.log('debug', 'decomposed %s into', lib, comp);

				return comp;
			} else return lib;
		});
	} else libs = deps;

	// unfortunately we have to make sure we only have one entry for any of the given libs
	if (libs !== deps) {
		// @todo
		libs.forEach(function (lib, idx) {
			var ldx = findLastIndex(libs, function (_lib) { return _lib.name == lib.name; });
			if (ldx !== idx) {
				// insert the last one instead
				libs[idx] = libs[ldx];
				// since we know the final index was greater we should be able to safely remove it
				// from the array
				libs.splice(ldx, 1);
			}
		});
	}

	if (linked) {
		if (linked === true) {
			linked = libs;
			libs = null;
		} else {
			linked.forEach(function (nom, idx) {
				var i = findIndex(libs, function (lib) { return lib.name == nom; });
				if (i > -1) {
					linked[idx] = libs[i];
					libs.splice(i, 1);
				}
			});
		}

		linked.forEach(function (lib) {
			lib.source = defined(nameToBower[lib.name], lib.source);
		});
	}

	var
		// fyi, requiring bower earlier means it won't see the .bowerrc we just wrote and at this
		// moment the reset method or others aren't actually getting it to reevaluate the env
		bower = require('bower'),
		generator = this,
		install;

	var installRemotes = function () {

		logger.log('debug', 'installing remote dependencies');

		libs = libs.map(function (lib) {

			var comp = endpointParser.compose(lib);

			logger.log('debug', 'requesting %s', comp);

			return comp;
		});

		bower
			.commands
			.install(libs, {save: generator.options.save, forceLatest: true})
			.on('log', function (msg) {

				logger.log(msg.level != 'warn' ? 'debug' : 'warn', '%s%s => %s',
					msg.data.endpoint ? '(' + msg.data.endpoint.name + ') ' : '',
					msg.id,
					msg.message
				);
			})
			.on('end', function () {
				logger.log('debug', 'installation of remote libraries complete');
				generator.emit('done');
			});
	};

	if (linked && linked.length) {
		logger.log('debug', 'linking from local versions of the libraries');

		install = function () {
			var lib = linked.pop();
			if (lib) {
				logger.log('debug', 'linking %s', lib.name);
				bower
					.commands
					.link(lib.source, lib.name)
					.on('end', install);
			} else {
				logger.log('debug', 'linking complete');
				if (libs && libs.length) installRemotes();
				else generator.emit('done');
			}
		};

		install();
	} else if (libs && libs.length) installRemotes();
};
