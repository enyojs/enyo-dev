'use strict';

import fs              from 'fs';
import path            from 'path';

let   defineProperty = Object.defineProperty
	, freeze         = Object.freeze
	, join           = path.join
	, resolve        = path.resolve;

// this is not a sophisticated way of doing this but we use this later to ensure we don't overwrite
// the project...
const ROOT_DIR = join(__dirname, '..');
	
/*
Attempts to JSON stringify the given serializable object. Optionally (default) makes
the output pretty. Returns { result, error }.
*/
function stringify (json, pretty = true) {
	let result, err;
	try {
		result = JSON.stringify(json, null, pretty ? 2 : null);
	} catch (e) {
		// log.trace({json, error: e, function: 'stringify'}, 'Failed to stringify JSON object');
		err = e;
	}
	return {result, error: err};
}
export {stringify};

/*
Helper function for output string formatting but returning a string of spaces.
*/
function spaces (num = 0) {
	return num > 0 ? ' '.repeat(num) : '';
}
export {spaces};

/*
A collection of wrapped, synchronous file IO operations.
*/
let fsync = {};

/*
*/
function readJsonSync (file) {
	let result, error;
	try {
		result = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (e) {
		// log.trace({file, error: e, function: 'readJsonSync'}, 'Failed to read JSON file');
		error  = e;
	}
	return {result, error};
}
defineProperty(fsync, 'readJson', {value: readJsonSync, enumerable: true});

/*
*/
function writeJsonSync (file, data) {
	let json, err;

	file = resolve(file);

	if (data) {
		if (typeof data == 'string') json = data;
		else {
			({result: json, error: err} = stringify(data));
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
defineProperty(fsync, 'writeJson', {value: writeJsonSync, enumerable: true});

/*
*/
function ensureJsonFileSync (file, serial) {
	let   exists = existsSync(file)
		, parts
		, result
		, err;
	if (!exists) {
		parts = path.parse(file);
		err   = ensureDirSync(parts.dir);
		if (err) return err;
		({result, error: err} = serial ? stringify(serial) : { result: '' });
		if (err) return err;
		return writeFileSync(file, result, 'utf8');
	}
}
defineProperty(fsync, 'ensureJsonFile', {value: ensureJsonFileSync, enumerable: true});

/*
*/
function ensureDirSync (dir) {
	let   paths = getNormalizedPaths(dir)
		, toAdd = []
		, pre   = ''
		, done  = paths.length ? false : true
		, err;
	if (path.isAbsolute(dir)) {
		if (process.platform == 'win32') pre = paths.shift();
		else pre = path.sep;
	}
	while (!done) {
		let next = pre + paths.join(path.sep), stat, rpath;
		stat = statSync(next);
		if (stat) {
			if (stat.isFile())     return new Error(`Attempt to create directory path that contains a file at ${next}`);
			if (stat.isSymbolicLink()) {
				rpath = fs.realpathSync(next);
				stat  = statSync(rpath);
				if (!stat)         return new Error(`Could not retrieve real path for symbolic link ${next}`);
				if (stat.isFile()) return new Error(`Symbolic link at ${next} resolves to file at ${rpath}`);
			}
			done = stat.isDirectory();
		} else done = false;
		if (!done) toAdd.unshift(paths.pop());
	}
	if (toAdd.length) {
		while (toAdd.length) {
			paths.push(toAdd.shift());
			err = makeDirSync(pre + paths.join(path.sep));
			if (err) return err;
		}
	}
}
defineProperty(fsync, 'ensureDir', {value: ensureDirSync, enumerable: true});

/*
This operation should be used sparingly because of its slowness and memory consumption.
*/
function copyDirSync (dir, target, clean = false) {
	let err, files;

	dir    = resolve(dir);
	target = resolve(target);

	if (!existsSync(dir)) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Source directory does not exist');
		return new Error(`Cannot copy ${dir}, directory does not exist`);
	}

	// this not by any means a sophisticated or complete sanity check but is mostly to keep accidental
	// development tests from overwriting important files
	if (target == ROOT_DIR || target.indexOf(ROOT_DIR) > -1) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Attempt to overwrite enyo-dev system directory');
		return new Error(`Cannot replace or copy to enyo-dev module source location "${target}"`);
	}
	
	// for now we don't really care if this errors because it would error if it didn't exist
	if (clean) removeDirSync(target);
	
	err = ensureDirSync(target);
	if (err) {
		// log.trace({error: err, function: 'copyDirSync', source: dir, target}, 'Failed to ensure target directory');
		return new Error(`Failed to ensure target directory from ${dir} to ${target}: ${err.message}`);
	}

	({result: files} = readDirSync(dir));
	// we will let all errors in recursive runs be produced and if there is an error at the end
	// will return an error about failing the operation even though some of it might have been ok
	for (let i = 0; i < files.length; ++i) {
		let   src  = join(dir, files[i])
			, tgt  = join(target, files[i])
			, stat = statSync(src);
		if      (stat.isDirectory())    err = copyDirSync(src, tgt);
		else if (stat.isFile())         err = copyFileSync(src, tgt);
		else if (stat.isSymbolicLink()) err = copySymbolicLinkSync(src, tgt);
		else {
			// log.trace({function: 'copyDirSync', source: src, target: tgt}, 'Unable to determine type of node for source');
			err = new Error(`Unable to determine node type for source ${src}`);
		}
	}

	if (err) {
		// log.trace({function: 'copyDirSync', source: dir, target}, 'Failed to completely, recursively copy the source directory');
		return new Error(`Failed to complete, recursively copy the directory "${dir}" to "${target}"`);
	}
}
defineProperty(fsync, 'copyDir', {value: copyDirSync, enumerable: true});

function copyLinkDirSync (dir, target, clean = false) {
	let rp = realpathSync(dir);
	if (!rp) return new Error(`Failed to determine the realpath of "${dir}"`);
	return copyDirSync(rp, target, clean);
}
defineProperty(fsync, 'copyLinkDir', {value: copyLinkDirSync, enumerable: true});


/*
Unlike copyDirSync, this method bails as soon as it encounters an error.
*/
function removeDirSync (dir) {
	let err;

	dir = resolve(dir);
	
	// this not by any means a sophisticated or complete sanity check but is mostly to keep accidental
	// development tests from overwriting important files
	if (dir == ROOT_DIR || dir.indexOf(ROOT_DIR) > -1) {
		// log.trace({function: 'removeDirSync', target: dir}, 'Attempt to remove enyo-dev system directory');
		return new Error(`Cannot remove enyo-dev module source location "${dir}"`);
	}

	let {result: files, error} = readDirSync(dir);
	if (error) {
		// log.trace({error, function: 'removeDirSync', target: dir}, 'Failed to read target directory');
		return new Error(`Failed to read the directory "${dir}" to be removed`);
	}

	for (let i = 0; i < files.length; ++i) {
		let   src  = join(dir, files[i])
			, stat = statSync(src);
		
		if (stat.isDirectory()) {
			err = removeDirSync(src);
		} else if (stat.isFile()) {
			err = unlinkSync(src);
		} else if (stat.isSymbolicLink()) {
			err = removeFileSync(src);
		}
		
		if (err) {
			// log.trace({error: err, function: 'removeDirSync', target: dir, source: src}, 'Failed to completely remove directory');
			return new Error(`Failed to remove directory "${dir}"`);
		}
	}

	// now remove the actual directory
	err = _removeDir(dir);
	if (err) return new Error(`Failed to remove directory "${dir}"`);
}
defineProperty(fsync, 'removeDir', {value: removeDirSync, enumerable: true});

function _removeDir (dir) {
	try {
		fs.rmdirSync(dir);
	} catch (e) {
		return e;
	}
}

/*
Helper function, not exported.
*/
function copySymbolicLinkSync (source, target) {
	let real;
	try {
		real = fs.realpathSync(source);
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
function copyFileSync (file, target) {
	let err, stat;

	file   = path.resolve(file);
	target = path.resolve(target);

	if (!existsSync(file)) {
		// log.trace({function: 'copyFileSync', source: file, target}, 'Source file does not exist');
		return new Error(`Source file "${file}" does not exist`);
	}
	
	stat = statSync(target);
	if (stat) {
		if (stat.isFile()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target file already exists');
			return new Error(`Failed to copy "${file}" to "${target}", file already exists`);
		} else if (stat.isDirectory()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target already exists as a directory');
			return new Error(`Failed to copy "${file}" to "${target}", target already exists as a directory`);
		} else if (stat.isSymbolicLink()) {
			// log.trace({function: 'copyFileSync', source: file, target, enc}, 'Target already exists as a symbolic link');
			return new Error(`Failed to copy "${file}" to "${target}", target already exists as a symbolic link`);
		}
	}

	// reading into agnostic buffer and writing out the same so we don't need to worry about binary and encoding
	let {result, error} = readFileSync(file);
	if (error) {
		// log.trace({error, function: 'copyFileSync', source: file, target}, 'Failed to read the source file');
		return new Error(`Failed to read source file "${file}"`);
	}

	err = writeFileSync(target, result);
	if (err) {
		// log.trace({error: err, function: 'copyFileSync', source: file, target}, 'Failed to write the target file');
		return new Error(`Failed to write target file "${target}"`);
	}
}
defineProperty(fsync, 'copyFile', {value: copyFileSync, enumerable: true});

function realpathSync (file) {
	try {
		return fs.realpathSync(file);
	} catch (e) {
		return e;
	}
}
defineProperty(fsync, 'realpath', {value: realpathSync, enumerable: true});

/*
*/
function readFileSync (file, enc) {
	let result, error;
	try {
		result = fs.readFileSync(file, enc);
	} catch (e) {
		// log.trace({error: e, function: 'readFileSync', source: file, enc}, 'Failed to read file');
		error  = e;
	}
	return {result, error};
}
defineProperty(fsync, 'readFile', {value: readFileSync, enumerable: true});

/*
*/
function makeDirSync (dir, mode) {
	try {
		fs.mkdirSync(dir, mode);
	} catch (e) {
		// log.trace({error: e, function: 'makeDirSync', target: dir, mode}, 'Failed to make directory');
		return e;
	}
}
defineProperty(fsync, 'makeDir', {value: makeDirSync, enumerable: true});
defineProperty(fsync, 'mkdir', {value: makeDirSync, enumerable: true});

/*
*/
function existsSync (dir) {
	let result;
	try {
		result = fs.lstatSync(dir);
	} catch (e) {}
	return result ? (result.isDirectory() || result.isFile() || result.isSymbolicLink()) : false;
}
defineProperty(fsync, 'exists', {value: existsSync, enumerable: true});

/*
*/
function statSync (file) {
	let result;
	try {
		result = fs.lstatSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'statSync', target: file}, 'Failed to stat file');
	}
	return result;
}
defineProperty(fsync, 'stat', {value: statSync, enumerable: true});

/*
*/
function writeFileSync (file, data, opts = 'utf8') {
	try {
		fs.writeFileSync(file, data, opts);
	} catch (e) {
		// log.trace({error: e, function: 'writeFileSync', target: file, data, opts}, 'Failed to write file');
		return e;
	}
}
defineProperty(fsync, 'writeFile', {value: writeFileSync, enumerable: true});

/*
*/
function readDirSync (dir) {
	let result, error;
	try {
		result = fs.readdirSync(dir);
	} catch (e) {
		// log.trace({error: e, function: 'readDirSync', source: dir}, 'Failed to read directory');
		error = e;
	}
	return {result: result || [], error};
}
defineProperty(fsync, 'readDir', {value: readDirSync, enumerable: true});
defineProperty(fsync, 'readdir', {value: readDirSync, enumerable: true});

/*
*/
function linkSync (from, to) {
	let err;
	try {
		fs.symlinkSync(path.resolve(from), to, 'junction');
	} catch (e) {
		// log.trace({error: e, function: 'linkSync', source: from, target: to}, 'Failed to create symbolic link');
		err = e;
	}
	return err;
}
defineProperty(fsync, 'link', {value: linkSync, enumerable: true});

/*
*/
function unlinkSync (file) {
	let err;
	
	file = resolve(file);
	
	try {
		fs.unlinkSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'unlinkSync', target: file}, 'Failed to unlink the symbolic link');
		err = e;
	}
	return err;
}
defineProperty(fsync, 'unlink', {value: unlinkSync, enumerable: true});

/*
*/
function removeFileSync (file) {
	let err;
	file = resolve(file);
	try {
		fs.unlinkSync(file);
	} catch (e) {
		// log.trace({error: e, function: 'removeFileSync', target: file}, 'Failed to remove file');
		err = e;
	}
}
defineProperty(fsync, 'removeFile', {value: removeFileSync, enumerable: true});

freeze(fsync);
export {fsync};



/*
*/
function getNormalizedPaths (file) {
	let   dir = path.normalize(file)
		, dirs
		, drive;
	if (path.isAbsolute(dir)) {
		if (process.platform == 'win32') {
			drive = path.parse(dir).root;
			dir   = dir.slice(drive.length);
		} else {
			dir   = dir.slice(1);
		}
	}
	dirs = dir.split(path.sep);
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
export function isGitUri (str) {
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
export function parseGitUri (str, defaultTarget = 'master') {
	let uri, target, name;
	let i = str.indexOf('#');
	if (i > -1) {
		if (i === 0) {
			target = str.slice(1);
			uri    = '';
		} else {
			target = str.slice(i + 1);
			uri    = str.slice(0, i);
		}
	} else {
		target = defaultTarget;
		uri    = str;
	}
	if (uri.length) name = path.basename(uri);
	if (name) {
		let ext = path.extname(name);
		if (ext) name = name.slice(0, -ext.length);
	}
	return {uri, target, name};
}