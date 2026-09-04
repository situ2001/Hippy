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

const INSPECTOR_GLOBAL_NAME = '__HIPPY_DEVTOOLS__';

function getFiberName(fiber) {
  const type = fiber && fiber.type;
  if (typeof type === 'string') {
    return type;
  }
  if (typeof type === 'function') {
    return type.displayName || type.name || null;
  }
  if (type && typeof type === 'object') {
    return type.displayName || type.name || null;
  }
  return null;
}

function getFiberSource(fiber) {
  // React intentionally keeps development-only source metadata on this private field.
  // eslint-disable-next-line no-underscore-dangle
  const source = fiber && fiber._debugSource;
  if (!source || typeof source.fileName !== 'string' || typeof source.lineNumber !== 'number') {
    return null;
  }

  const result = {
    fileName: source.fileName,
    lineNumber: source.lineNumber,
  };
  if (typeof source.columnNumber === 'number') {
    result.columnNumber = source.columnNumber;
  }
  return result;
}

function serializeFiber(nodeId, targetNode) {
  const element = targetNode.stateNode;
  const fiberStack = [];
  let source = getFiberSource(targetNode);
  let componentName = null;
  let currentNode = targetNode;

  while (currentNode) {
    const name = getFiberName(currentNode);
    const currentSource = getFiberSource(currentNode);
    if (!source && currentSource) {
      source = currentSource;
    }
    if (name) {
      if (!componentName && typeof currentNode.type !== 'string') {
        componentName = name;
      }
      fiberStack.push({ name, source: currentSource });
    }
    currentNode = currentNode.return;
  }

  return {
    nodeId,
    nativeName: (element && (element.nativeName
      || (element.meta && element.meta.component && element.meta.component.name))) || null,
    componentName: componentName || getFiberName(targetNode),
    source,
    fiberStack,
  };
}

function createInspector(uiModule) {
  if (!uiModule || typeof uiModule.getNodeById !== 'function') {
    throw new TypeError('Hippy React source inspector requires UIManagerModule.getNodeById().');
  }

  return {
    inspectNode: function inspectNode(nodeId) {
      if (typeof nodeId !== 'number') {
        return null;
      }
      const targetNode = uiModule.getNodeById(nodeId);
      return targetNode ? serializeFiber(nodeId, targetNode) : null;
    },
  };
}

function injectToUiModule(uiModule, globalObject) {
  const target = globalObject || (typeof global !== 'undefined' && global);
  if (!target) {
    throw new Error('Hippy React source inspector cannot find the JavaScript global object.');
  }

  const devtools = target[INSPECTOR_GLOBAL_NAME] || {};
  const inspector = createInspector(uiModule);
  devtools.inspectNode = inspector.inspectNode;
  target[INSPECTOR_GLOBAL_NAME] = devtools;
  return inspector;
}

module.exports = {
  INSPECTOR_GLOBAL_NAME,
  createInspector,
  injectToUiModule,
};
