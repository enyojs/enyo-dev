#!/usr/bin/env node

'use strict';

require('babel-register')({
	extensions: ['.es6'],
	only: /enyo-dev\/(?!(node_modules))/
});

var   nom     = require('nomnom')
	, options = require('../lib/enyo/options').default
	, comms   = require('../lib/enyo/commands').default
	, subargs = require('../lib/utils').subargs;

nom
	.script('enyo')
	.options(options);

comms.forEach(function (command) {
	nom
		.command(command.name)
		.options(command.options)
		.help(command.help)
		.callback(command.callback);
});

nom.parse(subargs());