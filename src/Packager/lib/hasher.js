'use strict';

var
	md5 = require('md5');

module.exports = function (key) {
	if (!key) throw 'cannot hash a non-string, 0-length value';
	return md5(key).slice(0, 8);
};