'use strict';


var
	path = require('path'),
	fs = require('fs'),
	assert = require('assert');

var
	slash = require('slash');

var
	logger = require('./logger');

exports.createStyleNode = createStyleNode;
exports.createStylesheetNode = createStylesheetNode;
exports.createScriptNode = createScriptNode;
exports.createTitleNode = createTitleNode;
exports.getDocumentHead = getDocumentHead;
exports.getDocumentTitle = getDocumentTitle;
exports.setDocumentTitle = setDocumentTitle;
exports.scrubDocumentHead = scrubDocumentHead;
exports.translateUrlPaths = translateUrlPaths;
exports.translateImportPaths = translateImportPaths;


var BaseNode = {
	nodeName: '',
	tagName: '',
	attrs: [],
	namespaceURI: 'http://www.w3.org/1999/xhtml',
	childNodes: [],
	parentNode: null
};

var BaseDocumentFragment = {
	nodeName: '#document-fragment',
	quirksMode: false,
	childNodes: null,
	parentNode: null
};

var BaseText = {
	nodeName: '#text',
	value: '',
	parentNode: null
};


function createStyleNode (parent, text) {
	var ret = Object.create(BaseNode), txt;
	ret.parentNode = parent;
	ret.nodeName = 'style';
	ret.tagName = 'style';
	txt = Object.create(BaseText);
	txt.parentNode = ret;
	txt.value = text;
	ret.childNodes = [txt];
	return ret;
}

function createTitleNode (parent, text) {
	var ret = Object.create(BaseNode), txt;
	ret.parentNode = parent;
	ret.nodeName = 'title';
	ret.tagName = 'title';
	txt = Object.create(BaseText);
	txt.parentNode = ret;
	txt.value = text;
	ret.childNodes = [txt];
	return ret;
}

function createStylesheetNode (parent, href) {
	var ret = Object.create(BaseNode);
	ret.parentNode = parent;
	ret.nodeName = 'link';
	ret.tagName = 'link';
	ret.attrs = [
		{name: 'href', value: href},
		{name: 'rel', value: 'stylesheet'}
	];
	return ret;
}




function createScriptNode (parent, src, external) {
	var ret = Object.create(BaseNode), txt;
	ret.parentNode = parent;
	ret.nodeName = 'script';
	ret.tagName = 'script';
	if (external) {
		ret.attrs = [{name: 'src', value: src}];
	} else {
		txt = Object.create(BaseText);
		txt.parentNode = ret;
		txt.value = src;
		ret.childNodes = [txt];
	}
	return ret;
}

function getDocumentHead (node) {
	var i, child;
	if (node.tagName == 'head') return node;
	if (node.childNodes) {
		for (i = 0; i < node.childNodes.length; ++i) {
			child = getDocumentHead(node.childNodes[i]);
			if (child) return child;
		}
	}
}

function getDocumentTitle (node) {
	var i, child;
	if (node.tagName == 'title') return node;
	if (node.childNodes) {
		for (i = 0; i < node.childNodes.length; ++i) {
			child = getDocumentTitle(node.childNodes[i]);
			if (child) return child;
		}
	}
}

function setDocumentTitle (node, text) {
	var title = getDocumentTitle(node), head, txt;
	if (!title) {
		title = createTitleNode(node, text);
		head = getDocumentHead(node);
		if (!head) throw 'Error: Cannot add a <title> to a #document without a <head>';
		head.childNodes.push(title);
	} else {
		txt = Object.create(BaseText);
		txt.value = text;
		txt.parentNode = title;
		if (!title.childNodes) title.childNodes = [];
		title.childNodes.push(txt);
	}
}

function scrubDocumentHead (node) {
	var head = getDocumentHead(node);
	head.childNodes = head.childNodes.filter(function (node) {
		return !(
			node.tagName == 'style' ||
			// @todo Perhaps we should not be so cavalier here...
			node.tagName == 'script' ||
			node.tagName == 'link' ||
			node.tagName == 'template'
		);
	});
}

/**
* If there are imports in the CSS we are concatenating then it will be targeting LESS compilation
* not runtime importing. We are actually mapping the original request from its relative path to the
* target to one from the current working directory of the build process to the file so that LESS
* can find it easily.
*/
function translateImportPaths (text, base, file) {
	text = text.replace(/(\@import\s+(['"])(?!https?)([a-zA-Z0-9\ \/\-\.\@\{\}]+)\2)/g,
		function (match, full, wrap, src) {
			var ret;
			if (src.charAt(0) != '/') {
				ret = '@import \'' + (
						// we simply convert the relative path to the actual path
						slash(path.join(base, src))
					) + '\'';
				logger.log('debug', '-- %s -> translating @import from "%s" to "%s"', file, match, ret);
				return ret;
			} else return full;
		}
	);
	return text;
}

function translateUrlPaths (text, base, origin, pkg, file, assets) {
	text = text.replace(/url\((?!http)(?:\'|\")?([a-zA-Z0-9\ \.\/\-]*)(?:\'|\")?\)/g,
		function (match, exact) {
			var ret, rel, uri;
			// this may be a faulty assumption but we should only be seeing this match if
			// it is a path that begins from the root (or assumed root with a /) or a relative
			// path since the regex shouldn't match remote requests
			if (exact.charAt(0) != '/') {
				rel = path.relative(pkg, path.resolve(origin, exact));
				ret = 'url(\'' + (
					(uri = slash(path.join(base, rel)))
					) + '\')';
				logger.log('debug', '-- %s -> translating URL from "%s" to "%s"', file, match, ret);
				assets[uri] = file;
				return ret;	
			} else return match;
		}
	);
	return text;
}
