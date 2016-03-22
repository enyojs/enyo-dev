'use strict';

var
	path = require('path'),
	url = require('url');

var
	slash = require('slash');

var
	utils = require('../../utils'),
	logger = require('../../logger').default,
	logBase,
	didSet,
	assetMap = {};

function getLog (opts) {
	if (!didSet) {
		logBase = logger(opts).child({component: 'outfile-source'});
		logBase.level(opts.logLevel || 'warn');
		didSet  = true;
	}
	return logBase;
}

module.exports = function (file, entry, opts, isOutfile) {
	var resolvedFile = path.resolve(file);
	if(assetMap[resolvedFile]) {
		return slash(path.relative(opts.outDir, assetMap[resolvedFile]));
	}
	
	var log = getLog(opts);
	
	var libMode, ret, libp;
	libMode = opts.library;
	
	if (entry.lib) {
		if (!utils.isAbsolute(file)) {
			file = path.resolve(opts.cwd, file);
		}
		if (!isOutfile && libMode && (libp = utils.assetRootFor(entry.libName, opts))) {
			ret = url.resolve(libp, path.join(entry.libName, file.slice(entry.lib.length)));
		} else ret = path.join(entry.libName, file.slice(entry.lib.length));
	} else {
		if (utils.isAbsolute(file)) {
			ret = path.relative(opts.package, file);
		} else ret = file;
		ret = slash(ret).replace(/^(\.\.\/)+/, '');
	}
	
	if (log.debug()) log.debug({module: entry.relName},
		'outfile from %s to %s', path.relative(opts.cwd, file), ret
	);
	ret = slash(ret);
	assetMap[resolvedFile] = path.join(opts.outDir, ret);
	return ret;
};