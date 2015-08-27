'use strict';

var
	path = require('path'),
	fs = require('fs'),
	util = require('util'),
	os = require('os');

var
	defined = require('defined'),
	merge = require('merge');

var
	parse = require('./parse-path'),
	logger = require('../../../../logger'),
	utils = require('../../../../utils'),
	log = logger.child({component: 'resolver'});

var
	PATHS = {};

var
	levelSet;
	
module.exports = function (entry, opts, libs, done) {
	
	if (!levelSet) {
		levelSet = true;
		log.level(logger.level());
	}
	
	log.debug({module: entry.relName}, 'resolving %s', entry.relName);
	
	var
		x = entry.path,
		y = defined(entry.base, opts.cwd),
		z = utils.isRelative(x) ? path.join(y, x) : x,
		res;
	
	if (utils.isExternal(z)) {
		res = loadExternal(z, entry.relName, opts.paths.slice(), libs);
	} else {
		res = loadFile(z, entry.relName);
		if (!res) {
			res = loadPackage(z, entry.relName);
			// this will return a non-package if it found a directory so to be sure we do this
			if (res && !res.isPackage) res = null;
		}
	}
	
	if (!res) done(new Error('could not locate module ' + entry.relName), entry);
	else {
		merge(entry, res);
		entry.relPath = entry.external ? entry.relName : (path.relative(opts.cwd, entry.fullpath) || entry.fullpath);
		done(null, entry);
	}
};

module.exports.reset = function () {
	PATHS = {};
};

function loadFile (x, module) {
	
	log.debug({module: module}, 'attempting to load file %s', x);
	
	var
		stat, err, ext, contents, res;
	
	if (PATHS[x]) {
		
		log.debug({module: module},
			'using cached entry for module file %s', x
		);
		
		return PATHS[x];
	}
	
	try {
		stat = fs.statSync(x);
	} catch (e) {
		err = e;
	}
	
	if (err || !stat) {
		
		log.debug({module:  module}, 'could not locate module from %s', x);
		
		ext = path.extname(x);
		if (ext != '.js') {
			return loadFile(x + '.js', module);
		}
	}
	
	if (stat && stat.isFile()) {
		
		log.debug({module: module}, 'located module at %s', x);
		
		try {
			contents = fs.readFileSync(x, 'utf8') || '';
		} catch (e) {
			log.error(e, {module: module}, 'failed to read module file %s', x);
			return false;
		}
		
		return (PATHS[x] = {
			fullpath: x,
			contents: contents,
			mtime: stat.mtime.getTime()
		});
	}
	
	return false;
}

function loadDirectory (x, module) {
	
	log.debug({module: module}, 'attempting to load directory %s', x);
	
	var
		stat, err, json, res, pkg;
	
	if (PATHS[x]) {
	
		log.debug({module: module},
			'using cached entry for directory %s', x
		);
		
		return PATHS[x];
	}
	
	try {
		stat = fs.statSync(x);
	} catch (e) {
		err = e;
	}
	
	if (stat && stat.isDirectory()) {
		
		log.debug({module: module}, 'directory found %s', x);
		
		res = {fullpath: x};
		
		log.debug({module: module}, 'attempting to locate a package.json file in %s', x);
		
		pkg = path.join(x, 'package.json');
		
		try {
			stat = fs.statSync(pkg);
		} catch (e) {
			
			log.debug({module: module}, 'path %s is a directory, but not a package', x);
			
			return (PATHS[x] = res);
		}
		
		if (stat && stat.isFile()) {
			
			log.debug({module: module}, 'package directory found %s', x);
			
			res.isPackage = true;
			res.packageFile = pkg;
			res.mtime = {};
			res.mtime[pkg] = stat.mtime.getTime();
			
			try {
				json = fs.readFileSync(pkg, 'utf8');
			} catch (e) {
				
				log.error(e, {module: module, file: pkg}, 'failed to read package file');
				
				// we can't return the result since, although it would keep the system
				// moving it would surely cause an unexpected outcome
				return e;
			}
			
			try {
				json = JSON.parse(json);
			} catch (e) {
				
				log.error(e, {module: module, file: pkg}, 'failed to parse package file');
				
				return e;
			}
			
			res.json = json;
			return (PATHS[x] = res);
		}
	}
	
	return false;
}

function loadPackage (x, module) {

	log.debug({module: module}, 'attempting to load package %s', x);
	
	var
		res, main, mainf;
	
	if (PATHS[x]) {
	
		log.debug({module: module},
			'using cached entry for package %s', x
		);
	
		return PATHS[x];
	}
	
	res = loadDirectory(x, module);

	if (res && !(res instanceof Error) && res.isPackage) {
		mainf = path.join(x, res.json.main || 'index.js');
		main = loadFile(mainf, module);
	
		if (main) {
		
			log.debug({module: module}, 'located package main file at %s', mainf);
		
			res.mtime[mainf] = main.mtime;
			res.main = mainf;
			res.contents = main.contents;
		}
	
		return (PATHS[x] = res);
	}
	
	return false;
}

function loadExternal (x, module, paths, libs) {
	
	log.debug({module: module, paths: paths}, 'attempting to load external via %s', x);
	
	var
		parsed = parse(x),
		dirs = parsed.dirs,
		base = parsed.base,
		ext = parsed.ext,
		dir, search, root, res, lib, i, j, stat, tmp, err, prev, last;
	
	while (paths.length) {
		root = paths.shift();
		
		if (dirs.length) {
			
			log.debug({module: module}, 'stepping through %d directory path%s', dirs.length, dirs.length === 1 ? '' : 's');
			
			search = root;
			
			for (i = 0; i < dirs.length; ++i) {
				dir = dirs[i];
				
				last = search;
				
				if (prev && prev.isPackage && prev.json.moduleDir) {
					search = path.join(search, prev.json.moduleDir, dir);
				} else {
					search = path.join(search, dir);
				}
				
				log.debug({module: module}, 'stepping into %s', search);
				
				res = loadPackage(search, module);
				
				if (!res) {
					
					if (!prev || (prev.isPackage && !prev.json.moduleDir)) {
					
						search = path.join(last, 'src', dir);
						
						log.debug({module: module},
							'unable to find step without moduleDir, attempting default "src": %s',
							search
						);
						
						res = loadPackage(search, module);
					}
				
					if (!res) {
						log.debug({module: module}, 'using path %s failed at step %s in %s', root, dir, search);
				
						search = null;
						lib = null;
						last = null;
						res = null;
						prev = null;
						break;
					}
				}
				
				if (res) {
				
					if (res.isPackage) {
						if (i === 0) {
							lib = search;
						}
					}
					
					prev = res;
				}
			}
			
			if (search) {
				last = search;
				search = path.join(search, base);
				
				res = checkExternal(search, module);
				if (!res) {
					if (prev && prev.isPackage && prev.json.moduleDir) {
						search = path.join(last, prev.json.moduleDir, base);
						res = checkExternal(search, module);
					}
					
					if (!res) {
						search = path.join(last, 'src', base);
						res = checkExternal(search, module);
					}
					
				}
				
			}
		
		} else {
			search = path.join(root, base);
			lib = search;
			res = checkExternal(search, module);
		}
		
		if (res) {
			if (lib) {
				res.lib = lib;
				res.libName = path.basename(lib);
				libs[res.libName] = lib;
				log.debug({module: module},
					'setting lib to %s and libName to %s', lib, res.libName
				);
			
			}
			
			return res;
		}
	}
	
	return false;
}

function checkExternal (x, module) {
	
	var res;
	
	res = loadFile(x);
	if (!res) res = loadPackage(x);
	if (!res) {
		
		log.debug({module: module}, 'unable to locate module at %s', x);
		
	} else if (res && !res.contents) {
		
		log.warn({module: module}, 'located a directory that was not a package at %s', x);
		
		res = null;
	} else {
		log.debug({module: module}, 'located %s at %s', module, res.fullpath);
	}
	
	return res;
}