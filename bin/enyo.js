#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom'),
	options = require('../lib/enyo/options'),
	commands = require('../lib/enyo/commands'),
	subargs = require('../lib/utils').subargs;

nom
	.script('enyo')
	.options(options);

commands.forEach(function (command) {
	nom
		.command(command.name)
		.options(command.options)
		.help(command.help)
		.callback(command.callback);
});

nom.parse(subargs());