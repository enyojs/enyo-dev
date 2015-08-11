'use strict';

var
	util = require('util'),
	path = require('path');

var
	Promise = require('bluebird'),
	Writable = require('stream').Writable;

var
	fs = Promise.promisifyAll(require('fs-extra')),
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils');

var
	log = logger.child({component: 'write-files-stream'});

module.exports = WriteFilesStream;

function WriteFilesStream (opts) {
	if (!(this instanceof WriteFilesStream)) return new WriteFilesStream(opts);
	Writable.call(this, {objectMode: true});
	opts = opts || {};
	this.count = 0;
	this.skipped = 0;
	this.options = opts;
	this.cleaned = false;
	this.ensured = false;
	this.relative = function (p) { return path.relative(opts.cwd, p); };
	this.on('finish', function () {
		log.info('done writing %d output files, able to skip %d', this.count, this.skipped);
	}.bind(this));
	log.level(opts.logLevel);
}

util.inherits(WriteFilesStream, Writable);

var proto = WriteFilesStream.prototype;

proto._write = function (file, nil, done) {
	var stream, opts;
	stream = this;
	opts = this.options;
	return Promise.resolve().then(function () {
		if (!stream.ensured) return stream.ensureOutputDirectory();
	}).then(function () {
		if (opts.clean && !stream.cleaned) return stream.cleanOutputDirectory();
	}).then(function () {
		return file.copy ? stream.copy(file) : stream.commit(file);
	}).then(done).catch(function (e) {
		log.error(e);
	});
};

proto.ensureOutputDirectory = function () {
	var opts, stream;
	opts = this.options;
	stream = this;
	log.info('ensuring the output directory %s is available', this.relative(opts.outdir));
	return fs.ensureDirAsync(opts.outdir).then(function () {
		stream.ensured = true;
	}).catch(function (e) {
		utils.streamError(stream, 'could not ensure the output directory %s:\n\t%s', stream.relative(opts.outdir), e.stack);
	});
};

proto.cleanOutputDirectory = function () {
	var opts, stream;
	opts = this.options;
	stream = this;
	log.info('emptying output directory because the --clean option was set');
	return fs.emptyDirAsync(opts.outdir).then(function () {
		stream.cleaned = true;
		return new Promise(function (r) {
			process.nextTick(function () { r(); });
		});
	}).catch(function (e) {
		utils.streamError(stream, 'could not clean the output directory %s:\n\t%s', stream.relative(opts.outdir), e.stack);
	});
};

proto.copy = function (file) {
	var stream = this;
	return Promise.resolve(file.mtime).then(function (mtime) {
		if (mtime == null) return copy(file.source, file.outfile, stream.relative);
		else return fs.statAsync(file.outfile).then(function (stat) {
			if (stat.mtime.getTime() >= mtime) {
				if (log.debug()) log.debug({file: stream.relative(file.outfile)}, 'able to skip %s', stream.relative(file.outfile));
			} else return copy(file.source, file.outfile, stream.relative);
		}, function () {
			return copy(file.source, file.outfile, stream.relative);
		});
	}).then(function (copied) {
		if (copied) stream.count++;
		else stream.skipped++;
	});
};

proto.commit = function (file) {
	var stream;
	stream = this;
	if (log.debug()) log.debug({file: this.relative(file.outfile)}, 'writing file %s', this.relative(file.outfile));
	return fs.ensureDirAsync(path.dirname(file.outfile)).then(function () {
		return fs.writeFileAsync(file.outfile, file.contents).catch(function (e) {
			throw new Error(util.format('failed to write output file %s:\n\t%s', stream.relative(file.outfile), e.stack));;
		}).then(function () {
			stream.count++;
		});
	});
};

function copy (from, to, rel) {
	if (log.debug()) log.debug({file: rel(to)}, 'copying %s to %s', rel(from), rel(to));
	return fs.ensureDirAsync(path.dirname(to)).then(function () {
		return fs.copyAsync(from, to);
	}).then(function () {
		return true;
	});
}