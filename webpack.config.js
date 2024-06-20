// webpack.config.js
import path from 'path';

const pluginJobTemplate = (entryPoint, filename) => ({
  mode: 'production',
  entry: entryPoint,
  target: 'web',
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true
        }
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ]
  },
  output: {
    filename,
    path: path.resolve(process.cwd(), 'extension')
  },
  optimization: {
    minimize: false
  }
});

export default [
  pluginJobTemplate('./src/browser/inject.ts', 'inject.js'),
  pluginJobTemplate('./src/plugin/background.ts', 'background.js')
]