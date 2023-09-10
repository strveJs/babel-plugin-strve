import { treeify, build } from "./compile.js";
/**
 * @param {Babel} babel
 * @param {object} options
 * @param {string} [options.tag=html]  The tagged template "tag" function name to process.
 */

export default function strveBabelPlugin({ types: t }, options = {}) {
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

      if (
        values.length > 1 &&
        !t.isStringLiteral(node) &&
        !t.isStringLiteral(values[1])
      ) {
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
      props.properties.forEach((item) => {
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

    return t.objectExpression(
      [
        false,
        t.objectProperty(propertyName("tag"), tag),
        t.objectProperty(propertyName("props"), props),
        t.objectProperty(propertyName("children"), children),
        t.objectProperty(propertyName("key"), key),
        t.objectProperty(propertyName("el"), t.nullLiteral()),
        false,
      ].filter(Boolean)
    );
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

    if (
      args.length === 2 &&
      !t.isNode(args[0]) &&
      Object.keys(args[0]).length === 0
    ) {
      return propsNode(args[1]);
    }

    const helper = state.addHelper("extends");
    return t.callExpression(helper, args.map(propsNode));
  }

  function propsNode(props) {
    return t.isNode(props)
      ? props
      : t.objectExpression(objectProperties(props));
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
    const { tag, props, children } = node;
    const newTag = typeof tag === "string" ? t.stringLiteral(tag) : tag;
    const newProps = spreadNode(props, state);
    const newChildren = t.arrayExpression(
      children.map((child) => transform(child, state))
    );
    return createVNode(newTag, newProps, newChildren);
  }

  const tagName = options.tag || "html";
  return {
    name: "strve",
    visitor: {
      TaggedTemplateExpression(path, state) {
        const tag = path.node.tag.name;
        if (
          tagName[0] === "/"
            ? patternStringToRegExp(tagName).test(tag)
            : tag === tagName
        ) {
          const statics = path.node.quasi.quasis.map((e) => e.value.raw);
          const expr = path.node.quasi.expressions;
          const tree = treeify(build(statics), expr);
          const node = !Array.isArray(tree)
            ? transform(tree, state)
            : t.arrayExpression(tree.map((root) => transform(root, state)));
          path.replaceWith(node);
        }
      },
      CallExpression(path, state) {
        const callee = path.node.callee;
        const args = path.node.arguments;
        const argsArr = Array.from(args);
        // The parameter is a template string
        if (callee.name === "tem_h") {
          const statics = argsArr[0].quasis.map((e) => e.value.raw);
          const expr = argsArr[0].expressions;
          const tree = treeify(build(statics), expr);
          const node = !Array.isArray(tree)
            ? transform(tree, state)
            : t.arrayExpression(tree.map((root) => transform(root, state)));
          path.replaceWith(node);
        }
        // The parameter is a regular string
        else if (callee.name === "str_h") {
          const statics = argsArr[0].extra.rawValue;
          const tree = treeify(build([statics]), []);
          const node = !Array.isArray(tree)
            ? transform(tree, state)
            : t.arrayExpression(tree.map((root) => transform(root, state)));
          path.replaceWith(node);
        }
      },
    },
  };
}
