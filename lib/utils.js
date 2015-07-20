'use strict';

var
	util = require('util'),
	path = require('path'),
	os = require('os');

var
	findIndex = require('find-index');

var
	win = os.platform() == 'win32';

var exports = module.exports;

exports.streamError = function (stream) {
	var args = Array.prototype.slice.call(arguments).slice(1);
	stream.emit('error', new Error(util.format.apply(util, args)));
};

// this will work on any path
exports.isAbsolute = function (nom) {
	return path.isAbsolute(nom);
};

// this is specifically designed and used to determine relativity with respect to require statements
// that must use the '.' notation - this is not safe to use in any other context
exports.isRelative = function (nom) {
	// return !path.isAbsolute(nom);
	return nom.charAt(0) == '.';
};

// this is specifically designed and use to determine if the module is a relative file or one that
// needs to be searched for amongst the various paths that can be searched - not safe in any other
// context
exports.isExternal = function (nom) {
	if (!exports.isRelative(nom)) {
		// windows full paths will begin with a drive letter
		if (win) return ! /^[a-zA-Z]:\\/.test(nom);
		// posix standards will begin with forward slash
		else return nom.charAt(0) != '/';
	}
	// if it's relative then it isn't a default lib-level path (doesn't rule out that it is,
	// but that would indicate it was relative from another lib-level module)
	return false;
};

/**
* @temporary
*
* Ultimately this is to be removed and the the whole CLI parser re-written with a tool that better
* supports this secondary need. But for now...
*
* This method formats our input so that we can use subarg (https://github.com/substack/subarg)
* since subarg is not compatible with nomnom. In order to allow it to be free-form like subarg does
* and still use nomnom we simply find those arguments and wrap them as strings so nomnom won't fall
* over and we will then parse them with subarg directly. Unfortunately, it requires us to recreate
* and subsequently parse the command line arguments to ensure that the nested groupings are
* correctly matched.
*/
exports.subargs = function (argv) {
	argv = argv || process.argv.slice(2);
	// this is tricky and made even moreso because node has removed any quotes so we look where they
	// should be and replace them
	if (typeof argv != 'string') argv = argv
		.map(function (v) { return v.match(/[^\s]+?\s+[^\s]/g) ? ('"' + v + '"') : v; })
		.map(function (v) { return v.replace(/=((?=[^\s'"]+\s).*$)/g, '="$1"'); })
		.join(' ');
	argv = argv.match(/\[[^\]]+?\]|[^\s\[=]+?=(?:[^\s'"]+|(['"])[^\1]+?\1)|(['"])[^\2]+?\2|[^\s]+/g);
	return argv || [];
};

/**
* Currently does not safely guard against non-git uri's or take into account any of the various non-
* remote git uri's. More to come...like better support for user/password or other token/query uri
* parameters that are valid.
*/
exports.parseGitUri = function (str) {
	var
		matches = /(git|https?)([@:])[\s\/]*([^\/:]+)([:\/])(\S+?(?=\.git))\.git(#\S+)?/g.exec(str),
		ret = {},
		i, parts, cpy;
	
	if (matches && matches.length > 1) {
		cpy = matches.slice(1);
		for (i = 2; i < cpy.length; ++i) {
			if (i === 2) {
				if (cpy[1] == '@') {
					ret.protocol = 'ssh';
					ret.key = '@';
				} else if (cpy[1] == ':') {
					ret.protocol = cpy[0];
					ret.key = ':';
				}
				ret.hostname = cpy[2];
			} else if (i === 4) {
				parts = cpy[4].split('/');
				ret.owner = parts.shift();
				ret.repository = parts.join('/');
			} else if (i === 5) {
				ret.target = typeof cpy[5] == 'string' ? cpy[5].slice(1) : 'master';
			}
		}
		ret.uri = matches[0];
	}
	
	return ret;
};

/**
* Same limited support as above...
*/
exports.buildGitUri = function (parts) {
	var str = '';
	if (parts.protocol == 'ssh') {
		if (parts.key == '@') str += 'git@';
		else str += 'ssh://';
	} else if (parts.protocol == 'git') {
		str += 'git://';
	} else {
		str += parts.protocol + '://';
	}
	str += parts.hostname;
	if (parts.protocol ==  'ssh') {
		str += ':' + parts.owner;
	} else str += '/' + parts.owner;
	str += '/' + parts.repository;
	str += '.git';
	
	return str;
};

exports.assetRootFor = function (lib, opts) {
	
	var roots, idx, ret = null;
	
	roots = opts.assetRoots;
	if (roots) {
		if (roots.length) {
			idx = findIndex(roots, function (root) { return root.name == lib; });
			if (idx > -1) {
				ret = roots[idx].path;
			}
		}
		if (!ret && roots.all) ret = roots.all;
	}
	
	return ret;
};




