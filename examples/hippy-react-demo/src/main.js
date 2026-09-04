import { Hippy, UIManagerModule } from '@hippy/react';
import App from './app';

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-underscore-dangle
  global.__HIPPY_INSPECTOR__ = {
    inspectNode: (nodeId) => {
      const data = UIManagerModule.getInspectorDataForNode(nodeId);
      console.log('[Hippy Inspector] selected node:', data);
      return data;
    },
  };
}

global.Hippy.on('uncaughtException', (err) => {
  console.error('uncaughtException error', err.stack, err.message);
});

// only supported in iOS temporarily
global.Hippy.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection reason', reason);
});

new Hippy({
  appName: 'Demo',
  entryPage: App,
  // set global bubbles, default is false
  bubbles: false,
  // set log output, default is false
  silent: false,
}).start();
