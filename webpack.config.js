const path = require('path');
const dev = process.env.NODE_ENV !== 'production';
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const webpackConfig = {
  entry: {
    'main': ['./src/main'],
  },
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: '[name].js'
  },
  devtool: dev ? 'inline-source-map' : 'source-map',
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      include: path.resolve(__dirname, 'src'),
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-react']
        }
      }
    }, {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      include: path.resolve(__dirname, 'src'),
      use: {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      }
    }, {
      test: /\.css$/i,
      use: ['style-loader', 'css-loader'],
    }]
  },
  plugins: [new ForkTsCheckerWebpackPlugin({
    typescript: {
      memoryLimit: 2048*2
    }
  })],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    }
  },
  devServer: {
    static: [path.resolve(__dirname, '.'), {
      watch: true,
    }],
    devMiddleware: {
      writeToDisk: true
    }
  },
  cache: {
    type: 'filesystem',
  },
  watchOptions: {
    poll: 2000
  }
};

module.exports = webpackConfig;