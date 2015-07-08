#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom');

var
	options = require('../lib/Packager/options'),
	subargs = require('../lib/utils').subargs,
	dev = require('../');

nom
	.script('enyo-pack | epack')
	.options(options);

dev.package(nom.parse(subargs())).run();