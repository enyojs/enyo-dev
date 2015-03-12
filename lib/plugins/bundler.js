'use strict';

var
    path = require('path'),
    fs = require('fs');

var
    through = require('through2'),
    gulp = require('gulp'),
    less = require('less');
var
    File = require('vinyl');

module.exports = function (packager) {
    
    var
        stylesheets = [],
        cssFile,
        jsFile;
    
    // our actual bundling stream that will manage our final output
    var bundler = through.obj(function (file, nil, next) {
        jsFile = file;
        if (cssFile) finish();
        next();
    });
    // this is the interface that browserify will work with
    var plugin = function (bundle, opts) {
        
        // register to know when the bundling will not send any more files
        bundle.on('bundle', function (stream) {
            stream.on('end', function () {
                gulp
                    .src(stylesheets)
                    .pipe(getCssFile())
                    .pipe(through.obj(function (file, nil, next) {
                        file.path = packager.outCssFile || 'insert.css';
                        cssFile = file;
                        if (jsFile) finish();
                        next();
                    }));
            });
        });
        // now register a package handler to manage our internal dep system
        bundle.on('package', function (pkg) {
            explodeStyle(pkg, stylesheets);
        });
        
    };
    
    // we expose the final stream so that the final output js from browserify can be
    // managed by us here
    plugin.bundler = bundler;
    return plugin;
    
    function finish () {
        var output = through.obj();
        output.pipe(gulp.dest(packager.outdir));
        output.write(jsFile);
        output.write(cssFile);
        output.end();
    }
};


function explodeStyle (pkg, stylesheets) {
    if (pkg.style && Array.isArray(pkg.style)) {
        pkg.style.reverse().forEach(function (rel) {
            var file = path.join(pkg.__dirname, rel);
            if (stylesheets.indexOf(file) === -1) {
                stylesheets.unshift(file);
            }
        });
    }
}

function getCssFile () {
    var
        style = '';
    
    return through.obj(accumulate, end);
    
    function accumulate (file, nil, next) {
        style += (file.contents.toString() + '\n');
        next();
    }
    
    function end (done) {
        less
            .render(style)
            .then(function (output) {
                this.push(new File({contents: new Buffer(output.css)}));
                done();
            }.bind(this));
    }
}