'use strict';

var
	path = require('path'),
	fs = require('fs'),
	os = require('os');

var
	isExternal = require('./is-external'),
	logger = require('../../../../logger'),
	log = logger.child({component: 'external-resolver'});

var
	PATHS = {},
	levelSet;

module.exports = resolve;

function resolve (x, y, paths, done) {
	
	if (!levelSet) {
		levelSet = true;
		log.level(logger.level());
	}
	
	var base, isExt = isExternal(x);

	if (!isExt) {
		base = x.charAt(0) == '.' ? path.join(y, x) : x;
		
		LOAD_FILE(base, function (err, result) {
			if (err) return done(err, result);
			if (!result) {
				LOAD_PACKAGE(base, function (err, result) {
					if (err) return done(err, result);
					if (!result) {
						return done(new Error('module not found "' + x + '" from "' + y + '"'), result);
					} else {
						return done(null, result);
					}
				});
			} else return done(null, result);
		});
	} else if (paths) {
		
		log.debug({path: x}, '%s is an external path', x);
		
		LOAD_EXTERNAL(x, paths.slice(), function (err, result) {
			if (err) done(err, result);
			else if (!result) done(new Error('module not found "' + x + '" from "' + y + '"'), result);
			else done(null, result);
		});
	} else done();


};



function LOAD_FILE (x, done) {
	
	log.debug({path: x}, 'LOAD_FILE %s', x);
	
	fs.stat(x, function (err, stat) {
		if (err || !stat) {
			if (path.extname(x) != '.js') return LOAD_FILE(x + '.js', done);
			else done();
		} else {
			if (stat.isFile()) {
				fs.readFile(x, 'utf8', function (err, contents) {
					if (err) return done(err);
					done(null, {fullpath: x, contents: contents, mtime: stat.mtime.getTime()});
				});
			} else if (stat.isDirectory()) {
				done();
			} else done(new Error('unable to handle response for path "' + x + '"'));
		}
	});
}

function LOAD_PACKAGE (x, done) {
	
	log.debug({path: x}, 'LOAD_PACKAGE %s', x);
	
	LOAD_DIRECTORY(x, function (err, result) {
		if (err) done(err, result);
		else if (!result) done();
		else {
			var main = path.join(x, result.json.main || 'index.js');
		
			LOAD_FILE(main, function (err, fileResult) {
				if (err) done(err, fileResult);
				else if (!fileResult) done(new Error('unable to find "' + main + '" from "' + x + '"'), result);
				else {
					result.main = fileResult.fullpath;
					result.contents = fileResult.contents;
					result.mtime[result.main] = fileResult.mtime;
					done(null, result);
				}
			});
		}
	});
}


function LOAD_DIRECTORY (x, done) {
	
	log.debug({path: x}, 'LOAD_DIRECTORY %s', x);
	
	var
		packageFile = path.join(x, 'package.json');
	
	fs.stat(packageFile, function (err, stat) {
		if (err) return done();
	
		fs.readFile(packageFile, 'utf8', function (err, json) {
			var ret;
			
			if (err) return done();
		
			try {
				json = JSON.parse(json);
			} catch (e) { return done(e); }
		
			ret = {
				isPackage: true,
				fullpath: x,
				packageFile: packageFile,
				json: json,
				mtime: {}
			};
			
			ret.mtime[packageFile] = stat.mtime.getTime();
			done(null, ret);
		});

	});
}


function LOAD_EXTERNAL (x, paths, done) {
	
	log.debug({path: x, paths: paths}, 'LOAD_EXTERNAL %s', x);
	
	if (!paths || !paths.length) return done(new Error('cannot load external module "' + x + '" without additional paths'));
	
	var
		parts = x.split(path.sep),
		name = parts.shift(),
		base, search, lib;
	
	base = paths.shift();
	search = path.join(base, name);
	
	if (PATHS[search]) {
		// we've seen a request for this module before and have already resolved where it is
		if (!parts.length) return resolve('.', search, null, function (err, result) {
			if (result) result.lib = search;
			if (err) return done(err, result);
			done(null, result);
		});
		else return resolve('.' + path.sep + parts.join(path.sep), PATHS[search], null, function (err, result) {
			if (result) result.lib = search;
			if (err) return done(err, result);
			done(null, result);
		});
	}
	
	if (!parts.length) {
		LOAD_FILE(search, function (err, result) {
			if (!result) {
				LOAD_PACKAGE(search, function (err, result) {
					if (err) done(err, result);
					else if (!result) LOAD_EXTERNAL(x, paths, done);
					else {
						// don't cache this case because it was a request for the root of the
						// external lib and will cause subsequent lookups for internals to fail
						result.lib = search;
						done(null, result);
					}
				});
			} else {
				PATHS[search] = search;
				result.lib = search;
				done(null, result);
			}
		});
	} else {
		LOAD_DIRECTORY(search, function (err, result) {
			if (err) done(err, result);
			else if (!result) LOAD_EXTERNAL(x, paths, done);
			else {
				// we need to store the original in this case and use that to point back to the
				// containing package for lookup later
				lib = search;
				// need it to be a relative path
				x = './' + parts.join('/');
				if (result.json.moduleDir) {
					search = PATHS[search] = path.join(search, result.json.moduleDir);
					resolve(x, search, null, function (err, result) {
						if (result) result.lib = lib;
						if (err) return done(err, result);
						done(null, result);
					});
				} else {
					LOAD_FILE(path.join(search, x), function (err, result) {
						if (err) done(err, result);
						else if (!result) {
							LOAD_PACKAGE(path.join(search, x), function (err, result) {
								if (err) done(err, result);
								else if (!result) {
									// we will automatically check the default location and know
									// that we only need to search for it once since subsequent
									// requests to the module will be fast-tracked
									base = path.join(search, 'lib');
									LOAD_FILE(path.join(base, x), function (err, result) {
										if (err) done(err, result);
										else if (!result) {
											LOAD_PACKAGE(path.join(base, x), function (err, result) {
												if (err) done(err, result);
												// will cause error appropriately
												else if (!result) LOAD_EXTERNAL(x, null, done);
												else {
													PATHS[search] = base;
													result.lib = lib;
													done(null, result);
												}
											});
										} else {
											PATHS[search] = base;
											result.lib = lib;
											done(null, result);
										}
									});
								} else {
									PATHS[search] = search;
									result.lib = lib;
									done(null, result);
								}
							});
						} else {
							PATHS[search] = search;
							result.lib = lib;
							done(null, result);
						}
					});
				}
			}
		});
	}
}












