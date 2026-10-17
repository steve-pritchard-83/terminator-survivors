declare const __APP_VERSION__: string | undefined;
declare const __BUILD_HASH__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.10.0';

export const BUILD_HASH: string =
  typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'f4b929d';
