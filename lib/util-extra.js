'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.fsync = exports.spaces = exports.stringify = undefined;
exports.isGitUri = isGitUri;
exports.parseGitUri = parseGitUri;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defineProperty = Object.defineProperty,
    freeze = Object.freeze,
    join = _path2.default.join,
    resolve = _path2.default.resolve;

// this is not a sophisticated way of doing this but we use this later to ensure we don't overwrite
// the project...
var ROOT_DIR = join(__dirname, '..');

/*
Attempts to JSON stringify the given serializable object. Optionally (default) makes
the output pretty. Returns { result, error }.
*/
function stringify(json) {
	var pretty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

	var result = void 0,
	    err = void 0;
	try {
		result = JSON.stringify(json, null, pretty ? 2 : null);
	} catch (e) {
		// log.trace({json, error: e, function: 'stringify'}, 'Failed to stringify JSON object');
		err = e;
	}
	return { result: result, error: err };
}
exports.stringify = stringify;

/*
Helper function for output string formatting but returning a string of spaces.
*/

function spaces() {
	var num = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

	return num > 0 ? ' '.repeat(num) : '';
}
exports.spaces = spaces;

/*
A collection of wrapped, synchronous file IO operations.
*/

var fsync = {};

/*
*/
function readJsonSync(file) {
	var result = void 0,
	    error = void 0;
	try {
		result = JSON.parse(_fs2.default.readFileSync(file, 'utf8'));
	} catch (e) {
		// log.trace({file, error: e, function: 'readJsonSync'}, 'Failed to read JSON file');
		error = e;
	}
	return { result: result, error: error };
}
defineProperty(fsync, 'readJson', { value: readJsonSync, enumerable: true });

/*
*/
function writeJsonSync(file, data) {
	var json = void 0,
	    err = void 0;

	file = resolve(file);

	if (data) {
		if (typeof data == 'string') json = data;else {
			var _stringify = stringify(data);

			json = _stringify.result;
			err = _stringify.error;

			if (err) {
				// log.trace({error: err, json: data, file, function: 'writeJsonSync'}, 'Failed to stringify the payload JSON');
				json = '';
			}
		}
	} else json = '';

	err = writeFileSync(file, json);
	// if (err) log.trace({error: err, file, function: 'writeJsonSync'}, 'Failed to write JSON file');
	return err;
}
defineProperty(fsync, 'writeJson', { value: writeJsonSync, enumerable: true });

/*
*/
function ensureJsonFileSync(file, serial) {
	var exists = existsSync(file),
	    parts = void 0,
	    result = void 0,
	    err = void 0;
	if (!exists) {
		parts = _path2.default.parse(file);
		err = ensureDirSync(parts.dir);
		if (err) return err;

		var _ref = serial ? stringify(serial) : { result: '' };

		result = _ref.result;
		err = _ref.error;

		if (err) return err;
		return writeFileSync(file, result, 'utf8');
	}
}
defineProperty(fsync, 'ensureJsonFile', { value: ensureJsonFileSync, enumerable: true });

/*
*/
function ensureDirSync(dir) {
	var paths = getNormalizedPaths(dir),
	    toAdd = [],
	    pre = '',
	    done = paths.length ? false : true,
	    err = void 0;
	if (_path2.default.isAbsolute(dir)) {
		if (process.platform == 'win32') pre = paths.shift();else pre = _path2.default.sep;
	}
	while (!done) {
		var next = pre + paths.join(_path2.default.sep),
		    stat = void 0,
		    rpath = void 0;
		stat = statSync(next);
		if (stat) {
			if (stat.isFile()) return new Error('Attempt to create directory path that contains a file at ' + next);
			if (stat.isSymbolicLink()) {
				rpath = _fs2.default.realpathSync(next);
				stat = statSync(rpath);
				if (!stat) return new Error('Could not retrieve real path for symbolic link ' + next);
				if (stat.isFile()) return new Error('Symbolic link at ' + next + ' resolves to file at ' + rpath);
			}
			done = stat.isDirectory();
		} else done = false;
		if (!done) toAdd.unshift(paths.pop());
	}
	if (toAdd.length) {
		while (toAdd.length) {
			paths.push(toAdd.shift());
			err = makeDirSync(pre + paths.join(_path2.default.sep));
			if (err) return err;
		}
	}
}
defineProperty(fsync, 'ensureDir', { value: ensureDirSync, enumerable: true });

/*
This operation should be used sparingly because of its slowness and memory consumption.
*/
function copyDirSync(dir, target) {
	var clean = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

	var err = void 0,
	    files = void 0;

	dir = resolve(dir);
	target = resolve(target);

	if (!existsSync(dir)) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Source directory does not exist');
		return new Error('Cannot copy ' + dir + ', directory does not exist');
	}

	// this not by any means a sophisticated or complete sanity check but is mostly to keep accidental
	// development tests from overwriting important files
	if (target == ROOT_DIR || target.indexOf(ROOT_DIR) > -1) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Attempt to overwrite enyo-dev system directory');
		return new Error('Cannot replace or copy to enyo-dev module source location "' + target + '"');
	}

	// for now we don't really care if this errors because it would error if it didn't exist
	if (clean) removeDirSync(target);

	err = ensureDirSync(target);
	if (err) {
		// log.trace({error: err, function: 'copyDirSync', source: dir, target}, 'Failed to ensure target directory');
		return new Error('Failed to ensure target directory from ' + dir + ' to ' + target + ': ' + err.message);
	}

	// we will let all errors in recursive runs be produced and if there is an error at the end
	// will return an error about failing the operation even though some of it might have been ok
	var _readDirSync = readDirSync(dir);

	files = _readDirSync.result;
	for (var i = 0; i < files.length; ++i) {
		var src = join(dir, files[i]),
		    tgt = join(target, files[i]),
		    stat = statSync(src);
		if (stat.isDirectory()) err = copyDirSync(src, tgt);else if (stat.isFile()) err = copyFileSync(src, tgt);else if (stat.isSymbolicLink()) err = copySymbolicLinkSync(src, tgt);else {
			// log.trace({function: 'copyDirSync', source: src, target: tgt}, 'Unable to determine type of node for source');
			err = new Error('Unable to determine node type for source ' + src);
		}
	}

	if (err) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Failed to completely, recursively copy the source directory');
		return new Error('Failed to complete, recursively copy the directory "' + dir + '" to "' + target + '"');
	}
}
defineProperty(fsync, 'copyDir', { value: copyDirSync, enumerable: true });

function copyLinkDirSync(dir, target) {
	var clean = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

	var rp = realpathSync(dir);
	if (!rp) return new Error('Failed to determine the realpath of "' + dir + '"');
	return copyDirSync(rp, target, clean);
}
defineProperty(fsync, 'copyLinkDir', { value: copyLinkDirSync, enumerable: true });

/*
Unlike copyDirSync, this method bails as soon as it encounters an error.
*/
function removeDirSync(dir) {
	var err = void 0;

	dir = resolve(dir);

	// this not by any means a sophisticated or complete sanity check but is mostly to keep accidental
	// development tests from overwriting important files
	if (dir == ROOT_DIR || dir.indexOf(ROOT_DIR) > -1) {
		// log.trace({function: 'removeDirSync', target: dir}, 'Attempt to remove enyo-dev system directory');
		return new Error('Cannot remove enyo-dev module source location "' + dir + '"');
	}

	var _readDirSync2 = readDirSync(dir),
	    files = _readDirSync2.result,
	    error = _readDirSync2.error;

	if (error) {
		// log.trace({error, function: 'removeDirSync', target: dir}, 'Failed to read target directory');
		return new Error('Failed to read the directory "' + dir + '" to be removed');
	}

	for (var i = 0; i < files.length; ++i) {
		var src = join(dir, files[i]),
		    stat = statSync(src);

		if (stat.isDirectory()) {
			err = removeDirSync(src);
		} else if (stat.isFile()) {
			err = unlinkSync(src);
		} else if (stat.isSymbolicLink()) {
			err = removeFileSync(src);
		}

		if (err) {
			// log.trace({error: err, function: 'removeDirSync', target: dir, source: src}, 'Failed to completely remove directory');
			return new Error('Failed to remove directory "' + dir + '"');
		}
	}

	// now remove the actual directory
	err = _removeDir(dir);
	if (err) return new Error('Failed to remove directory "' + dir + '"');
}
defineProperty(fsync, 'removeDir', { value: removeDirSync, enumerable: true });

function _removeDir(dir) {
	try {
		_fs2.default.rmdirSync(dir);
	} catch (e) {
		return e;
	}
}

/*
Helper function, not exported.
*/
function copySymbolicLinkSync(source, target) {
	var real = void 0;
	try {
		real = _fs2.default.realpathSync(source);
	} catch (e) {
		// log.trace({error: e, function: 'copySymbolicLinkSync', source, target}, 'Failed to create symbolic link from original location');
		return e;
	}

	return linkSync(real, target);
}

/*
This is a memory intensive operation because we must read the entire file into memory before
writing the file synchronously. Should be used sparingly.
*/
function copyFileSync(file, target) {
	var err = void 0,
	    stat = void 0;

	file = _path2.default.resolve(file);
	target = _path2.default.resolve(target);

	if (!existsSync(file)) {
		// log.trace({function: 'copyFileSync', source: file, target}, 'Source file does not exist');
		return new Error('Source file "' + file + '" does not exist');
	}

	stat = statSync(target);
	if (stat) {
		if (stat.isFile()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target file already exists');
			return new Error('Failed to copy "' + file + '" to "' + target + '", file already exists');
		} else if (stat.isDirectory()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target already exists as a directory');
			return new Error('Failed to copy "' + file + '" to "' + target + '", target already exists as a directory');
		} else if (stat.isSymbolicLink()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target already exists as a symbolic link');
			return new Error('Failed to copy "' + file + '" to "' + target + '", target already exists as a symbolic link');
		}
	}

	// reading into agnostic buffer and writing out the same so we don't need to worry about binary and encoding

	var _readFileSync = readFileSync(file),
	    result = _readFileSync.result,
	    error = _readFileSync.error;

	if (error) {
		// log.trace({error, function: 'copyFileSync', source: file, target}, 'Failed to read the source file');
		return new Error('Failed to read source file "' + file + '"');
	}

	err = writeFileSync(target, result);
	if (err) {
		// log.trace({error: err, function: 'copyFileSync', source: file, target}, 'Failed to write the target file');
		return new Error('Failed to write target file "' + target + '"');
	}
}
defineProperty(fsync, 'copyFile', { value: copyFileSync, enumerable: true });

function realpathSync(file) {
	try {
		return _fs2.default.realpathSync(file);
	} catch (e) {
		return e;
	}
}
defineProperty(fsync, 'realpath', { value: realpathSync, enumerable: true });

/*
*/
function readFileSync(file, enc) {
	var result = void 0,
	    error = void 0;
	try {
		result = _fs2.default.readFileSync(file, enc);
	} catch (e) {
		// log.trace({error: e, function: 'readFileSync', source: file, enc}, 'Failed to read file');
		error = e;
	}
	return { result: result, error: error };
}
defineProperty(fsync, 'readFile', { value: readFileSync, enumerable: true });

/*
*/
function makeDirSync(dir, mode) {
	try {
		_fs2.default.mkdirSync(dir, mode);
	} catch (e) {
		// log.trace({error: e, function: 'makeDirSync', target: dir, mode}, 'Failed to make directory');
		return e;
	}
}
defineProperty(fsync, 'makeDir', { value: makeDirSync, enumerable: true });
defineProperty(fsync, 'mkdir', { value: makeDirSync, enumerable: true });

/*
*/
function existsSync(dir) {
	var result = void 0;
	try {
		result = _fs2.default.lstatSync(dir);
	} catch (e) {}
	return result ? result.isDirectory() || result.isFile() || result.isSymbolicLink() : false;
}
defineProperty(fsync, 'exists', { value: existsSync, enumerable: true });

/*
*/
function statSync(file) {
	var result = void 0;
	try {
		result = _fs2.default.lstatSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'statSync', target: file}, 'Failed to stat file');
	}
	return result;
}
defineProperty(fsync, 'stat', { value: statSync, enumerable: true });

/*
*/
function writeFileSync(file, data) {
	var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'utf8';

	try {
		_fs2.default.writeFileSync(file, data, opts);
	} catch (e) {
		// log.trace({error: e, function: 'writeFileSync', target: file, data, opts}, 'Failed to write file');
		return e;
	}
}
defineProperty(fsync, 'writeFile', { value: writeFileSync, enumerable: true });

/*
*/
function readDirSync(dir) {
	var result = void 0,
	    error = void 0;
	try {
		result = _fs2.default.readdirSync(dir);
	} catch (e) {
		// log.trace({error: e, function: 'readDirSync', source: dir}, 'Failed to read directory');
		error = e;
	}
	return { result: result || [], error: error };
}
defineProperty(fsync, 'readDir', { value: readDirSync, enumerable: true });
defineProperty(fsync, 'readdir', { value: readDirSync, enumerable: true });

/*
*/
function linkSync(from, to) {
	var err = void 0;
	try {
		_fs2.default.symlinkSync(_path2.default.resolve(from), to, 'junction');
	} catch (e) {
		// log.trace({error: e, function: 'linkSync', source: from, target: to}, 'Failed to create symbolic link');
		err = e;
	}
	return err;
}
defineProperty(fsync, 'link', { value: linkSync, enumerable: true });

/*
*/
function unlinkSync(file) {
	var err = void 0;

	file = resolve(file);

	try {
		_fs2.default.unlinkSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'unlinkSync', target: file}, 'Failed to unlink the symbolic link');
		err = e;
	}
	return err;
}
defineProperty(fsync, 'unlink', { value: unlinkSync, enumerable: true });

/*
*/
function removeFileSync(file) {
	var err = void 0;
	file = resolve(file);
	try {
		_fs2.default.unlinkSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'removeFileSync', target: file}, 'Failed to remove file');
		err = e;
	}
}
defineProperty(fsync, 'removeFile', { value: removeFileSync, enumerable: true });

freeze(fsync);
exports.fsync = fsync;

/*
*/

function getNormalizedPaths(file) {
	var dir = _path2.default.normalize(file),
	    dirs = void 0,
	    drive = void 0;
	if (_path2.default.isAbsolute(dir)) {
		if (process.platform == 'win32') {
			drive = _path2.default.parse(dir).root;
			dir = dir.slice(drive.length);
		} else {
			dir = dir.slice(1);
		}
	}
	dirs = dir.split(_path2.default.sep);
	if (drive) dirs.unshift(drive);
	return dirs;
}

/*
Git-uri parsing utilities.
*/

/*
Simple (very simple) non-exhaustive check to see if a string is most likely a git-uri without
being too, too slow.
*/
function isGitUri(str) {
	if (str && typeof str == 'string') {
		if (/^git\@|\.git/.test(str)) return true;
		// not as particular as it should be...
		if (/^http(:?[^#]+?)(?=\.git)/.test(str)) return true;
		// trying to determine if it is a valid path to a local repository
		if (/\.git/.test(str) && existsSync(str)) return true;
	}
	return false;
}

/*
Attempt to break apart a git-uri. It is assumed to have been tested as a git-uri so we don't
have to run the test again.
*/
function parseGitUri(str) {
	var defaultTarget = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'master';

	var uri = void 0,
	    target = void 0,
	    name = void 0;
	var i = str.indexOf('#');
	if (i > -1) {
		if (i === 0) {
			target = str.slice(1);
			uri = '';
		} else {
			target = str.slice(i + 1);
			uri = str.slice(0, i);
		}
	} else {
		target = defaultTarget;
		uri = str;
	}
	if (uri.length) name = _path2.default.basename(uri);
	if (name) {
		var ext = _path2.default.extname(name);
		if (ext) name = name.slice(0, -ext.length);
	}
	return { uri: uri, target: target, name: name };
}