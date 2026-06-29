module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    overrides: [
      {
        // NativeWind css-interop breaks full-screen overlays (navigation context crash).
        test: /(?:PaymentModal|ProductPhoto)\.tsx$/,
        presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
        plugins: [],
      },
    ],
  };
};
