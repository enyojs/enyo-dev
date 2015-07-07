'use strict';

var
	path = require('path');

var
	slash = require('slash');

var
	utils = require('../../utils'),
	logger = require('../../logger'),
	log = logger.child({component: 'outfile-source'}),
	levelSet;

module.exports = function (file, entry, opts) {
	
	if (!levelSet) {
		levelSet = true;
		log.level(logger.level());
	}
	
	var ret;
	
	if (entry.lib) {
		if (!utils.isAbsolute(file)) {
			file = path.resolve(opts.cwd, file);
		}
		ret = path.join(entry.libName, file.slice(entry.lib.length));
	} else {
		if (utils.isAbsolute(file)) {
			ret = path.relative(opts.cwd, file);
		} else ret = file;
	}
	
	if (log.debug()) log.debug({module: entry.relName},
		'outfile from %s to %s', path.relative(opts.cwd, file), ret
	);

	return slash(ret);
};