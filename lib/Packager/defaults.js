'use strict';

var
	options = require('./packager-options');

Object.keys(options).forEach(function (key) {
	exports[key] = options[key];
});