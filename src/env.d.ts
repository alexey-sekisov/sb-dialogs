/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}

declare module 'postcss-prefix-selector' {
  import type { Plugin } from 'postcss'
  interface Options {
    prefix: string
    exclude?: RegExp[]
    transform?: (prefix: string, selector: string, prefixedSelector: string) => string
  }
  export default function prefixSelector(options: Options): Plugin
}
