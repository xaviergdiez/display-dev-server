const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

const nodeModules = `${path.resolve(__dirname, "../../node_modules")}/`;

module.exports = {
  entry: path.resolve(__dirname, "../preview/src/index.js"),
  mode: "development",
  output: {
    path: path.resolve(__dirname, "../preview/dist"),
    filename: "js/index_bundle.js",
  },
  target: "web",
  devServer: {
    port: "5000",
    static: {
      directory: path.join(__dirname, "public"),
    },
    open: true,
    hot: true,
    liveReload: true,
  },

  resolve: {
    extensions: [".js", ".jsx", ".json"],
    symlinks: true,
    modules: ["node_modules", nodeModules, path.resolve("node_modules")],
  },

  resolveLoader: {
    symlinks: true,
    modules: ["node_modules", nodeModules, path.resolve("node_modules")],
  },
  module: {
    rules: [
      {
        test: /\.(s[ac]ss|css)$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot)$/,
        type: "asset/resource",
        generator: {
          filename: "./fonts/[name][ext]",
        },
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [[require.resolve("@babel/preset-react")]],
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "../preview/public", "index.html"),
    }),
  ],
};
