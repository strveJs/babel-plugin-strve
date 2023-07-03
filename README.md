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

### other modes

By default, `h``` will be used as a tag template mode. If there are other scenarios, you can choose to call the expression mode, there are two.

1. The function name is `tem_h`, and the parameter is a template string.

```js
tem_h(`<p>hello</p>`);
```

2. The function name is `str_h`, and the parameters are ordinary strings.

```js
str_h("<p>hello</p>");
```

> Whether you choose the default mode or call the expression mode, their final output structure is the same. In addition, these modes we can use at the same time.

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2022-present, maomincoding
