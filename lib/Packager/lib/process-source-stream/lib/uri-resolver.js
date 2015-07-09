'use strict';

var
	path = require('path'),
	util = require('util');

var
	slash = require('slash'),
	findIndex = require('find-index');

var
	parse = require('./parse-path'),
	logger = require('../../../../logger'),
	outfileSource = require('../../outfile-source');

var
	regex = /(['"])\@([.@][^\n\r\t\1]+?)\1/g,
	isDir = /[\\/]$/,
	log = logger.child({component: 'uri-resolver'}),
	levelSet;

module.exports = function (entry, opts, stream) {

	if (!levelSet) {
		levelSet = true;
		log.level(logger.level());
	}
	
	var
		dir = entry.isPackage ? entry.fullpath : path.dirname(entry.fullpath);

	entry.contents = entry.contents.replace(regex, function (match, delim, uri) {
		
		var
			ch = uri.charAt(0),
			file, ret;
		
		// allows us to know that @. is relative path and @@ means library name to help
		// differentiate from valid CSS nested in JavaScript strings
		if (ch == '@') {
			
			uri = uri.slice(1);
			
			var
				parsed = parse(uri),
				lib = parsed.dirs ? parsed.dirs.shift() : null,
				roots = opts.assetRoots,
				libp, idx;
			
			if (!lib) {
				log.debug({module: entry.relName}, 'ignoring %s because we could not find a library in the string', match);
				return match;
			}

			if (roots) {
				if (roots.length) {
					idx = findIndex(roots, function (e) { return e.name == lib; });
					if (idx !== -1) {
						libp = roots[idx].path;
					}
				}
				if (!libp && roots.all) libp = roots.all;
			}
			
			if (!libp) {
				log.debug({module: entry.relName}, 'no special path provided for library %s, using default', lib);
				ret = uri;
			} else {
				// deliberately forcing posix here because this is in the runtime JavaScript
				ret = path.posix.join(libp, uri);
			}
		} else {
			file = path.resolve(dir, uri);
			ret = outfileSource(file, entry, opts);
		}
		
		if (isDir.test(uri)) ret += '/';
		
		if (log.debug()) log.debug({module: entry.relName}, 'replacing %s with %s', match, ret);
		
		return '\'' + ret + '\'';
		
	});
};