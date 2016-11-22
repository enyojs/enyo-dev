'use strict';

var
	path = require('path'),
	util = require('util'),
	url = require('url');

var
	slash = require('slash');

var
	parse = require('./parse-path'),
	utils = require('../../../../utils'),
	logger = require('../../../../logger').default,
	outfileSource = require('../../outfile-source');

var
	regex = /(['"])\@([.@][^\n\r\t\1]+?)\1/g,
	isDir = /[\\/]$/,
	baseLog,
	didSet;

function getLog (opts) {
	if (!didSet) {
		baseLog = logger(opts).child({component: 'name-resolver'});
		baseLog.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return baseLog;
}

module.exports = function (entry, opts, stream) {

	var log = getLog(opts);
	
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
				libp;
			
			if (!lib) {
				log.debug({module: entry.relName}, 'ignoring %s because we could not find a library in the string', match);
				return match;
			}
			
			libp = utils.assetRootFor(lib, opts);
			
			if (!libp) {
				log.debug({module: entry.relName}, 'no special path provided for library %s, using default', lib);
				ret = uri;
			} else {
				ret = url.resolve(libp, uri);
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