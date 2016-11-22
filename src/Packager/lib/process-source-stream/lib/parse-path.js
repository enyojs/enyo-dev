'use strict';

var
	path = require('path');

module.exports = function (str) {
	var
		parts = path.parse(str);
	
	parts.dirs = parts.dir ? parts.dir.slice(
		parts.root.length
	).split(/[\/\\]/) : [];
	return parts;
};