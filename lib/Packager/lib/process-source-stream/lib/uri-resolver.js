'use strict';

var
	path = require('path');

var
	slash = require('slash');

var
	logger = require('../../../../logger'),
	outfileSource = require('../../outfile-source');

var
	regex = /(['"])\@(\.[^\n\r\t\1]+?)\1/g,
	log = logger.child({component: 'uri-resolver'}),
	levelSet;

module.exports = function (entry, opts) {
	
	if (!levelSet) {
		levelSet = true;
		log.level(logger.level());
	}
	
	var dir = entry.isPackage ? entry.fullpath : path.dirname(entry.fullpath);
	
	entry.contents = entry.contents.replace(regex, function (match, delim, uri) {
		
		var
			file = path.resolve(dir, uri),
			ret = outfileSource(file, entry, opts);
		
		if (log.debug()) log.debug({module: entry.relName}, 'replacing %s with %s', match, ret);
		
		return '\'' + ret + '\'';
		
	});
};