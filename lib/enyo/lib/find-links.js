'use strict';

var
	fs = require('fs-extra'),
	path = require('path'),
	util = require('util');

var
	defined = require('defined'),
	findIndex = require('find-index'),
	inq = require('inquirer');

var
	cli = require('../../cli-logger'),
	setup = require('./setup'),
	symlink = require('./symlink');

module.exports = function (opts) {
	setup(opts, function () {
		
		var
			target = path.resolve(defined(opts.getValue('target'), process.cwd())),
			links = [],
			skip = opts.getValue('skip'),
			dupes;
		
		fs.readdir(target, function (err, paths) {
			
			if (err) throw new Error(util.format(
				'Could not read the target directory %s', target
			));
			
			(function next () {
				
				var
					search = paths.shift(),
					noms;
				
				if (!search) {
					
					if (!links.length) return cli('Unable to find any linkable entries');
					
					if (skip && Array.isArray(skip) && skip.length) {
						links = links.filter(function (link) {
							return skip.indexOf(link.name) === -1;
						});
					}
					
					noms = links.map(function (link) { return link.name; });
					dupes = dupesOf(noms);
					
					if (dupes.length) {
						if (opts.getValue('interactive') === false) {
							return cli(
								'Unable to continue with interactive mode set to off, there were ' +
								'duplicate library names found. Re-run with --interactive to help ' +
								'resolve the conflicts: %s', dupes.join(', ')
							);
						}
					}
				
					processLinks();
					
				} else validate(path.join(target, search), links, opts._linkDir, next);
			})();
			
		});
		
		function processLinks () {
			
			var
				seen = [];
			
			(function next () {
				
				var
					link = links.shift(),
					questions = [];
				
				if (link) {
					if (seen.indexOf(link.name) > -1) return next();
					seen.push(link.name);
					
					if (opts.getValue('interactive') !== false) {
						
						questions.push({
							name: 'link',
							type: 'confirm',
							message: util.format('Use %s as a linkable library?', link.name),
							default: true
						});
						
						if (dupes.length && dupes.indexOf(link.name) > -1) questions.push({
							name: 'entry',
							type: 'list',
							message: 'Which path is the correct path for this duplicate entry?',
							choices: getChoicesForDupe(link),
							when: function (ans) {
								return ans.link;
							}
						});
					
						inq.prompt(questions, function (ans) {
							if (ans.link) {
								if (!isNaN(ans.entry)) {
									// only need to update if the index is in the current set
									if (ans.entry > -1) link.fullpath = links[ans.entry].fullpath;
								}
								
								symlink(link, function (err) {
									if (err) cli('Unable to link %s (%s:%s) -> %s', link.name, link.fullpath, link.destpath, err.toString());
									next();
								});
							} else next();
						});
					} else {
						
						symlink(link, function (err) {
							if (err) cli('Unable to link %s (%s:%s) -> %s', link.name, link.fullpath, link.destpath, err.toString());
							next();
						});
					}
					
					
				}
				
			})();
			
		}
		
		function getChoicesForDupe (target) {
			
			var
				choices = [];
			
			choices.push({
				name: target.fullpath,
				value: -1
			});
			
			links.forEach(function (link, idx) {
				if (link.name == target.name) {
					choices.push({
						name: link.fullpath,
						value: idx
					});
				}
			});
			
			return choices;
		}
		
	});
};

function dupesOf (ary) {
	
	var
		seen = [],
		dupes = [];
	
	for (var i = 0; i < ary.length; ++i) {
		if (seen.indexOf(ary[i]) > -1) {
			dupes.push(ary[i]);
		} else {
			seen.push(ary[i]);
		}
	}
	
	return dupes;
}

function validate (search, links, dir, done) {
	fs.stat(search, function (err, stat) {
		if (stat && stat.isDirectory()) {
			fs.readJson(path.join(search, 'package.json'), function (err, json) {
				if (json && json.name) {
					// verify that it isn't already a linked entry
					fs.lstat(path.join(dir, json.name), function (err, stat) {
						if (err || !stat.isSymbolicLink()) {
							links.push({
								name: json.name,
								fullpath: search,
								destpath: path.join(dir, json.name)
							});
						}
						done();
					});
				} else done();
			});
		} else done();
	});
}