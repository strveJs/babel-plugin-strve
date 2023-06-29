# babel-plugin-strve

A Babel plugin that compiles the template string in Strve.js into a normal object.

```js
// input:
const state = {
	count: 0,
};

h`<h1 $key>${state.count}</h1>`;

// output:
{
    children: [0],
    props: {"$key": true},
    tag: "h1"
}
```

## Usage

In your Babel configuration (`.babelrc`, `babel.config.js`, `"babel"` field in package.json, etc), add the plugin:

```js
{
  "plugins": [
    ["babel-plugin-strve"]
  ]
}
```

### options

#### `tag=h`

By default, `babel-plugin-strve` will process all Tagged Templates with a tag function named `h`. To use a different name, use the `tag` option in your Babel configuration:

```js
{"plugins":[
  ["babel-plugin-strve", {
    "tag": "html"
  }]
]}
```

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2022-present, maomincoding
