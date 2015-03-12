'use strict';


var
	path = require('path'),
	fs = require('fs'),
	assert = require('assert');

exports.createStyleNode = createStyleNode;
exports.createStylesheetNode = createStylesheetNode;
exports.createScriptNode = createScriptNode;
exports.getDocumentHead = getDocumentHead;
exports.scrubDocumentHead = scrubDocumentHead;


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
