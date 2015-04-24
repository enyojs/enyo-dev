#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom'),
	options = require('../lib/Generator/options'),
	commands = require('../lib/Generator/commands');

nom
	.script('enyo-gen | egen')
	.options(options);

commands.forEach(function (command) {
	nom
		.command(command.name)
		.options(command.options)
		.help(command.help)
		.callback(command.callback);
});

nom.parse();