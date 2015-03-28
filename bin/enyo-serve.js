#!/usr/bin/env node

'use strict';

var
	nom = require('nomnom');

var
	options = require('../lib/Server/options'),
	serve = require('../lib/Server');

nom
	.script('enyo-serve | eserve')
	.options(options);

serve(nom.parse());
