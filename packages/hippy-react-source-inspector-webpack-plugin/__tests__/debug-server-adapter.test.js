import test from 'ava';
import debugServerAdapter from '../lib/debug-server-adapter';

const {
  INSPECTED_NODE_METHOD,
  createInspectorExpression,
  createSelectionMiddleware,
  installDebugServerMiddleware,
  prependMiddleware,
} = debugServerAdapter;

test('selection middleware evaluates the injected page runtime after selection', async (t) => {
  const calls = [];
  const middleware = createSelectionMiddleware();
  const response = { result: {} };

  const result = await middleware({
    msg: { params: { nodeId: 42 } },
    sendToApp(command) {
      calls.push(command);
      return Promise.resolve({ result: {} });
    },
  }, async () => response);

  t.is(result, response);
  t.is(calls.length, 1);
  t.is(calls[0].method, 'Runtime.evaluate');
  t.true(calls[0].params.returnByValue);
  t.true(calls[0].params.expression.includes('inspectNode(42)'));
});

test('selection middleware ignores commands without a numeric node id', async (t) => {
  let sendCount = 0;
  const middleware = createSelectionMiddleware();

  await middleware({
    msg: { params: { nodeId: '42' } },
    sendToApp() {
      sendCount += 1;
    },
  }, async () => undefined);

  t.is(sendCount, 0);
});

test('selection middleware does not break selection when evaluate fails', async (t) => {
  const response = { result: {} };
  const middleware = createSelectionMiddleware();
  const result = await middleware({
    msg: { params: { nodeId: 42 } },
    sendToApp() {
      throw new Error('runtime unavailable');
    },
  }, async () => response);

  t.is(result, response);
});

test('prependMiddleware preserves existing middleware and installs once', (t) => {
  const existing = () => undefined;
  const injected = () => undefined;
  const manager = {
    upwardMiddleWareListMap: {
      [INSPECTED_NODE_METHOD]: existing,
    },
  };

  t.true(prependMiddleware(manager, INSPECTED_NODE_METHOD, injected));
  t.deepEqual(manager.upwardMiddleWareListMap[INSPECTED_NODE_METHOD], [injected, existing]);
  t.false(prependMiddleware(manager, INSPECTED_NODE_METHOD, injected));
});

test('installDebugServerMiddleware supports a loaded debug-server adapter', (t) => {
  const androidMiddleWareManager = { upwardMiddleWareListMap: {} };
  const iOSMiddleWareManager = { upwardMiddleWareListMap: {} };
  const entry = '/virtual/debug-server/dist/index.js';
  const modules = {
    [entry]: {},
    '/virtual/debug-server/dist/middlewares/android': { androidMiddleWareManager },
    '/virtual/debug-server/dist/middlewares/ios': { iOSMiddleWareManager },
  };

  const result = installDebugServerMiddleware('/project', {
    moduleCache: { [entry]: {} },
    resolveModule(name) {
      if (name === '@hippy/debug-server-next') {
        return entry;
      }
      throw new Error('not installed');
    },
    loadModule(request) {
      return modules[request];
    },
  });

  t.deepEqual(result, {
    installed: true,
    packageName: '@hippy/debug-server-next',
  });
  t.is(typeof androidMiddleWareManager.upwardMiddleWareListMap[INSPECTED_NODE_METHOD], 'function');
  t.is(typeof iOSMiddleWareManager.upwardMiddleWareListMap[INSPECTED_NODE_METHOD], 'function');
});

test('inspector expression serializes the node id', (t) => {
  const expression = createInspectorExpression(7);
  t.true(expression.includes('__HIPPY_DEVTOOLS__'));
  t.true(expression.includes('inspectNode(7)'));
});
