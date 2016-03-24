'use strict';

import path                from 'path';
import init                from '../init';
import env                 from '../env';
import {default as logger} from '../../../logger';

export default {
	name: 'init',
	help: 'Initialize a new or existing Enyo library or application. You can initialize new projects from a template and/or ' +
		'ensure the required (Enyo) dependencies are installed.',
	options: {
		project: {
			position: 1,
			help: 'The full or relative path to the target project. Defaults to the current working directory if not provided.'
		},
		name: {
			abbr: 'n',
			help: 'The name of the project. If not provided, the "project" basename will be used instead.'
		},
		template: {
			abbr: 't',
			help: 'The name of the template a new project should be initialized from. See the "templates" command for more ' +
				'information on how to manage templates. If no template is specified and the "project" is not already a project ' +
				'the default template will be used.'
		},
		library: {
			flag: true,
			help: 'Set this flag when initializing a library project. This is assumed if the requested "template" is a library. If ' +
				'this flag is set and the requested template is not a library it will ignore the flag.'
		},
		initLibs: {
			full: 'init-libs',
			abbr: 'i',
			flag: true,
			default: true,
			help: 'If the project has any library dependencies and this flag is set it will attempt to intialize them. Set this to false to ' +
				'skip this step.'
		},
		linkAllLibs: {
			full: 'link-all-libs',
			abbr: 'L',
			flag: true,
			default: false,
			help: 'If this flag is set it will attempt to link any required libraries and skip those that are not linkable. If the "init-libs" ' +
				'flag is set to false this has no meaning.'
		},
		linkAvailLibs: {
			full: 'link-available',
			abbr: 'D',
			flag: true,
			default: false,
			help: 'If this flag is set it will attempt to link any required libraries and install those that are not linkable. If the "init-libs" ' +
				'flag is set to false this has no meaning. This option will be ignored if the "link-all-libs" flag is set.'
		}
	},
	callback (opts) {
		let log = logger(opts).child({component: 'init'});
		log.level(opts.logLevel || 'warn');
		opts.project = path.resolve(opts.project || process.cwd());
		opts.cwd     = opts.project;
		return init({opts, env: env(opts)}).catch(e => {
			log.warn(e);
		});
	}
};