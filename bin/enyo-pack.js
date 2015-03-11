#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom');

var
	options = require('../lib/packager-options'),
	dev = require('../');

nom
	.script('enyo-pack | epack')
	.options(options);

dev.package(nom.parse());