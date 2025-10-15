const { resolve, join } = require("path");
const { ProvidePlugin, EnvironmentPlugin } = require("webpack");
const { merge } = require("webpack-merge");
const webpackNodeExternals = require("webpack-node-externals");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WebpackBar = require("webpackbar");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const LoadablePlugin = require("@loadable/webpack-plugin");
const { omit } = require("lodash");
const { name } = require("../package.json");
const appConstants = require("./constants");

const lessModuleRegex = /\.module\.less$/;

const handleLess = [
  "postcss-loader",
  "less-loader",
  // {
  //   loader: "style-resources-loader",
  //   ident: "style-resources-loader",
  //   options: {
  //   patterns: [resolve("./src/varible.less")],
  //   },
  // },
];

const common = {
  cache: { type: "filesystem" },
  watchOptions: {
    ignored: /node_modules\/\.cache/,
  },
  experiments: { topLevelAwait: true },
  stats: "errors-warnings",
  module: {
    rules: [
      // tsx
      {
        test: /\.(t|j)sx?$/,
        use: [
          {
            loader: "thread-loader",
            options: { workers: 3 },
          },
          {
            loader: "babel-loader",
            options: { cacheDirectory: true },
          },
        ],
      },
    ],
  },
  plugins: [
    new ESLintPlugin({
      failOnError: true,
      failOnWarning: false,
      threads: true,
      emitWarning: false,
      lintDirtyModulesOnly: true,
    }),
  ],
  resolve: {
    modules: ["node_modules", resolve("src"), resolve("app")],
    extensions: [".js", ".ts", ".tsx", ".jsx"],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: join("./tsconfig.json"),
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      }),
    ],
  },
};

const baseClientConfig = (env) => {
  const isDevelopment = /^dev/.test(env.mode);
  const enableProfile = process.env.PROFILE === "true";

  return merge(common, {
    name: `client:${name}`,
    target: "browserslist",
    entry: {
      client: [resolve("app/client/index.tsx")],
    },
    output: {
      path: join(appConstants.buildPath, "client"),
      publicPath: `/static/client/`,
      clean: true,
    },
    ...(enableProfile && {
      resolve: {
        alias: {
          "react-dom/client": "react-dom/profiling",
          "scheduler/tracing": "scheduler/tracing-profiling",
        },
      },
    }),
    module: {
      rules: [
        // styles
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
          sideEffects: true,
        },
        {
          test: /\.less$/,
          exclude: lessModuleRegex,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: { importLoaders: 2 },
            },
            ...handleLess,
          ],
          sideEffects: true,
        },
        {
          test: lessModuleRegex,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                importLoaders: 2,
                modules: {
                  localIdentName: isDevelopment
                    ? "[path][name]__[local]"
                    : "[hash:base64]",
                },
              },
            },
            ...handleLess,
          ],
        },
        {
          test: /\.(webp|png|jpg|jpeg|gif|eot|woff|woff2|ttf|otf)$/,
          type: "asset/resource",
        },
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: [
            "@svgr/webpack",
            {
              loader: "file-loader",
              options: {
                name: "dist/media/[name].[contenthash:8].[ext]",
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new LoadablePlugin({
        outputAsset: false,
        writeToDisk: true,
        filename: `${appConstants.buildPath}/loadable-stats.json`,
      }),
      new WebpackManifestPlugin(),
      new WebpackBar({ name: "client", profile: true }),
      new EnvironmentPlugin(require(`./env/${env.goal}`)),
      //   new WebpackBuildNotifierPlugin({
      //     title: `${name} Build`,
      //     suppressSuccess: true,
      //     logo: resolve(__dirname, "../public/favicon2.png"),
      //   }),
      new ProvidePlugin({ process: "process/browser.js" }),
    ],
  });
};

module.exports = {
  clent: baseClientConfig,
  server: (env) =>
    merge(common, {
      name: `server:${name}`,
      externalsPresets: { node: true },
      target: "node",
      entry: omit(
        {
          server: resolve("app/server/server.ts"),
          serverless: resolve("app/server/serverless.ts"),
        },
        [["online", "beta"].includes(env.goal) ? "server" : "serverless"]
      ),
      output: omit(
        {
          libraryTarget: "commonjs",
          path: resolve(appConstants.buildPath),
          filename: "[name].js",
          chunkFilename: "scripts/[name].server.js",
          publicPath: "/",
        },
        [!["online", "beta"].includes(env.goal) && "libraryTarget"].filter(
          Boolean
        )
      ),
      module: {
        rules: [
          {
            test: /\.(less|css|svg|jpg|jpeg|png|webp|gif|eot|woff|woff2|ttf|otf)$/,
            loader: "ignore-loader",
          },
        ],
      },
      plugins: [new WebpackBar({ name: "server", profile: true })],
    }),
};
