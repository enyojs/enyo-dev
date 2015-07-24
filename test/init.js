'use strict';

var init = require('../lib/enyo/lib/init');

describe('enyo init', function () {
	
	context('Clean project', function () {
		
		var opts;
		
		before(function () {
			return resetEnv().then(function () {
				return getOpts({cwd: testEmpty}).then(function (o) {
					opts = o;
					return init(opts);
				});
			});
		});
		
		it('should generate a .gitignore, .enyoconfig and package.json file');
		
		it('should have created the default library directory');
		
		it('should have cloned all of the default libraries');
		
	});

});