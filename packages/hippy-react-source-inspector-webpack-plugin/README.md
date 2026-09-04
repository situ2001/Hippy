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

Use `enabled` to override mode detection or `reactModule` to select a non-standard
`@hippy/react` entry:

```js
new HippyReactSourceInspectorWebpackPlugin({
  enabled: true,
  reactModule: require.resolve('@hippy/react'),
});
```

Framework adapters can reuse the runtime hook directly:

```js
const { injectToUiModule } = require('@hippy/react-source-inspector-webpack-plugin');

injectToUiModule(UIManagerModule);
```
