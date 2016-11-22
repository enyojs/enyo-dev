#!/usr/bin/env node

'use strict';

var   osenv    = require('osenv')
	, path     = require('path')
	, fsync;

try {
	fsync = require('../lib/util-extra').fsync
} catch(e) {
	fsync = require('../src/util-extra').fsync
}

var   home     = osenv.home()
	, enyo     = path.join(home, '.enyo')
	, projects = path.join(enyo, 'projects')
	, defaults = path.join(enyo, 'defaults')
	, config   = path.join(enyo, 'config')
	, knowns;

if(fsync.exists(path.join(__dirname, '..', 'lib', 'enyo', 'config.json'))) {
	knowns = fsync.readJson(path.join(__dirname, '..', 'lib', 'enyo', 'config'));
} else {
	knowns = fsync.readJson(path.join(__dirname, '..', 'src', 'enyo', 'config'));
}

// believe the key changes here are that the projects feature has gone
// away so we remove it whether it was old-school "file" type or directory
// because removing it is safe for backward compatibility regardless
var stat
stat = fsync.stat(projects);
if (stat) {
	if      (stat.isFile())         fsync.removeFile(projects);
	else if (stat.isDirectory())    fsync.removeDir(projects);
	// definitely don't know why this would be a link but...
	else if (stat.isSymbolicLink()) fsync.unlink(projects);
}
stat = fsync.stat(defaults);
if (stat) {
	if (stat.isFile()) fsync.removeFile(defaults);
}
stat = fsync.stat(config);
if (stat) {
	if (stat.isFile()) {
		var json = fsync.readJson(config).result;
		if (json) {
			var ch = false;
			Object.keys(json).forEach(function (key) {
				if (!knowns.hasOwnProperty(key)) {
					ch = true;
					delete json[key];
				}
			});
			if (ch) fsync.writeJson(config, json);
		}
	}
}