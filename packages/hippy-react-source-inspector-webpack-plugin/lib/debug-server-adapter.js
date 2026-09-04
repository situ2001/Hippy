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

const INSPECTED_NODE_METHOD = 'DOM.setInspectedNode';
const RUNTIME_EVALUATE_METHOD = 'Runtime.evaluate';
const INSTALL_MARK = Symbol.for('@hippy/react-source-inspector/debug-server-middleware');

const DEBUG_SERVER_ADAPTERS = [
  {
    packageName: '@hippy/debug-server-next',
    middlewareRoot: 'middlewares',
  },
];

function createInspectorExpression(nodeId) {
  return '(function(){var api=typeof global!==\'undefined\'&&global.__HIPPY_DEVTOOLS__;'
    + 'if(!api||typeof api.inspectNode!==\'function\'){return null;}'
    + `var data=api.inspectNode(${JSON.stringify(nodeId)});`
    + 'if(data&&typeof console!==\'undefined\'){console.log(\'[Hippy Inspector Webpack Plugin] selected node:\',data);}'
    + 'return data;}())';
}

function createSelectionMiddleware() {
  return async function inspectSelectedNode(context, next) {
    const response = await next();
    const params = context.msg && context.msg.params;
    const nodeId = params && params.nodeId;
    if (typeof nodeId !== 'number') {
      return response;
    }

    try {
      Promise.resolve(context.sendToApp({
        method: RUNTIME_EVALUATE_METHOD,
        params: {
          expression: createInspectorExpression(nodeId),
          returnByValue: true,
        },
      })).catch(() => undefined);
    } catch (error) {
      return response;
    }
    return response;
  };
}

function prependMiddleware(manager, method, middleware) {
  if (!manager || !manager.upwardMiddleWareListMap || manager[INSTALL_MARK]) {
    return false;
  }

  const middlewareMap = manager.upwardMiddleWareListMap;
  const current = middlewareMap[method];
  if (!current) {
    middlewareMap[method] = middleware;
  } else if (Array.isArray(current)) {
    middlewareMap[method] = [middleware].concat(current);
  } else {
    middlewareMap[method] = [middleware, current];
  }
  Object.defineProperty(manager, INSTALL_MARK, { value: true });
  return true;
}

function resolveDebugServerAdapters(projectRoot, resolveModule = require.resolve, adapters = DEBUG_SERVER_ADAPTERS) {
  const configuredAdapters = Array.isArray(adapters) ? adapters : [adapters];
  return configuredAdapters.reduce((result, adapter) => {
    if (!adapter || typeof adapter.packageName !== 'string'
      || typeof adapter.middlewareRoot !== 'string') {
      return result;
    }
    try {
      const entry = resolveModule(adapter.packageName, { paths: [projectRoot] });
      result.push(Object.assign({}, adapter, {
        entry,
        packageRoot: path.dirname(entry),
      }));
    } catch (error) {
      // The host project may use either debug-server distribution.
    }
    return result;
  }, []);
}

function isPackageLoaded(adapter, moduleCache = require.cache) {
  const packagePrefix = `${adapter.packageRoot}${path.sep}`;
  const loadedFiles = Object.keys(moduleCache);
  return loadedFiles.some(fileName => fileName === adapter.entry
    || fileName.indexOf(packagePrefix) === 0);
}

function loadMiddlewareManagers(adapter, loadModule = require) {
  // Loading the public entry first initializes aliases used by debug-server internals.
  loadModule(adapter.entry);
  const middlewareRoot = path.join(adapter.packageRoot, adapter.middlewareRoot);
  const android = loadModule(path.join(middlewareRoot, 'android'));
  const ios = loadModule(path.join(middlewareRoot, 'ios'));
  return [android.androidMiddleWareManager, ios.iOSMiddleWareManager];
}

function installDebugServerMiddleware(projectRoot, options = {}) {
  const adapters = resolveDebugServerAdapters(
    projectRoot,
    options.resolveModule,
    options.adapters,
  );
  const activeAdapters = options.forceLoad
    ? adapters
    : adapters.filter(adapter => isPackageLoaded(adapter, options.moduleCache));

  for (let i = 0; i < activeAdapters.length; i += 1) {
    const adapter = activeAdapters[i];
    try {
      const managers = loadMiddlewareManagers(adapter, options.loadModule);
      const middleware = createSelectionMiddleware();
      const installed = managers.reduce(
        (count, manager) => count + Number(prependMiddleware(
          manager,
          INSPECTED_NODE_METHOD,
          middleware,
        )),
        0,
      );
      if (installed) {
        return { installed: true, packageName: adapter.packageName };
      }
      if (managers.every(manager => manager && manager[INSTALL_MARK])) {
        return { installed: true, packageName: adapter.packageName };
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error, adapter.packageName);
      }
    }
  }

  return { installed: false, packageName: null };
}

module.exports = {
  DEBUG_SERVER_ADAPTERS,
  INSPECTED_NODE_METHOD,
  RUNTIME_EVALUATE_METHOD,
  createInspectorExpression,
  createSelectionMiddleware,
  installDebugServerMiddleware,
  prependMiddleware,
};
