#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom'),
	options = require('../lib/Generator/options'),
	Generator = require('../lib/Generator');

nom
	.script('enyo-gen | egen')
	.options(options);

new Generator(nom.parse());