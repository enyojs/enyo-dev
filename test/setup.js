'use strict';


before('Setting up tests', function () {
	return setupEnv();
});

after('Cleaning up after tests', function () {
	// removes all files and directories we create during tests
	return cleanupEnv();
});