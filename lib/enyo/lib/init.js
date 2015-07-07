'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util');

var
	defined = require('defined'),
	clone = require('clone'),
	uniq = require('array-uniq');

var
	cli = require('../../cli-logger'),
	config = require('./config').config,
	ilink = require('./link').link,
	ulink = require('./unlink').unlink,
	setup = require('./setup'),
	git = require('./git');

var exports = module.exports = function (opts, done) {
	setup(opts, function (opts) {
		exports.init(opts, done);
	});
};

exports.init = function (opts, done) {
	
	var
		proj = defined(opts.getValue('project'), process.cwd());
	
	// @todo There's really no reason for these methods to be executed sequentially this way...
	fs.ensureDir(proj, function (err) {
		if (err) {
			cli('Could not create/read the project directory: %s', proj);
			if (done) done(false);
			return;
		}
		
		exports.initPackage(proj, opts, function (err) {
			if (err) {
				cli('There was an error writing the package.json file for the project');
			}
			
			exports.initGitIgnore(proj, opts, function (err) {
				if (err) {
					cli('There was an error writing the .gitignore file for the project');
				}
				
				opts.init = true;
				opts.global = false;
				config(opts, function (success) {
					if (!success) cli('There was an issue writing the configuration file');
					
					exports.initLibraries(proj, opts, function (err) {
						if (err) cli('There was an issue setting up the libraries');
					});
				});
			});
		});	
	});
};

exports.initPackage = function (proj, opts, done) {
	
	var
		pkgFile = path.join(proj, 'package.json'),
		pkg;
	
	fs.readJson(pkgFile, function (err, json) {
		pkg = json || {};
		opts.name = pkg.name = defined(opts.getValue('name'), pkg.name, path.basename(proj));
		pkg.libDir = defined(pkg.libDir, opts.getValue('libDir'), 'lib');
		if (pkg.paths && Array.isArray(pkg.paths)) {
			if (opts.getValue('paths')) {
				opts.getValue('paths').forEach(function (p) {
					setup.setValueOnObject(pkg, 'paths', p, 'array');
				});
			}
		} else if (opts.getValue('paths')) pkg.paths = opts.getValue('paths');
		fs.writeJson(pkgFile, pkg, done);
	});
	
};

exports.initGitIgnore = function (proj, opts, done) {
	
	var
		gitFile = path.join(proj, '.gitignore'),
		defaultLines = require('../default-git-ignore.json'),
		lines;
	
	fs.readFile(gitFile, 'utf8', function (err, contents) {
		lines = contents ? contents.split('\n') : [];
		lines = uniq(lines.concat(defaultLines));
		fs.writeFile(gitFile, lines.join('\n') + '\n', {encoding: 'utf8'}, done);
	});
	
};

exports.initLibraries = function (proj, opts, done) {

	var
		libs = opts.getValue('libraries'),
		sources = opts.getValue('sources'),
		ignore = opts.getValue('ignore'),
		linkAllLibs = opts.getValue('linkAllLibs'),
		libDir = path.join(proj, opts.getPackageValue('libDir') || opts.getValue('libDir')),
		links = opts.getValue('link') || [];
	
	fs.ensureDir(libDir, function (err) {
		if (err) throw new Error(util.format(
			'Cannot create the lib directory %s\n\toriginal: %s', libDir, err.toString()
		));
	
		(function next () {
		
			var
				lib = libs.shift(),
				sv;
		
			if (lib) {
				if (!ignore || ignore.indexOf(lib) === -1) {
					if (linkAllLibs || links.indexOf(lib) > -1) {
						sv = clone(opts, false);
						sv.global = false;
						sv.target = lib;
						cli('linking library %s', lib);
						ilink(sv, next);
					} else {
						fs.lstat(path.join(libDir, lib), function (err, stat) {
							if (!err && stat.isSymbolicLink()) {
								if (opts.getValue('replaceLinked') === true) {
									sv = clone(opts, false);
									sv.global = false;
									sv.target = lib;
									ulink(sv, function () {
										git(libDir, lib, opts, next);
									});
								} else {
									cli('skipping already linked %s', lib);
									next();
								}
							} else git(libDir, lib, opts, next);
						});
					}
				} else {
					cli('skipping %s', lib);
					next();
				}
			}
		
		})();
	});

};