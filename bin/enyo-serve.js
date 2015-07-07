#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom');

var
	options = require('../lib/Server/options'),
	subargs = require('../lib/utils').subargs,
	dev = require('../');

nom
	.script('enyo-serve | eserve')
	.options(options);

dev.serve(nom.parse(subargs()));
