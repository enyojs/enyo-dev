'use strict';

var
	options = require('./options');

Object.keys(options).forEach(function (key) {
	exports[key] = options[key].default;
});