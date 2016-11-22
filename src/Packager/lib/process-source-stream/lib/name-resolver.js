'use strict';

var
	path = require('path'),
	os = require('os');

var
	defined = require('defined'),
	slash = require('slash');

var
	logger = require('../../../../logger').default,
	utils = require('../../../../utils'),
	baseLog,
	didSet;

var win = os.platform() == 'win32';

function getLog (opts) {
	if (!didSet) {
		baseLog = logger(opts).child({component: 'name-resolver'});
		baseLog.level(opts.logLevel || 'warn');
		didSet = true;
	}
	return baseLog;
}

/**
* It should be noted that the term "external" as used in this context is not what
* it may seem. External denotes a module that is included from an external library
* but can still be found in the paths provided.
*/

module.exports = function (entry, opts, stream) {
	
	var name, ext, isExt, isRel;
	
	var log = getLog(opts);
	
	if (entry.path == '') entry.path = defined(entry.base, opts.cwd);
	
	isExt = utils.isExternal(entry.path);
	isRel = utils.isRelative(entry.path);
	
	if (entry.external || isExt) {
		name = isRel ? path.join(entry.base, entry.path) : entry.path;
		entry.external = true;
	} else {
		if (isRel) name = path.join(defined(entry.base, opts.cwd), entry.path);
		else name = entry.path;
	}

	ext = path.extname(name);
	if (ext) name = name.slice(0, -(ext.length));
	if ((entry.external || opts.library) && entry.lib && !isExt) {
		
		var
			lib = stream._modules[entry.lib] || stream._modules[entry.libName],
			md = lib && (lib.json.moduleDir || 'src');
		
		// easiest case
		if (md) {
			name = path.join(entry.libName, path.relative(path.join(entry.lib, md), name));
		} else {
		
			// compare the differing paths from the lib to the source file and the lib to the entry
			// file and take the shorter of the two as the common module directory to remove
			// from the path to find the external module name
			
			var
				was = name,
				to, base;
			to = path.relative(entry.lib, path.dirname(name));
			base = path.join(entry.lib, to);
			name = path.join(entry.libName, path.relative(base, name));
			
			log.debug('the module %s referenced library %s but it was not ' +
				'available so it was derived as close as possible to be %s', was, entry.lib, name);
		}
	}
	if (opts.library || entry.external || isExt) entry.relName = name;
	else entry.relName = (isRel && path.relative(opts.cwd, name)) || 'index';
	if (win) entry.relName = slash(entry.relName);
	return (entry.name = slash(name));
};