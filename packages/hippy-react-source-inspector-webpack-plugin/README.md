# Hippy React Source Inspector Webpack Plugin

Inject React source metadata and the Hippy inspector runtime into development bundles.

```js
const HippyReactSourceInspectorWebpackPlugin = require('@hippy/react-source-inspector-webpack-plugin');

module.exports = {
  mode: 'development',
  plugins: [
    new HippyReactSourceInspectorWebpackPlugin(),
  ],
};
```

The plugin requires an existing `babel-loader` rule. It is disabled automatically when
Webpack runs in production mode.

The adapter is version-tolerant across the two distributions, but it intentionally
loads their current middleware-manager paths because neither package exposes a public
registration API yet.

The child-process registration is inherited when `hippy-dev` launches the debug
server. A debug server that was already started independently cannot be modified by
the Webpack process; restart it through `hippy-dev` (or preload the plugin register)
to enable selected-node inspection.

Use `enabled` to override mode detection or `reactModule` to select a non-standard
`@hippy/react` entry:

```js
new HippyReactSourceInspectorWebpackPlugin({
  enabled: true,
  reactModule: require.resolve('@hippy/react'),
  debugServer: true,
});
```

Set `debugServer: false` when another integration owns selected-node handling.

Framework adapters can reuse the runtime hook directly:

```js
const { injectToUiModule } = require('@hippy/react-source-inspector-webpack-plugin');

injectToUiModule(UIManagerModule);
```
