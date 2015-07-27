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
		
		it('should be able to specify the project relative to the current working directory');
		
		it('should generate a .gitignore, .enyoconfig and package.json file');
		
		it('should not generate a .gitignore if --no-gitignore');
		
		it('should not generate a .enyoconfig if --no-config');
		
		it('should not generate a package.json if --no-package');
		
		it('should not update package.json if --no-package and options set');
		
		it('should not update .enyoconfig if --no-config and options set');
		
		it('should update the "name" value of .enyoconfig and package.json if set');
		
		it('should update the "title" value of .enyoconfig if set');
		
		it('should save --libraries, --links and --link-all-libs values if --save set');
		
		it('should have created the default library directory');
		
		it('should have cloned all of the default libraries');
		
		it('should create links for libraries set via "links"');
		
		it('should not overwrite directories for linked libraries if --safe is set');
		
		it('should link all libs if --link-all-libs is set');
		
		it('should not attempt to initialize dependencies if --no-dependencies is set');
		
		it('should do minimal work when --library is set');
		
		it('should automatically make a library linkable when --library is set');
		
		it('should reset the .enyoconfig if the --reset flag is set');
		
	});

});