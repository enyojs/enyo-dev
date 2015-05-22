'use strict';

var 
    htmlparser = require("htmlparser2");

var
	path = require('path'),
    fs = require('fs');

var
	slash = require('slash'),
	through = require('through2');

var
	logger = require('../logger');

module.exports = function (packager) {
	return function (filename) {
        
        var tplFile = path.basename(filename, '.js') + '.tpl.html';
        var tplPath = path.join(path.dirname(filename), tplFile);
        var src = '';
        var components = [];

        if (fs.existsSync(tplPath)) {
            //if the template exists then parse the template
            components = parseTpl(tplPath);
            return through(write, end);
        }
        
       	function write (buf, nil, next) {
			src += buf.toString();
			next();
		}

		// where the magic happens
		function end (done) {
            
            //need to properly append components here
            src += components;
            
			this.push(new Buffer(src));

			done();
		}

        return through();
	};
};


function parseTpl(file) {
    
      var data = fs.readFileSync(file);

      //component tree to build from template nodes
      var components = [];

      //opentags
      var open = 0;

      var root = 0; 

      //current working kind
      var current = {};
      var lastParent = [];

      //parse the HTML
      var parser = new htmlparser.Parser({
            onopentag: function(name, attribs){
                //create a new kind
                var kind = {tag: name, kind: attribs.kind};

                //if we're inside a tree, we need to append components
                if(open > 0) {
                    current.components = current.components || [];
                    current.components.push(kind);
                    lastParent.push(current);
                    current = kind;
                } else {
                    //push the kind if we're not inside an open tag
                    root = components.push(kind);
                    current = components[open];
                }

                open ++;
            },
            ontext: function(text){
               //remove new lines and extra spaces 
                var t = text.replace(/(\r\n|\n|\r)/gm,"").trim();
                if(t.length > 0){
                    current.content = t;
                }
            },
            onclosetag: function(tagname){
                //reduce the number of tags open
                open --;

                //set the current tag to the last open
                if(open <= 0) { 
                    current = components[root];
                } else {

                    current = lastParent[lastParent.length - 1];
                    lastParent.pop();
                }
            },
            onend: function(){
                //template is parsed and ready to be included with the kind
                //console.log(components);
            }
        });

        parser.write(data);
        parser.end();
    
        var componentString = JSON.stringify(components);
        componentString = "var test = " + componentString + ";";
        return componentString;
}
