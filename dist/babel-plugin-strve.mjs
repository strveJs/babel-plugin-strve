const MODE_SLASH = 0;
const MODE_TEXT = 1;
const MODE_WHITESPACE = 2;
const MODE_TAGNAME = 3;
const MODE_COMMENT = 4;
const MODE_PROP_SET = 5;
const MODE_PROP_APPEND = 6;
const CHILD_APPEND = 0;
const CHILD_RECURSE = 2;
const TAG_SET = 3;
const PROPS_ASSIGN = 4;
const PROP_SET = MODE_PROP_SET;
const PROP_APPEND = MODE_PROP_APPEND;
const treeify = function (built, fields) {
  const _treeify = function (built) {
    let tag = '';
    let currentProps = null;
    const props = [];
    const children = [];
    for (let i = 1; i < built.length; i++) {
      const type = built[i++];
      const value = built[i] ? fields[built[i++] - 1] : built[++i];
      if (type === TAG_SET) {
        tag = value;
      } else if (type === PROPS_ASSIGN) {
        props.push(value);
        currentProps = null;
      } else if (type === PROP_SET) {
        if (!currentProps) {
          currentProps = Object.create(null);
          props.push(currentProps);
        }
        currentProps[built[++i]] = [value];
      } else if (type === PROP_APPEND) {
        currentProps[built[++i]].push(value);
      } else if (type === CHILD_RECURSE) {
        children.push(_treeify(value));
      } else if (type === CHILD_APPEND) {
        children.push(value);
      }
    }
    return {
      tag: tag,
      props: props,
      children: children
    };
  };
  const {
    children
  } = _treeify(built);
  return children.length > 1 ? children : children[0];
};
const build = function (statics) {
  let mode = MODE_TEXT;
  let buffer = '';
  let quote = '';
  let current = [0];
  let char, propName;
  const commit = function (field) {
    if (mode === MODE_TEXT && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')))) {
      current.push(CHILD_APPEND, field, buffer);
    } else if (mode === MODE_TAGNAME && (field || buffer)) {
      current.push(TAG_SET, field, buffer);
      mode = MODE_WHITESPACE;
    } else if (mode === MODE_WHITESPACE && buffer === '...' && field) {
      current.push(PROPS_ASSIGN, field, 0);
    } else if (mode === MODE_WHITESPACE && buffer && !field) {
      current.push(PROP_SET, 0, true, buffer);
    } else if (mode >= MODE_PROP_SET) {
      if (buffer || !field && mode === MODE_PROP_SET) {
        current.push(mode, 0, buffer, propName);
        mode = MODE_PROP_APPEND;
      }
      if (field) {
        current.push(mode, field, 0, propName);
        mode = MODE_PROP_APPEND;
      }
    }
    buffer = '';
  };
  for (let i = 0; i < statics.length; i++) {
    if (i) {
      if (mode === MODE_TEXT) {
        commit();
      }
      commit(i);
    }
    for (let j = 0; j < statics[i].length; j++) {
      char = statics[i][j];
      if (mode === MODE_TEXT) {
        if (char === '<') {
          commit();
          current = [current];
          mode = MODE_TAGNAME;
        } else {
          buffer += char;
        }
      } else if (mode === MODE_COMMENT) {
        if (buffer === '--' && char === '>') {
          mode = MODE_TEXT;
          buffer = '';
        } else {
          buffer = char + buffer[0];
        }
      } else if (quote) {
        if (char === quote) {
          quote = '';
        } else {
          buffer += char;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        commit();
        mode = MODE_TEXT;
      } else if (!mode) ; else if (char === '=') {
        mode = MODE_PROP_SET;
        propName = buffer;
        buffer = '';
      } else if (char === '/' && (mode < MODE_PROP_SET || statics[i][j + 1] === '>')) {
        commit();
        if (mode === MODE_TAGNAME) {
          current = current[0];
        }
        mode = current;
        (current = current[0]).push(CHILD_RECURSE, 0, mode);
        mode = MODE_SLASH;
      } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        // <a disabled>
        commit();
        mode = MODE_WHITESPACE;
      } else {
        buffer += char;
      }
      if (mode === MODE_TAGNAME && buffer === '!--') {
        mode = MODE_COMMENT;
        current = current[0];
      }
    }
  }
  commit();
  return current;
};

/**
 * @param {Babel} babel
 * @param {object} options
 * @param {string} [options.tag=html]  The tagged template "tag" function name to process.
 */

function strveBabelPlugin({
  types: t
}, options = {}) {
  function patternStringToRegExp(str) {
    const parts = str.split("/").slice(1);
    const end = parts.pop() || "";
    return new RegExp(parts.join("/"), end);
  }
  function propertyName(key) {
    if (t.isValidIdentifier(key)) {
      return t.identifier(key);
    }
    return t.stringLiteral(key);
  }
  function objectProperties(obj) {
    return Object.keys(obj).map(function (key) {
      const values = obj[key].map(function (valueOrNode) {
        return t.isNode(valueOrNode) ? valueOrNode : t.valueToNode(valueOrNode);
      });
      let node = values[0];
      if (values.length > 1 && !t.isStringLiteral(node) && !t.isStringLiteral(values[1])) {
        node = t.binaryExpression("+", t.stringLiteral(""), node);
      }
      values.slice(1).forEach(function (value) {
        node = t.binaryExpression("+", node, value);
      });
      return t.objectProperty(propertyName(key), node);
    });
  }
  function stringValue(str) {
    return t.stringLiteral(str);
  }
  function createVNode(tag, props, children) {
    if (children.elements.length === 1) {
      children = children.elements[0];
    } else if (children.elements.length === 0) {
      children = t.nullLiteral();
    }
    let key = null;
    if (props && props.properties && Array.isArray(props.properties)) {
      props.properties.forEach(item => {
        if (item.key.type === "StringLiteral" && item.key.value === "key") {
          key = item.value;
        } else if (item.key.type === "Identifier" && item.key.name === "key") {
          key = item.value;
        } else {
          key = t.nullLiteral();
        }
      });
    } else {
      key = t.nullLiteral();
    }
    return t.objectExpression([false, t.objectProperty(propertyName("tag"), tag), t.objectProperty(propertyName("props"), props), t.objectProperty(propertyName("children"), children), t.objectProperty(propertyName("key"), key), t.objectProperty(propertyName("el"), t.nullLiteral()), false].filter(Boolean));
  }
  function spreadNode(args, state) {
    if (args.length === 0) {
      return t.nullLiteral();
    }
    if (args.length > 0 && t.isNode(args[0])) {
      args.unshift({});
    } // 'Object.assign(x)', can be collapsed to 'x'.

    if (args.length === 1) {
      return propsNode(args[0]);
    } // 'Object.assign({}, x)', can be collapsed to 'x'.

    if (args.length === 2 && !t.isNode(args[0]) && Object.keys(args[0]).length === 0) {
      return propsNode(args[1]);
    }
    const helper = state.addHelper("extends");
    return t.callExpression(helper, args.map(propsNode));
  }
  function propsNode(props) {
    return t.isNode(props) ? props : t.objectExpression(objectProperties(props));
  }
  function transform(node, state) {
    if (t.isNode(node)) {
      return node;
    }
    if (typeof node === "string") {
      return stringValue(node);
    }
    if (typeof node === "undefined") {
      return t.identifier("undefined");
    }
    const {
      tag,
      props,
      children
    } = node;
    const newTag = typeof tag === "string" ? t.stringLiteral(tag) : tag;
    const newProps = spreadNode(props, state);
    const newChildren = t.arrayExpression(children.map(child => transform(child, state)));
    return createVNode(newTag, newProps, newChildren);
  }
  const tagName = options.tag || "html";
  return {
    name: "strve",
    visitor: {
      TaggedTemplateExpression(path, state) {
        const tag = path.node.tag.name;
        if (tagName[0] === "/" ? patternStringToRegExp(tagName).test(tag) : tag === tagName) {
          const statics = path.node.quasi.quasis.map(e => e.value.raw);
          const expr = path.node.quasi.expressions;
          const tree = treeify(build(statics), expr);
          const node = !Array.isArray(tree) ? transform(tree, state) : t.arrayExpression(tree.map(root => transform(root, state)));
          path.replaceWith(node);
        }
      },
      CallExpression(path, state) {
        const callee = path.node.callee;
        const args = path.node.arguments;
        const argsArr = Array.from(args);
        // The parameter is a template string
        if (callee.name === "tem_h") {
          const statics = argsArr[0].quasis.map(e => e.value.raw);
          const expr = argsArr[0].expressions;
          const tree = treeify(build(statics), expr);
          const node = !Array.isArray(tree) ? transform(tree, state) : t.arrayExpression(tree.map(root => transform(root, state)));
          path.replaceWith(node);
        }
        // The parameter is a regular string
        else if (callee.name === "str_h") {
          const statics = argsArr[0].extra.rawValue;
          const tree = treeify(build([statics]), []);
          const node = !Array.isArray(tree) ? transform(tree, state) : t.arrayExpression(tree.map(root => transform(root, state)));
          path.replaceWith(node);
        }
      }
    }
  };
}

export { strveBabelPlugin as default };
