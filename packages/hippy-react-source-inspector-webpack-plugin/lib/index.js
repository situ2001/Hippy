/*
 * Tencent is pleased to support the open source community by making
 * Hippy available.
 *
 * Copyright (C) 2017-2022 THL A29 Limited, a Tencent company.
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');
const { installDebugServerMiddleware } = require('./debug-server-adapter');

const PLUGIN_NAME = 'HippyReactSourceInspectorWebpackPlugin';
const UI_MODULE_ALIAS = '__HIPPY_REACT_SOURCE_INSPECTOR_UI_MODULE__';
const RUNTIME_ENTRY = path.resolve(__dirname, 'runtime-entry.js');
const DEBUG_SERVER_REGISTER = path.resolve(__dirname, 'debug-server-register.js');

function enableDebugServerChildRegistration() {
  const requireOption = `--require=${JSON.stringify(DEBUG_SERVER_REGISTER)}`;
  const nodeOptions = process.env.NODE_OPTIONS || '';
  if (!nodeOptions.includes(DEBUG_SERVER_REGISTER)) {
    process.env.NODE_OPTIONS = `${nodeOptions} ${requireOption}`.trim();
  }
}

function isBabelLoader(loader) {
  return typeof loader === 'string'
    && /(^|[/\\])babel-loader([/\\]|$)/.test(loader.split('?')[0]);
}

function isSamePlugin(plugin, sourcePlugin) {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  if (pluginName === sourcePlugin || pluginName === '@babel/plugin-transform-react-jsx-source') {
    return true;
  }
  return typeof pluginName === 'string'
    && /[/\\]plugin-transform-react-jsx-source([/\\]|$)/.test(pluginName);
}

function assertCompatiblePreset(options) {
  const presets = options.presets || [];
  presets.forEach((preset) => {
    const presetName = Array.isArray(preset) ? preset[0] : preset;
    const presetOptions = Array.isArray(preset) ? preset[1] : null;
    if (typeof presetName === 'string'
      && /(^|[/\\])(?:@babel[/\\])?preset-react([/\\]|$)/.test(presetName)
      && presetOptions && presetOptions.runtime === 'automatic') {
      throw new Error(`${PLUGIN_NAME} cannot add JSX source metadata when @babel/preset-react uses the automatic runtime.`);
    }
  });
}

function addSourcePlugin(options, sourcePlugin) {
  const babelOptions = options || {};
  assertCompatiblePreset(babelOptions);
  const plugins = babelOptions.plugins || [];
  if (!plugins.some(plugin => isSamePlugin(plugin, sourcePlugin))) {
    plugins.push(sourcePlugin);
  }
  babelOptions.plugins = plugins;
  return babelOptions;
}

function updateUseEntry(useEntry, sourcePlugin) {
  if (typeof useEntry === 'string') {
    if (!isBabelLoader(useEntry)) {
      return { entry: useEntry, count: 0 };
    }
    return {
      entry: { loader: useEntry, options: addSourcePlugin(null, sourcePlugin) },
      count: 1,
    };
  }
  if (!useEntry || typeof useEntry !== 'object' || !isBabelLoader(useEntry.loader)) {
    return { entry: useEntry, count: 0 };
  }
  if (typeof useEntry.options === 'string') {
    throw new Error(`${PLUGIN_NAME} does not support query-string babel-loader options.`);
  }
  // Webpack exposes a mutable configuration object to plugins.
  // eslint-disable-next-line no-param-reassign
  useEntry.options = addSourcePlugin(useEntry.options, sourcePlugin);
  return { entry: useEntry, count: 1 };
}

function updateRules(rules, sourcePlugin) {
  let count = 0;
  (rules || []).forEach((rule) => {
    if (!rule || typeof rule !== 'object') {
      return;
    }
    if (Array.isArray(rule.oneOf)) {
      count += updateRules(rule.oneOf, sourcePlugin);
    }
    if (Array.isArray(rule.rules)) {
      count += updateRules(rule.rules, sourcePlugin);
    }
    if (Array.isArray(rule.use)) {
      // eslint-disable-next-line no-param-reassign
      rule.use = rule.use.map((useEntry) => {
        const updated = updateUseEntry(useEntry, sourcePlugin);
        count += updated.count;
        return updated.entry;
      });
    } else if (rule.use) {
      const updated = updateUseEntry(rule.use, sourcePlugin);
      // eslint-disable-next-line no-param-reassign
      rule.use = updated.entry;
      count += updated.count;
    }
    if (isBabelLoader(rule.loader)) {
      if (typeof rule.options === 'string') {
        throw new Error(`${PLUGIN_NAME} does not support query-string babel-loader options.`);
      }
      // eslint-disable-next-line no-param-reassign
      rule.options = addSourcePlugin(rule.options, sourcePlugin);
      count += 1;
    }
  });
  return count;
}

function prependEntry(entry, injectedEntry) {
  if (typeof entry === 'string') {
    return entry === injectedEntry ? entry : [injectedEntry, entry];
  }
  if (Array.isArray(entry)) {
    return entry.includes(injectedEntry) ? entry : [injectedEntry].concat(entry);
  }
  if (typeof entry === 'function') {
    return function injectedEntryFactory(...args) {
      const result = entry.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then(value => prependEntry(value, injectedEntry));
      }
      return prependEntry(result, injectedEntry);
    };
  }
  if (entry && typeof entry === 'object') {
    if (Object.prototype.hasOwnProperty.call(entry, 'import')) {
      return Object.assign({}, entry, { import: prependEntry(entry.import, injectedEntry) });
    }
    return Object.keys(entry).reduce(
      (result, name) => Object.assign(result, { [name]: prependEntry(entry[name], injectedEntry) }),
      {},
    );
  }
  throw new TypeError(`${PLUGIN_NAME} received an unsupported Webpack entry configuration.`);
}

function resolveReactModule(options, compiler) {
  const resolveOptions = compiler.options.resolve || {};
  const aliases = resolveOptions.alias || {};
  const configuredAlias = aliases['@hippy/react$'] || aliases['@hippy/react'];
  const request = options.reactModule || configuredAlias || '@hippy/react';
  if (typeof request !== 'string') {
    throw new TypeError(`${PLUGIN_NAME} requires reactModule or the @hippy/react alias to be a string.`);
  }
  return require.resolve(request, { paths: [compiler.context] });
}

class HippyReactSourceInspectorWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
    if (this.options.debugServer !== false) {
      enableDebugServerChildRegistration();
    }
  }

  apply(compiler) {
    const enabled = typeof this.options.enabled === 'boolean'
      ? this.options.enabled
      : compiler.options.mode !== 'production';
    if (!enabled) {
      return;
    }

    const sourcePlugin = require.resolve('@babel/plugin-transform-react-jsx-source', {
      paths: [compiler.context, __dirname],
    });
    const rules = compiler.options.module && compiler.options.module.rules;
    const babelLoaderCount = updateRules(rules, sourcePlugin);
    if (!babelLoaderCount) {
      throw new Error(`${PLUGIN_NAME} could not find babel-loader in module.rules.`);
    }

    const reactModule = resolveReactModule(this.options, compiler);
    // Webpack plugins configure the compiler through its mutable options object.
    // eslint-disable-next-line no-param-reassign
    compiler.options.resolve = resolveOptionsWithAlias(compiler.options.resolve, reactModule);
    // eslint-disable-next-line no-param-reassign
    compiler.options.entry = prependEntry(compiler.options.entry, RUNTIME_ENTRY);

    if (this.options.debugServer !== false) {
      const logger = compiler.getInfrastructureLogger
        ? compiler.getInfrastructureLogger(PLUGIN_NAME)
        : null;
      installDebugServerMiddleware(compiler.context, {
        adapters: this.options.hippyDebugServer,
        onError(error, packageName) {
          if (logger) {
            logger.warn(`Could not register ${packageName} inspector middleware: ${error.message}`);
          }
        },
      });
    }
  }
}

function resolveOptionsWithAlias(resolveOptions, reactModule) {
  const result = resolveOptions || {};
  result.alias = Object.assign({}, result.alias, {
    [`${UI_MODULE_ALIAS}$`]: reactModule,
  });
  return result;
}

module.exports = HippyReactSourceInspectorWebpackPlugin;
module.exports.injectToUiModule = require('./runtime').injectToUiModule;
