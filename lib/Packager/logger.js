'use strict';

var
	chalk = require('chalk');

var
	enabled = true;

exports = module.exports = function (msg) {
	if (enabled) {
		console.log(
			chalk.blue(msg)
		);
	}
};

exports.setEnabled = function (value) {
	enabled = !! value;
};