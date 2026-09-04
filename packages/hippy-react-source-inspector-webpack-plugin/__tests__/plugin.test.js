import path from 'path';
import test from 'ava';
import HippyReactSourceInspectorWebpackPlugin from '../lib';

function createCompiler(mode = 'development') {
  return {
    context: path.resolve(__dirname, '../../../examples/hippy-react-demo'),
    options: {
      mode,
      entry: { index: ['./src/main.js'] },
      module: {
        rules: [{
          oneOf: [{
            test: /\.jsx?$/,
            use: [{
              loader: require.resolve('babel-loader', {
                paths: [path.resolve(__dirname, '../../../examples/hippy-react-demo')],
              }),
              options: { plugins: [] },
            }],
          }],
        }],
      },
      resolve: { alias: {} },
    },
  };
}

test('plugin injects source transform, runtime entry, and resolved React module', (t) => {
  const compiler = createCompiler();
  new HippyReactSourceInspectorWebpackPlugin().apply(compiler);

  const babelOptions = compiler.options.module.rules[0].oneOf[0].use[0].options;
  t.true(babelOptions.plugins.some(plugin => /plugin-transform-react-jsx-source/.test(plugin)));
  t.true(/runtime-entry\.js$/.test(compiler.options.entry.index[0]));
  // eslint-disable-next-line no-underscore-dangle
  const reactAlias = compiler.options.resolve.alias.__HIPPY_REACT_SOURCE_INSPECTOR_UI_MODULE__$;
  t.true(/@hippy[/\\]react[/\\]dist[/\\]index\.js$/.test(reactAlias));
});

test('plugin does not inject twice', (t) => {
  const compiler = createCompiler();
  const plugin = new HippyReactSourceInspectorWebpackPlugin();
  plugin.apply(compiler);
  plugin.apply(compiler);

  const babelPlugins = compiler.options.module.rules[0].oneOf[0].use[0].options.plugins;
  t.is(babelPlugins.filter(item => /plugin-transform-react-jsx-source/.test(item)).length, 1);
  t.is(compiler.options.entry.index.filter(item => /runtime-entry\.js$/.test(item)).length, 1);
});

test('plugin is disabled in production', (t) => {
  const compiler = createCompiler('production');
  new HippyReactSourceInspectorWebpackPlugin().apply(compiler);

  t.deepEqual(compiler.options.entry, { index: ['./src/main.js'] });
  t.deepEqual(compiler.options.module.rules[0].oneOf[0].use[0].options.plugins, []);
});

test('debug-server integration can be disabled', (t) => {
  const oldNodeOptions = process.env.NODE_OPTIONS;
  const compiler = createCompiler();
  new HippyReactSourceInspectorWebpackPlugin({ debugServer: false }).apply(compiler);

  t.is(process.env.NODE_OPTIONS, oldNodeOptions);
});
