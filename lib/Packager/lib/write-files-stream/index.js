'use strict';

var
	util = require('util'),
	fs = require('fs-extra'),
	path = require('path');

var
	findIndex = require('find-index');

var
	logger = require('../../../logger'),
	utils = require('../../../utils');

var
	log = logger.child({component: 'write-files-stream'});

var
	Writable = require('stream').Writable;

module.exports = WriteFilesStream;

function WriteFilesStream (opts) {
	if (!(this instanceof WriteFilesStream)) return new WriteFilesStream(opts);
	
	var stream = this;
	opts = opts || {};
	this.options = opts;
	log.level(opts.logLevel);
	this._count = 0;
	this._skipped = 0;
	
	Writable.call(this, {objectMode: true});
	
	this.on('finish', function () { log.info('done writing %d output files, able to skip %d', stream._count, stream._skipped); });
}

util.inherits(WriteFilesStream, Writable);

WriteFilesStream.prototype._write = function (file, nil, next) {
	
	var
		stream = this,
		opts = this.options,
		done;
	
	done = function (err) {
		
		if (err) utils.streamError(stream,
			'error processing file %s:\n\t%s', file.outfile, err.toString()
		);
		
		next();
	};
	
	if (!this._ensured) {
		
		log.info('ensuring the output directory %s is available', opts.outdir);
		
		fs.ensureDir(opts.outdir, function (err) {
			
			if (err) utils.streamError(stream,
				'could not verify that the output directory %s was available:\n\t%s', opts.outdir, err.toString()
			);
			
			log.info('done ensuring the directory exists and can be written to');
			
			stream._ensured = true;
			if (opts.clean) {
				
				log.info('emptying output directory because the --clean option was set');
				
				fs.emptyDir(opts.outdir, function (err) {
					
					if (err) utils.streamError(stream,
						'could not empty the output directory %s:\n\t%s', opts.outdir, err.toString()
					);
					
					log.info('done emptying the output directory');
					
					stream._processFile(file, done);
				});
			} else stream._processFile(file, done);
		});
	} else this._processFile(file, done);

};

WriteFilesStream.prototype._processFile = function (file, done) {

	if (file.copy) this._copy(file, done);
	else {
		
		log.debug({file: file.outfile}, 'writing file %s', file.outfile);
		
		this._count++;
		
		fs.writeFile(file.outfile, file.contents, done);
	}

};

WriteFilesStream.prototype._copy = function (file, done) {
	
	var
		stream = this,
		opts = this.options,
		date = this._date || (this._date = new Date()),
		relSource = path.relative(opts.cwd, file.source);
	
	log.debug({file: file.outfile, source: relSource}, 'attempting to copy file %s to %s', relSource, file.outfile);
	
	if (file.mtime) {
		this._checkOutfile(file, function (copy) {
			
			var
				rs, ws;
			
			if (copy) {
				log.debug({file: file.outfile, source: relSource}, 'file %s will be copied', file.outfile);
				
				fs.ensureDir(path.dirname(file.outfile), function (err) {
					
					if (err) utils.streamError(stream,
						'could not create output directory for file %s:\n\t%s', file.outfile, err.toString()
					);
				
					// we need to copy the file then update its mtime to match the one we know
					// about so future checks will determine accurately whether or not it is the
					// same file and doesn't need to be copied again
					rs = fs.createReadStream(file.source);
					ws = fs.createWriteStream(file.outfile);
					
					rs.pipe(ws).on('finish', function () {
						
						log.debug({file: file.outfile, source: relSource}, 'done copying contents of file %s to %s', relSource, file.outfile);
						
						stream._count++;
						
						done();
					});
				});
				
			} else {
				log.debug({file: file.outfile, source: relSource}, 'file %s does not need to be copied', file.outfile);
				stream._skipped++;
				done();
			}
			
		});
	
	} else {
		log.debug({file: file.outfile, source: file.source}, 'no mtime was provided, forced to copy file');
		fs.copy(file.source, file.outfile, function (err) {
			
			if (err) utils.streamError(stream,
				'failed to copy file %s to %s:\n\t%s', relSource, file.outfile, err.toString()
			);
			
			log.debug({file: file.outfile, source: relSource}, 'successfully copied file %s to %s', relSource, file.outfile);
			
			stream._count++;
			
			done();
		});;
	}
	
};

WriteFilesStream.prototype._checkOutfile = function (file, done) {
	fs.stat(file.outfile, function (err, stat) {
		
		if (!err) {
			var copied = stat.mtime.getTime();
			done(copied < file.mtime);
		} else done(true);
	});
};