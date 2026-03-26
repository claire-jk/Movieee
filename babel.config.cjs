module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 注意：reanimated 插件必須放在最後面
      'react-native-reanimated/plugin',
    ],
  };
};