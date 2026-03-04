#!/usr/bin/env bun
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to =
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true,
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => (all[name] = () => newValue),
    });
};
var __require = import.meta.require;

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/common.js
var require_common = __commonJS((exports, module) => {
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    var index, length, key, sourceKeys;
    if (source) {
      sourceKeys = Object.keys(source);
      for (index = 0, length = sourceKeys.length; index < length; index += 1) {
        key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    var result = "",
      cycle;
    for (cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  exports.isNothing = isNothing;
  exports.isObject = isObject;
  exports.toArray = toArray;
  exports.repeat = repeat;
  exports.isNegativeZero = isNegativeZero;
  exports.extend = extend;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/exception.js
var require_exception = __commonJS((exports, module) => {
  function YAMLException(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message =
      (this.reason || "(unknown reason)") + (this.mark ? " " + this.mark.toString() : "");
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException.prototype = Object.create(Error.prototype);
  YAMLException.prototype.constructor = YAMLException;
  YAMLException.prototype.toString = function toString(compact) {
    var result = this.name + ": ";
    result += this.reason || "(unknown reason)";
    if (!compact && this.mark) {
      result += " " + this.mark.toString();
    }
    return result;
  };
  module.exports = YAMLException;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/mark.js
var require_mark = __commonJS((exports, module) => {
  var common = require_common();
  function Mark(name, buffer, position, line, column) {
    this.name = name;
    this.buffer = buffer;
    this.position = position;
    this.line = line;
    this.column = column;
  }
  Mark.prototype.getSnippet = function getSnippet(indent, maxLength) {
    var head, start, tail, end, snippet;
    if (!this.buffer) return null;
    indent = indent || 4;
    maxLength = maxLength || 75;
    head = "";
    start = this.position;
    while (
      start > 0 &&
      `\x00\r
\x85\u2028\u2029`.indexOf(this.buffer.charAt(start - 1)) === -1
    ) {
      start -= 1;
      if (this.position - start > maxLength / 2 - 1) {
        head = " ... ";
        start += 5;
        break;
      }
    }
    tail = "";
    end = this.position;
    while (
      end < this.buffer.length &&
      `\x00\r
\x85\u2028\u2029`.indexOf(this.buffer.charAt(end)) === -1
    ) {
      end += 1;
      if (end - this.position > maxLength / 2 - 1) {
        tail = " ... ";
        end -= 5;
        break;
      }
    }
    snippet = this.buffer.slice(start, end);
    return (
      common.repeat(" ", indent) +
      head +
      snippet +
      tail +
      `
` +
      common.repeat(" ", indent + this.position - start + head.length) +
      "^"
    );
  };
  Mark.prototype.toString = function toString(compact) {
    var snippet,
      where = "";
    if (this.name) {
      where += 'in "' + this.name + '" ';
    }
    where += "at line " + (this.line + 1) + ", column " + (this.column + 1);
    if (!compact) {
      snippet = this.getSnippet();
      if (snippet) {
        where +=
          `:
` + snippet;
      }
    }
    return where;
  };
  module.exports = Mark;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type.js
var require_type = __commonJS((exports, module) => {
  var YAMLException = require_exception();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "defaultStyle",
    "styleAliases",
  ];
  var YAML_NODE_KINDS = ["scalar", "sequence", "mapping"];
  function compileStyleAliases(map) {
    var result = {};
    if (map !== null) {
      Object.keys(map).forEach(function (style) {
        map[style].forEach(function (alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function (name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException(
          'Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.',
        );
      }
    });
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve =
      options["resolve"] ||
      function () {
        return true;
      };
    this.construct =
      options["construct"] ||
      function (data) {
        return data;
      };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException(
        'Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.',
      );
    }
  }
  module.exports = Type;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema.js
var require_schema = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var Type = require_type();
  function compileList(schema, name, result) {
    var exclude = [];
    schema.include.forEach(function (includedSchema) {
      result = compileList(includedSchema, name, result);
    });
    schema[name].forEach(function (currentType) {
      result.forEach(function (previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind) {
          exclude.push(previousIndex);
        }
      });
      result.push(currentType);
    });
    return result.filter(function (type, index) {
      return exclude.indexOf(index) === -1;
    });
  }
  function compileMap() {
    var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
      },
      index,
      length;
    function collectType(type) {
      result[type.kind][type.tag] = result["fallback"][type.tag] = type;
    }
    for (index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema(definition) {
    this.include = definition.include || [];
    this.implicit = definition.implicit || [];
    this.explicit = definition.explicit || [];
    this.implicit.forEach(function (type) {
      if (type.loadKind && type.loadKind !== "scalar") {
        throw new YAMLException(
          "There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.",
        );
      }
    });
    this.compiledImplicit = compileList(this, "implicit", []);
    this.compiledExplicit = compileList(this, "explicit", []);
    this.compiledTypeMap = compileMap(this.compiledImplicit, this.compiledExplicit);
  }
  Schema.DEFAULT = null;
  Schema.create = function createSchema() {
    var schemas, types2;
    switch (arguments.length) {
      case 1:
        schemas = Schema.DEFAULT;
        types2 = arguments[0];
        break;
      case 2:
        schemas = arguments[0];
        types2 = arguments[1];
        break;
      default:
        throw new YAMLException("Wrong number of arguments for Schema.create function");
    }
    schemas = common.toArray(schemas);
    types2 = common.toArray(types2);
    if (
      !schemas.every(function (schema) {
        return schema instanceof Schema;
      })
    ) {
      throw new YAMLException(
        "Specified list of super schemas (or a single Schema object) contains a non-Schema object.",
      );
    }
    if (
      !types2.every(function (type) {
        return type instanceof Type;
      })
    ) {
      throw new YAMLException(
        "Specified list of YAML types (or a single Type object) contains a non-Type object.",
      );
    }
    return new Schema({
      include: schemas,
      explicit: types2,
    });
  };
  module.exports = Schema;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/str.js
var require_str = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function (data) {
      return data !== null ? data : "";
    },
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/seq.js
var require_seq = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function (data) {
      return data !== null ? data : [];
    },
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/map.js
var require_map = __commonJS((exports, module) => {
  var Type = require_type();
  module.exports = new Type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function (data) {
      return data !== null ? data : {};
    },
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema/failsafe.js
var require_failsafe = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    explicit: [require_str(), require_seq(), require_map()],
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/null.js
var require_null = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlNull(data) {
    if (data === null) return true;
    var max = data.length;
    return (
      (max === 1 && data === "~") ||
      (max === 4 && (data === "null" || data === "Null" || data === "NULL"))
    );
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module.exports = new Type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function () {
        return "~";
      },
      lowercase: function () {
        return "null";
      },
      uppercase: function () {
        return "NULL";
      },
      camelcase: function () {
        return "Null";
      },
    },
    defaultStyle: "lowercase",
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/bool.js
var require_bool = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    var max = data.length;
    return (
      (max === 4 && (data === "true" || data === "True" || data === "TRUE")) ||
      (max === 5 && (data === "false" || data === "False" || data === "FALSE"))
    );
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  module.exports = new Type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function (object) {
        return object ? "true" : "false";
      },
      uppercase: function (object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function (object) {
        return object ? "True" : "False";
      },
    },
    defaultStyle: "lowercase",
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/int.js
var require_int = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  function isHexCode(c) {
    return (48 <= c && c <= 57) || (65 <= c && c <= 70) || (97 <= c && c <= 102);
  }
  function isOctCode(c) {
    return 48 <= c && c <= 55;
  }
  function isDecCode(c) {
    return 48 <= c && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    var max = data.length,
      index = 0,
      hasDigits = false,
      ch;
    if (!max) return false;
    ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch === "_") continue;
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch === "_") continue;
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "_") return false;
    for (; index < max; index++) {
      ch = data[index];
      if (ch === "_") continue;
      if (ch === ":") break;
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits || ch === "_") return false;
    if (ch !== ":") return true;
    return /^(:[0-5]?[0-9])+$/.test(data.slice(index));
  }
  function constructYamlInteger(data) {
    var value = data,
      sign = 1,
      ch,
      base,
      digits = [];
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value, 16);
      return sign * parseInt(value, 8);
    }
    if (value.indexOf(":") !== -1) {
      value.split(":").forEach(function (v) {
        digits.unshift(parseInt(v, 10));
      });
      value = 0;
      base = 1;
      digits.forEach(function (d) {
        value += d * base;
        base *= 60;
      });
      return sign * value;
    }
    return sign * parseInt(value, 10);
  }
  function isInteger(object) {
    return (
      Object.prototype.toString.call(object) === "[object Number]" &&
      object % 1 === 0 &&
      !common.isNegativeZero(object)
    );
  }
  module.exports = new Type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function (obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function (obj) {
        return obj >= 0 ? "0" + obj.toString(8) : "-0" + obj.toString(8).slice(1);
      },
      decimal: function (obj) {
        return obj.toString(10);
      },
      hexadecimal: function (obj) {
        return obj >= 0
          ? "0x" + obj.toString(16).toUpperCase()
          : "-0x" + obj.toString(16).toUpperCase().slice(1);
      },
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"],
    },
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/float.js
var require_float = __commonJS((exports, module) => {
  var common = require_common();
  var Type = require_type();
  var YAML_FLOAT_PATTERN = new RegExp(
    "^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?" +
      "|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?" +
      "|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*" +
      "|[-+]?\\.(?:inf|Inf|INF)" +
      "|\\.(?:nan|NaN|NAN))$",
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") {
      return false;
    }
    return true;
  }
  function constructYamlFloat(data) {
    var value, sign, base, digits;
    value = data.replace(/_/g, "").toLowerCase();
    sign = value[0] === "-" ? -1 : 1;
    digits = [];
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    } else if (value.indexOf(":") >= 0) {
      value.split(":").forEach(function (v) {
        digits.unshift(parseFloat(v, 10));
      });
      value = 0;
      base = 1;
      digits.forEach(function (d) {
        value += d * base;
        base *= 60;
      });
      return sign * value;
    }
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common.isNegativeZero(object)) {
      return "-0.0";
    }
    res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return (
      Object.prototype.toString.call(object) === "[object Number]" &&
      (object % 1 !== 0 || common.isNegativeZero(object))
    );
  }
  module.exports = new Type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase",
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema/json.js
var require_json = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    include: [require_failsafe()],
    implicit: [require_null(), require_bool(), require_int(), require_float()],
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema/core.js
var require_core = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    include: [require_json()],
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/timestamp.js
var require_timestamp = __commonJS((exports, module) => {
  var Type = require_type();
  var YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9])" + "-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])" +
      "-([0-9][0-9]?)" +
      "-([0-9][0-9]?)" +
      "(?:[Tt]|[ \\t]+)" +
      "([0-9][0-9]?)" +
      ":([0-9][0-9])" +
      ":([0-9][0-9])" +
      "(?:\\.([0-9]*))?" +
      "(?:[ \\t]*(Z|([-+])([0-9][0-9]?)" +
      "(?::([0-9][0-9]))?))?$",
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    var match,
      year,
      month,
      day,
      hour,
      minute,
      second,
      fraction = 0,
      delta = null,
      tz_hour,
      tz_minute,
      date;
    match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    year = +match[1];
    month = +match[2] - 1;
    day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    hour = +match[4];
    minute = +match[5];
    second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      tz_hour = +match[10];
      tz_minute = +(match[11] || 0);
      delta = (tz_hour * 60 + tz_minute) * 60000;
      if (match[9] === "-") delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module.exports = new Type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/merge.js
var require_merge = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  module.exports = new Type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/binary.js
var require_binary = __commonJS((exports, module) => {
  var NodeBuffer;
  try {
    _require = __require;
    NodeBuffer = _require("buffer").Buffer;
  } catch (__) {}
  var _require;
  var Type = require_type();
  var BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function resolveYamlBinary(data) {
    if (data === null) return false;
    var code,
      idx,
      bitlen = 0,
      max = data.length,
      map = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      code = map.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    var idx,
      tailbits,
      input = data.replace(/[\r\n=]/g, ""),
      max = input.length,
      map = BASE64_MAP,
      bits = 0,
      result = [];
    for (idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push((bits >> 16) & 255);
        result.push((bits >> 8) & 255);
        result.push(bits & 255);
      }
      bits = (bits << 6) | map.indexOf(input.charAt(idx));
    }
    tailbits = (max % 4) * 6;
    if (tailbits === 0) {
      result.push((bits >> 16) & 255);
      result.push((bits >> 8) & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push((bits >> 10) & 255);
      result.push((bits >> 2) & 255);
    } else if (tailbits === 12) {
      result.push((bits >> 4) & 255);
    }
    if (NodeBuffer) {
      return NodeBuffer.from ? NodeBuffer.from(result) : new NodeBuffer(result);
    }
    return result;
  }
  function representYamlBinary(object) {
    var result = "",
      bits = 0,
      idx,
      tail,
      max = object.length,
      map = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[(bits >> 18) & 63];
        result += map[(bits >> 12) & 63];
        result += map[(bits >> 6) & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    tail = max % 3;
    if (tail === 0) {
      result += map[(bits >> 18) & 63];
      result += map[(bits >> 12) & 63];
      result += map[(bits >> 6) & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[(bits >> 10) & 63];
      result += map[(bits >> 4) & 63];
      result += map[(bits << 2) & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[(bits >> 2) & 63];
      result += map[(bits << 4) & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(object) {
    return NodeBuffer && NodeBuffer.isBuffer(object);
  }
  module.exports = new Type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/omap.js
var require_omap = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    var objectKeys = [],
      index,
      length,
      pair,
      pairKey,
      pairHasKey,
      object = data;
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
      else return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module.exports = new Type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/pairs.js
var require_pairs = __commonJS((exports, module) => {
  var Type = require_type();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    var index,
      length,
      pair,
      keys,
      result,
      object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    var index,
      length,
      pair,
      keys,
      result,
      object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module.exports = new Type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/set.js
var require_set = __commonJS((exports, module) => {
  var Type = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    var key,
      object = data;
    for (key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module.exports = new Type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema/default_safe.js
var require_default_safe = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = new Schema({
    include: [require_core()],
    implicit: [require_timestamp(), require_merge()],
    explicit: [require_binary(), require_omap(), require_pairs(), require_set()],
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/js/undefined.js
var require_undefined = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveJavascriptUndefined() {
    return true;
  }
  function constructJavascriptUndefined() {
    return;
  }
  function representJavascriptUndefined() {
    return "";
  }
  function isUndefined(object) {
    return typeof object === "undefined";
  }
  module.exports = new Type("tag:yaml.org,2002:js/undefined", {
    kind: "scalar",
    resolve: resolveJavascriptUndefined,
    construct: constructJavascriptUndefined,
    predicate: isUndefined,
    represent: representJavascriptUndefined,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/js/regexp.js
var require_regexp = __commonJS((exports, module) => {
  var Type = require_type();
  function resolveJavascriptRegExp(data) {
    if (data === null) return false;
    if (data.length === 0) return false;
    var regexp = data,
      tail = /\/([gim]*)$/.exec(data),
      modifiers = "";
    if (regexp[0] === "/") {
      if (tail) modifiers = tail[1];
      if (modifiers.length > 3) return false;
      if (regexp[regexp.length - modifiers.length - 1] !== "/") return false;
    }
    return true;
  }
  function constructJavascriptRegExp(data) {
    var regexp = data,
      tail = /\/([gim]*)$/.exec(data),
      modifiers = "";
    if (regexp[0] === "/") {
      if (tail) modifiers = tail[1];
      regexp = regexp.slice(1, regexp.length - modifiers.length - 1);
    }
    return new RegExp(regexp, modifiers);
  }
  function representJavascriptRegExp(object) {
    var result = "/" + object.source + "/";
    if (object.global) result += "g";
    if (object.multiline) result += "m";
    if (object.ignoreCase) result += "i";
    return result;
  }
  function isRegExp(object) {
    return Object.prototype.toString.call(object) === "[object RegExp]";
  }
  module.exports = new Type("tag:yaml.org,2002:js/regexp", {
    kind: "scalar",
    resolve: resolveJavascriptRegExp,
    construct: constructJavascriptRegExp,
    predicate: isRegExp,
    represent: representJavascriptRegExp,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/type/js/function.js
var require_function = __commonJS((exports, module) => {
  var esprima;
  try {
    _require = __require;
    esprima = _require("esprima");
  } catch (_) {
    if (typeof window !== "undefined") esprima = window.esprima;
  }
  var _require;
  var Type = require_type();
  function resolveJavascriptFunction(data) {
    if (data === null) return false;
    try {
      var source = "(" + data + ")",
        ast = esprima.parse(source, { range: true });
      if (
        ast.type !== "Program" ||
        ast.body.length !== 1 ||
        ast.body[0].type !== "ExpressionStatement" ||
        (ast.body[0].expression.type !== "ArrowFunctionExpression" &&
          ast.body[0].expression.type !== "FunctionExpression")
      ) {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }
  function constructJavascriptFunction(data) {
    var source = "(" + data + ")",
      ast = esprima.parse(source, { range: true }),
      params = [],
      body;
    if (
      ast.type !== "Program" ||
      ast.body.length !== 1 ||
      ast.body[0].type !== "ExpressionStatement" ||
      (ast.body[0].expression.type !== "ArrowFunctionExpression" &&
        ast.body[0].expression.type !== "FunctionExpression")
    ) {
      throw new Error("Failed to resolve function");
    }
    ast.body[0].expression.params.forEach(function (param) {
      params.push(param.name);
    });
    body = ast.body[0].expression.body.range;
    if (ast.body[0].expression.body.type === "BlockStatement") {
      return new Function(params, source.slice(body[0] + 1, body[1] - 1));
    }
    return new Function(params, "return " + source.slice(body[0], body[1]));
  }
  function representJavascriptFunction(object) {
    return object.toString();
  }
  function isFunction(object) {
    return Object.prototype.toString.call(object) === "[object Function]";
  }
  module.exports = new Type("tag:yaml.org,2002:js/function", {
    kind: "scalar",
    resolve: resolveJavascriptFunction,
    construct: constructJavascriptFunction,
    predicate: isFunction,
    represent: representJavascriptFunction,
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/schema/default_full.js
var require_default_full = __commonJS((exports, module) => {
  var Schema = require_schema();
  module.exports = Schema.DEFAULT = new Schema({
    include: [require_default_safe()],
    explicit: [require_undefined(), require_regexp(), require_function()],
  });
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/loader.js
var require_loader = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var Mark = require_mark();
  var DEFAULT_SAFE_SCHEMA = require_default_safe();
  var DEFAULT_FULL_SCHEMA = require_default_full();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE =
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,[\]{}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z-]+!)$/i;
  var PATTERN_TAG_URI = /^(?:!|[^,[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function is_EOL(c) {
    return c === 10 || c === 13;
  }
  function is_WHITE_SPACE(c) {
    return c === 9 || c === 32;
  }
  function is_WS_OR_EOL(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function is_FLOW_INDICATOR(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    var lc;
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    lc = c | 32;
    if (97 <= lc && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    return c === 48
      ? "\x00"
      : c === 97
        ? "\x07"
        : c === 98
          ? "\b"
          : c === 116
            ? "\t"
            : c === 9
              ? "\t"
              : c === 110
                ? `
`
                : c === 118
                  ? "\v"
                  : c === 102
                    ? "\f"
                    : c === 114
                      ? "\r"
                      : c === 101
                        ? "\x1B"
                        : c === 32
                          ? " "
                          : c === 34
                            ? '"'
                            : c === 47
                              ? "/"
                              : c === 92
                                ? "\\"
                                : c === 78
                                  ? "\x85"
                                  : c === 95
                                    ? "\xA0"
                                    : c === 76
                                      ? "\u2028"
                                      : c === 80
                                        ? "\u2029"
                                        : "";
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(((c - 65536) >> 10) + 55296, ((c - 65536) & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
    } else {
      object[key] = value;
    }
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  var i;
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_FULL_SCHEMA;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.documents = [];
  }
  function generateError(state, message) {
    return new YAMLException(
      message,
      new Mark(
        state.filename,
        state.input,
        state.position,
        state.line,
        state.position - state.lineStart,
      ),
    );
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      state.tagMap[handle] = prefix;
    },
  };
  function captureSegment(state, start, end, checkJson) {
    var _position, _length, _character, _result;
    if (start < end) {
      _result = state.input.slice(start, end);
      if (checkJson) {
        for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
          _character = _result.charCodeAt(_position);
          if (!(_character === 9 || (32 <= _character && _character <= 1114111))) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key, index, quantity;
    if (!common.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    sourceKeys = Object.keys(source);
    for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      key = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(
    state,
    _result,
    overridableKeys,
    keyTag,
    keyNode,
    valueNode,
    startLine,
    startPos,
  ) {
    var index, quantity;
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (
        !state.json &&
        !_hasOwnProperty.call(overridableKeys, keyNode) &&
        _hasOwnProperty.call(_result, keyNode)
      ) {
        state.line = startLine || state.line;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0,
      ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (is_EOL(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    var _position = state.position,
      ch;
    ch = state.input.charCodeAt(_position);
    if (
      (ch === 45 || ch === 46) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)
    ) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || is_WS_OR_EOL(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common.repeat(
        `
`,
        count - 1,
      );
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding,
      following,
      captureStart,
      captureEnd,
      hasPendingContent,
      _line,
      _lineStart,
      _lineIndent,
      _kind = state.kind,
      _result = state.result,
      ch;
    ch = state.input.charCodeAt(state.position);
    if (
      is_WS_OR_EOL(ch) ||
      is_FLOW_INDICATOR(ch) ||
      ch === 35 ||
      ch === 38 ||
      ch === 42 ||
      ch === 33 ||
      ch === 124 ||
      ch === 62 ||
      ch === 39 ||
      ch === 34 ||
      ch === 37 ||
      ch === 64 ||
      ch === 96
    ) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || (withinFlowCollection && is_FLOW_INDICATOR(following))) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || (withinFlowCollection && is_FLOW_INDICATOR(following))) {
          break;
        }
      } else if (ch === 35) {
        preceding = state.input.charCodeAt(state.position - 1);
        if (is_WS_OR_EOL(preceding)) {
          break;
        }
      } else if (
        (state.position === state.lineStart && testDocumentSeparator(state)) ||
        (withinFlowCollection && is_FLOW_INDICATOR(ch))
      ) {
        break;
      } else if (is_EOL(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!is_WHITE_SPACE(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (is_EOL(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          hexLength = tmp;
          hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    var readNext = true,
      _line,
      _tag = state.tag,
      _result,
      _anchor = state.anchor,
      following,
      terminator,
      isPair,
      isExplicitPair,
      isMapping,
      overridableKeys = {},
      keyNode,
      keyTag,
      valueNode,
      ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    var captureStart,
      folding,
      chomping = CHOMPING_CLIP,
      didReadContent = false,
      detectedIndent = false,
      textIndent = nodeIndent,
      emptyLines = 0,
      atMoreIndented = false,
      tmp,
      ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(
            state,
            "bad explicit indentation width of a block scalar; it cannot be less than one",
          );
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (is_WHITE_SPACE(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (is_WHITE_SPACE(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!is_EOL(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (is_EOL(ch)) {
        emptyLines++;
        continue;
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common.repeat(
            `
`,
            didReadContent ? 1 + emptyLines : emptyLines,
          );
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += `
`;
          }
        }
        break;
      }
      if (folding) {
        if (is_WHITE_SPACE(ch)) {
          atMoreIndented = true;
          state.result += common.repeat(
            `
`,
            didReadContent ? 1 + emptyLines : emptyLines,
          );
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common.repeat(
            `
`,
            emptyLines + 1,
          );
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common.repeat(
            `
`,
            emptyLines,
          );
        }
      } else {
        state.result += common.repeat(
          `
`,
          didReadContent ? 1 + emptyLines : emptyLines,
        );
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      captureStart = state.position;
      while (!is_EOL(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    var _line,
      _tag = state.tag,
      _anchor = state.anchor,
      _result = [],
      following,
      detected = false,
      ch;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (ch !== 45) {
        break;
      }
      following = state.input.charCodeAt(state.position + 1);
      if (!is_WS_OR_EOL(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    var following,
      allowCompact,
      _line,
      _pos,
      _tag = state.tag,
      _anchor = state.anchor,
      _result = {},
      overridableKeys = {},
      keyTag = null,
      keyNode = null,
      valueNode = null,
      atExplicitKey = false,
      detected = false,
      ch;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      following = state.input.charCodeAt(state.position + 1);
      _line = state.line;
      _pos = state.position;
      if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(
            state,
            "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line",
          );
        }
        state.position += 1;
        ch = following;
      } else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!is_WS_OR_EOL(ch)) {
              throwError(
                state,
                "a whitespace character is expected after the key-value separator within a block mapping",
              );
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(
            state,
            "can not read a block mapping entry; a multiline key may not be an implicit key",
          );
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else {
        break;
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(
            state,
            _result,
            overridableKeys,
            keyTag,
            keyNode,
            valueNode,
            _line,
            _pos,
          );
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if (state.lineIndent > nodeIndent && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    var _position,
      isVerbatim = false,
      isNamed = false,
      tagHandle,
      tagName,
      ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles,
      allowBlockScalars,
      allowBlockCollections,
      indentStatus = 1,
      atNewLine = false,
      hasContent = false,
      typeIndex,
      typeQuantity,
      type,
      flowIndent,
      blockIndent;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles =
      allowBlockScalars =
      allowBlockCollections =
        CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (readTagProperty(state) || readAnchorProperty(state)) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (
          (allowBlockCollections &&
            (readBlockSequence(state, blockIndent) ||
              readBlockMapping(state, blockIndent, flowIndent))) ||
          readFlowCollection(state, flowIndent)
        ) {
          hasContent = true;
        } else {
          if (
            (allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)
          ) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag !== null && state.tag !== "!") {
      if (state.tag === "?") {
        if (state.result !== null && state.kind !== "scalar") {
          throwError(
            state,
            'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"',
          );
        }
        for (
          typeIndex = 0, typeQuantity = state.implicitTypes.length;
          typeIndex < typeQuantity;
          typeIndex += 1
        ) {
          type = state.implicitTypes[typeIndex];
          if (type.resolve(state.result)) {
            state.result = type.construct(state.result);
            state.tag = type.tag;
            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
            break;
          }
        }
      } else if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type = state.typeMap[state.kind || "fallback"][state.tag];
        if (state.result !== null && type.kind !== state.kind) {
          throwError(
            state,
            "unacceptable node kind for !<" +
              state.tag +
              '> tag; it should be "' +
              type.kind +
              '", not "' +
              state.kind +
              '"',
          );
        }
        if (!type.resolve(state.result)) {
          throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
        } else {
          state.result = type.construct(state.result);
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    var documentStart = state.position,
      _position,
      directiveName,
      directiveArgs,
      hasDirectives = false,
      ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = {};
    state.anchorMap = {};
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveName = state.input.slice(_position, state.position);
      directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !is_EOL(ch));
          break;
        }
        if (is_EOL(ch)) break;
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (
      state.lineIndent === 0 &&
      state.input.charCodeAt(state.position) === 45 &&
      state.input.charCodeAt(state.position + 1) === 45 &&
      state.input.charCodeAt(state.position + 2) === 45
    ) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (
      state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))
    ) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    } else {
      return;
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += `
`;
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    var state = new State(input, options);
    var nullpos = input.indexOf("\x00");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\x00";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    var documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (var index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load(input, options) {
    var documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  function safeLoadAll(input, iterator, options) {
    if (typeof iterator === "object" && iterator !== null && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    return loadAll(input, iterator, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
  }
  function safeLoad(input, options) {
    return load(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
  }
  exports.loadAll = loadAll;
  exports.load = load;
  exports.safeLoadAll = safeLoadAll;
  exports.safeLoad = safeLoad;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml/dumper.js
var require_dumper = __commonJS((exports, module) => {
  var common = require_common();
  var YAMLException = require_exception();
  var DEFAULT_FULL_SCHEMA = require_default_full();
  var DEFAULT_SAFE_SCHEMA = require_default_safe();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF",
  ];
  function compileStyleMap(schema, map) {
    var result, keys, index, length, tag, style, type;
    if (map === null) return {};
    result = {};
    keys = Object.keys(map);
    for (index = 0, length = keys.length; index < length; index += 1) {
      tag = keys[index];
      style = String(map[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      type = schema.compiledTypeMap["fallback"][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) {
        style = type.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    var string, handle, length;
    string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common.repeat("0", length - string.length) + string;
  }
  function State(options) {
    this.schema = options["schema"] || DEFAULT_FULL_SCHEMA;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    var ind = common.repeat(" ", spaces),
      position = 0,
      next = -1,
      result = "",
      line,
      length = string.length;
    while (position < length) {
      next = string.indexOf(
        `
`,
        position,
      );
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (
        line.length &&
        line !==
          `
`
      )
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return (
      `
` + common.repeat(" ", state.indent * level)
    );
  }
  function testImplicitResolving(state, str) {
    var index, length, type;
    for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      type = state.implicitTypes[index];
      if (type.resolve(str)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return (
      (32 <= c && c <= 126) ||
      (161 <= c && c <= 55295 && c !== 8232 && c !== 8233) ||
      (57344 <= c && c <= 65533 && c !== 65279) ||
      (65536 <= c && c <= 1114111)
    );
  }
  function isNsChar(c) {
    return (
      isPrintable(c) &&
      !isWhitespace(c) &&
      c !== 65279 &&
      c !== CHAR_CARRIAGE_RETURN &&
      c !== CHAR_LINE_FEED
    );
  }
  function isPlainSafe(c, prev) {
    return (
      isPrintable(c) &&
      c !== 65279 &&
      c !== CHAR_COMMA &&
      c !== CHAR_LEFT_SQUARE_BRACKET &&
      c !== CHAR_RIGHT_SQUARE_BRACKET &&
      c !== CHAR_LEFT_CURLY_BRACKET &&
      c !== CHAR_RIGHT_CURLY_BRACKET &&
      c !== CHAR_COLON &&
      (c !== CHAR_SHARP || (prev && isNsChar(prev)))
    );
  }
  function isPlainSafeFirst(c) {
    return (
      isPrintable(c) &&
      c !== 65279 &&
      !isWhitespace(c) &&
      c !== CHAR_MINUS &&
      c !== CHAR_QUESTION &&
      c !== CHAR_COLON &&
      c !== CHAR_COMMA &&
      c !== CHAR_LEFT_SQUARE_BRACKET &&
      c !== CHAR_RIGHT_SQUARE_BRACKET &&
      c !== CHAR_LEFT_CURLY_BRACKET &&
      c !== CHAR_RIGHT_CURLY_BRACKET &&
      c !== CHAR_SHARP &&
      c !== CHAR_AMPERSAND &&
      c !== CHAR_ASTERISK &&
      c !== CHAR_EXCLAMATION &&
      c !== CHAR_VERTICAL_LINE &&
      c !== CHAR_EQUALS &&
      c !== CHAR_GREATER_THAN &&
      c !== CHAR_SINGLE_QUOTE &&
      c !== CHAR_DOUBLE_QUOTE &&
      c !== CHAR_PERCENT &&
      c !== CHAR_COMMERCIAL_AT &&
      c !== CHAR_GRAVE_ACCENT
    );
  }
  function needIndentIndicator(string) {
    var leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType) {
    var i;
    var char, prev_char;
    var hasLineBreak = false;
    var hasFoldableLine = false;
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1;
    var plain =
      isPlainSafeFirst(string.charCodeAt(0)) && !isWhitespace(string.charCodeAt(string.length - 1));
    if (singleLineOnly) {
      for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
        plain = plain && isPlainSafe(char, prev_char);
      }
    } else {
      for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine =
              hasFoldableLine ||
              (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
        plain = plain && isPlainSafe(char, prev_char);
      }
      hasFoldableLine =
        hasFoldableLine ||
        (shouldTrackWidth &&
          i - previousLineBreak - 1 > lineWidth &&
          string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      return plain && !testAmbiguousType(string) ? STYLE_PLAIN : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  function writeScalar(state, string, level, iskey) {
    state.dump = (function () {
      if (string.length === 0) {
        return "''";
      }
      if (!state.noCompatMode && DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1) {
        return "'" + string + "'";
      }
      var indent = state.indent * Math.max(1, level);
      var lineWidth =
        state.lineWidth === -1
          ? -1
          : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      var singleLineOnly = iskey || (state.flowLevel > -1 && level >= state.flowLevel);
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return (
            "|" +
            blockHeader(string, state.indent) +
            dropEndingNewline(indentString(string, indent))
          );
        case STYLE_FOLDED:
          return (
            ">" +
            blockHeader(string, state.indent) +
            dropEndingNewline(indentString(foldString(string, lineWidth), indent))
          );
        case STYLE_DOUBLE:
          return '"' + escapeString(string, lineWidth) + '"';
        default:
          throw new YAMLException("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    var clip =
      string[string.length - 1] ===
      `
`;
    var keep =
      clip &&
      (string[string.length - 2] ===
        `
` ||
        string ===
          `
`);
    var chomp = keep ? "+" : clip ? "" : "-";
    return (
      indentIndicator +
      chomp +
      `
`
    );
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] ===
      `
`
      ? string.slice(0, -1)
      : string;
  }
  function foldString(string, width) {
    var lineRe = /(\n+)([^\n]*)/g;
    var result = (function () {
      var nextLF = string.indexOf(`
`);
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    var prevMoreIndented =
      string[0] ===
        `
` || string[0] === " ";
    var moreIndented;
    var match;
    while ((match = lineRe.exec(string))) {
      var prefix = match[1],
        line = match[2];
      moreIndented = line[0] === " ";
      result +=
        prefix +
        (!prevMoreIndented && !moreIndented && line !== ""
          ? `
`
          : "") +
        foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    var breakRe = / [^ ]/g;
    var match;
    var start = 0,
      end,
      curr = 0,
      next = 0;
    var result = "";
    while ((match = breakRe.exec(line))) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result +=
          `
` + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += `
`;
    if (line.length - start > width && curr > start) {
      result +=
        line.slice(start, curr) +
        `
` +
        line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    var result = "";
    var char, nextChar;
    var escapeSeq;
    for (var i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (char >= 55296 && char <= 56319) {
        nextChar = string.charCodeAt(i + 1);
        if (nextChar >= 56320 && nextChar <= 57343) {
          result += encodeHex((char - 55296) * 1024 + nextChar - 56320 + 65536);
          i++;
          continue;
        }
      }
      escapeSeq = ESCAPE_SEQUENCES[char];
      result += !escapeSeq && isPrintable(char) ? string[i] : escapeSeq || encodeHex(char);
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    var _result = "",
      _tag = state.tag,
      index,
      length;
    for (index = 0, length = object.length; index < length; index += 1) {
      if (writeNode(state, level, object[index], false, false)) {
        if (index !== 0) _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    var _result = "",
      _tag = state.tag,
      index,
      length;
    for (index = 0, length = object.length; index < length; index += 1) {
      if (writeNode(state, level + 1, object[index], true, true)) {
        if (!compact || index !== 0) {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    var _result = "",
      _tag = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      pairBuffer;
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
      pairBuffer = "";
      if (index !== 0) pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer +=
        state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    var _result = "",
      _tag = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      explicitPair,
      pairBuffer;
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException("sortKeys must be a boolean or a function");
    }
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
      pairBuffer = "";
      if (!compact || index !== 0) {
        pairBuffer += generateNextLine(state, level);
      }
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      explicitPair =
        (state.tag !== null && state.tag !== "?") || (state.dump && state.dump.length > 1024);
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    var _result, typeList, index, length, type, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index = 0, length = typeList.length; index < length; index += 1) {
      type = typeList[index];
      if (
        (type.instanceOf || type.predicate) &&
        (!type.instanceOf || (typeof object === "object" && object instanceof type.instanceOf)) &&
        (!type.predicate || type.predicate(object))
      ) {
        state.tag = explicit ? type.tag : "?";
        if (type.represent) {
          style = state.styleMap[type.tag] || type.defaultStyle;
          if (_toString.call(type.represent) === "[object Function]") {
            _result = type.represent(object, style);
          } else if (_hasOwnProperty.call(type.represent, style)) {
            _result = type.represent[style](object, style);
          } else {
            throw new YAMLException(
              "!<" + type.tag + '> tag resolver accepts not "' + style + '" style',
            );
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    var type = _toString.call(state.dump);
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    var objectOrArray = type === "[object Object]" || type === "[object Array]",
      duplicateIndex,
      duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (
      (state.tag !== null && state.tag !== "?") ||
      duplicate ||
      (state.indent !== 2 && level > 0)
    ) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object Array]") {
        var arrayLevel = state.noArrayIndent && level > 0 ? level - 1 : level;
        if (block && state.dump.length !== 0) {
          writeBlockSequence(state, arrayLevel, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, arrayLevel, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey);
        }
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException("unacceptable kind of an object to dump " + type);
      }
      if (state.tag !== null && state.tag !== "?") {
        state.dump = "!<" + state.tag + "> " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    var objects = [],
      duplicatesIndexes = [],
      index,
      length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index, length;
    if (object !== null && typeof object === "object") {
      index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (index = 0, length = object.length; index < length; index += 1) {
            inspectNode(object[index], objects, duplicatesIndexes);
          }
        } else {
          objectKeyList = Object.keys(object);
          for (index = 0, length = objectKeyList.length; index < length; index += 1) {
            inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump(input, options) {
    options = options || {};
    var state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    if (writeNode(state, 0, input, true, true))
      return (
        state.dump +
        `
`
      );
    return "";
  }
  function safeDump(input, options) {
    return dump(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
  }
  exports.dump = dump;
  exports.safeDump = safeDump;
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/lib/js-yaml.js
var require_js_yaml = __commonJS((exports, module) => {
  var loader = require_loader();
  var dumper = require_dumper();
  function deprecated(name) {
    return function () {
      throw new Error("Function " + name + " is deprecated and cannot be used.");
    };
  }
  exports.Type = require_type();
  exports.Schema = require_schema();
  exports.FAILSAFE_SCHEMA = require_failsafe();
  exports.JSON_SCHEMA = require_json();
  exports.CORE_SCHEMA = require_core();
  exports.DEFAULT_SAFE_SCHEMA = require_default_safe();
  exports.DEFAULT_FULL_SCHEMA = require_default_full();
  exports.load = loader.load;
  exports.loadAll = loader.loadAll;
  exports.safeLoad = loader.safeLoad;
  exports.safeLoadAll = loader.safeLoadAll;
  exports.dump = dumper.dump;
  exports.safeDump = dumper.safeDump;
  exports.YAMLException = require_exception();
  exports.MINIMAL_SCHEMA = require_failsafe();
  exports.SAFE_SCHEMA = require_default_safe();
  exports.DEFAULT_SCHEMA = require_default_full();
  exports.scan = deprecated("scan");
  exports.parse = deprecated("parse");
  exports.compose = deprecated("compose");
  exports.addConstructor = deprecated("addConstructor");
});

// node_modules/.bun/js-yaml@3.14.2/node_modules/js-yaml/index.js
var require_js_yaml2 = __commonJS((exports, module) => {
  var yaml = require_js_yaml();
  module.exports = yaml;
});

// node_modules/.bun/front-matter@4.0.2/node_modules/front-matter/index.js
var require_front_matter = __commonJS((exports, module) => {
  var parser = require_js_yaml2();
  var optionalByteOrderMark = "\\ufeff?";
  var platform = typeof process !== "undefined" ? process.platform : "";
  var pattern =
    "^(" +
    optionalByteOrderMark +
    "(= yaml =|---)" +
    "$([\\s\\S]*?)" +
    "^(?:\\2|\\.\\.\\.)\\s*" +
    "$" +
    (platform === "win32" ? "\\r?" : "") +
    "(?:\\n)?)";
  var regex = new RegExp(pattern, "m");
  module.exports = extractor;
  module.exports.test = test;
  function extractor(string, options) {
    string = string || "";
    var defaultOptions = { allowUnsafe: false };
    options = options instanceof Object ? { ...defaultOptions, ...options } : defaultOptions;
    options.allowUnsafe = Boolean(options.allowUnsafe);
    var lines = string.split(/(\r?\n)/);
    if (lines[0] && /= yaml =|---/.test(lines[0])) {
      return parse(string, options.allowUnsafe);
    } else {
      return {
        attributes: {},
        body: string,
        bodyBegin: 1,
      };
    }
  }
  function computeLocation(match, body) {
    var line = 1;
    var pos = body.indexOf(`
`);
    var offset = match.index + match[0].length;
    while (pos !== -1) {
      if (pos >= offset) {
        return line;
      }
      line++;
      pos = body.indexOf(
        `
`,
        pos + 1,
      );
    }
    return line;
  }
  function parse(string, allowUnsafe) {
    var match = regex.exec(string);
    if (!match) {
      return {
        attributes: {},
        body: string,
        bodyBegin: 1,
      };
    }
    var loader = allowUnsafe ? parser.load : parser.safeLoad;
    var yaml = match[match.length - 1].replace(/^\s+|\s+$/g, "");
    var attributes = loader(yaml) || {};
    var body = string.replace(match[0], "");
    var line = computeLocation(match, string);
    return {
      attributes,
      body,
      bodyBegin: line,
      frontmatter: yaml,
    };
  }
  function test(string) {
    string = string || "";
    return regex.test(string);
  }
});

// apps/cli/src/index.ts
import { resolve as resolve3, join as join6 } from "path";
import { existsSync as existsSync2, mkdirSync as mkdirSync2 } from "fs";

// apps/cli/src/cli.ts
import { readFileSync } from "fs";
var VALID_MODES = new Set(["task", "list", "status", "advance", "set-phase"]);
var VALID_MODELS = new Set(["haiku", "sonnet", "opus"]);
function parseArgs(argv) {
  const result = {
    mode: "task",
    name: "",
    prompt: "",
    engine: "claude",
    model: "opus",
    engineSet: false,
    maxIterations: 0,
    phase: "",
    noExecute: false,
    delay: 0,
    log: false,
    verbose: false,
  };
  let expectModel = false;
  let expectName = false;
  let expectPrompt = false;
  let expectPromptFile = false;
  let expectPhase = false;
  let expectDelay = false;
  let expectTimeout = false;
  let expectPushInterval = false;
  for (const arg of argv) {
    if (expectModel) {
      if (VALID_MODELS.has(arg)) {
        result.model = arg;
        expectModel = false;
        continue;
      }
      expectModel = false;
    }
    if (expectName) {
      result.name = arg;
      expectName = false;
      continue;
    }
    if (expectPrompt) {
      result.prompt = arg;
      expectPrompt = false;
      continue;
    }
    if (expectPromptFile) {
      result.prompt = readFileSync(arg, "utf-8");
      expectPromptFile = false;
      continue;
    }
    if (expectPhase) {
      result.phase = arg;
      expectPhase = false;
      continue;
    }
    if (expectDelay) {
      result.delay = parseInt(arg, 10);
      expectDelay = false;
      continue;
    }
    if (expectTimeout) {
      expectTimeout = false;
      continue;
    }
    if (expectPushInterval) {
      expectPushInterval = false;
      continue;
    }
    switch (arg) {
      case "--claude":
        if (result.engineSet && result.engine !== "claude") {
          throw new Error("Choose only one engine flag: --claude or --codex");
        }
        result.engine = "claude";
        result.engineSet = true;
        expectModel = true;
        break;
      case "--codex":
        if (result.engineSet && result.engine !== "codex") {
          throw new Error("Choose only one engine flag: --claude or --codex");
        }
        result.engine = "codex";
        result.engineSet = true;
        break;
      case "--name":
        expectName = true;
        break;
      case "--prompt":
        expectPrompt = true;
        break;
      case "--prompt-file":
        expectPromptFile = true;
        break;
      case "--phase":
        expectPhase = true;
        break;
      case "--no-execute":
        result.noExecute = true;
        break;
      case "--delay":
        expectDelay = true;
        break;
      case "--timeout":
        expectTimeout = true;
        break;
      case "--push-interval":
        expectPushInterval = true;
        break;
      case "--unlimited":
        result.maxIterations = 0;
        break;
      case "--log":
        result.log = true;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      default:
        if (/^\d+$/.test(arg)) {
          result.maxIterations = parseInt(arg, 10);
        } else if (VALID_MODES.has(arg)) {
          result.mode = arg;
        } else {
          throw new Error(`Unknown argument or mode '${arg}'`);
        }
        break;
    }
  }
  return result;
}

// apps/cli/src/display.ts
import { join } from "path";

// packages/core/src/progress.ts
function extractCurrentSection(content) {
  const lines = content.split(`
`);
  let sectionHeader = "";
  let buf = "";
  let hasUnchecked = false;
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inSection && hasUnchecked) {
        return (
          sectionHeader +
          `
` +
          buf
        );
      }
      sectionHeader = line;
      buf = "";
      hasUnchecked = false;
      inSection = true;
      continue;
    }
    if (inSection) {
      buf +=
        line +
        `
`;
      if (line.startsWith("- [ ]")) {
        hasUnchecked = true;
      }
    }
  }
  if (inSection && hasUnchecked) {
    return (
      sectionHeader +
      `
` +
      buf
    );
  }
  return null;
}
function countProgress(content) {
  const checked = (content.match(/^- \[x\]/gm) ?? []).length;
  const unchecked = (content.match(/^- \[ \]/gm) ?? []).length;
  return { checked, unchecked, total: checked + unchecked };
}

// packages/context/src/context.ts
import { AsyncLocalStorage } from "async_hooks";
import {
  readFileSync as readFileSync2,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { dirname } from "path";

class FileSystemProvider {
  read(path) {
    if (!existsSync(path)) return null;
    return readFileSync2(path, "utf-8");
  }
  write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
  }
  remove(path) {
    if (!existsSync(path)) return;
    unlinkSync(path);
  }
  list(prefix) {
    if (!existsSync(prefix)) return [];
    return readdirSync(prefix);
  }
}
function createFileSystemProvider() {
  return new FileSystemProvider();
}
var contextStore = new AsyncLocalStorage();
function getContext() {
  const ctx = contextStore.getStore();
  if (!ctx) throw new Error("No AppContext set. Call runWithContext() first.");
  return ctx;
}
function getStorage() {
  return getContext().storage;
}
function runWithContext(ctx, fn) {
  return contextStore.run(ctx, fn);
}
function createDefaultContext() {
  return { storage: createFileSystemProvider() };
}

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 =
  (offset = 0) =>
  (code) =>
    `\x1B[${code + offset}m`;
var wrapAnsi256 =
  (offset = 0) =>
  (code) =>
    `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m =
  (offset = 0) =>
  (red, green, blue) =>
    `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    blackBright: [90, 39],
    gray: [90, 39],
    grey: [90, 39],
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39],
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    bgGrey: [100, 49],
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49],
  },
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`,
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false,
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false,
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round(((red - 8) / 247) * 24) + 232;
        }
        return (
          16 +
          36 * Math.round((red / 255) * 5) +
          6 * Math.round((green / 255) * 5) +
          Math.round((blue / 255) * 5)
        );
      },
      enumerable: false,
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [(integer >> 16) & 255, (integer >> 8) & 255, integer & 255];
      },
      enumerable: false,
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false,
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = (remainder % 6) / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false,
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false,
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false,
    },
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "process";
import os from "os";
import tty from "tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = process2;
var flagForceColor;
if (
  hasFlag("no-color") ||
  hasFlag("no-colors") ||
  hasFlag("color=false") ||
  hasFlag("color=never")
) {
  flagForceColor = 0;
} else if (
  hasFlag("color") ||
  hasFlag("colors") ||
  hasFlag("color=true") ||
  hasFlag("color=always")
) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== undefined) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === undefined) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }
    if (
      ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) ||
      env.CI_NAME === "codeship"
    ) {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options,
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) }),
};
var supports_color_default = supportsColor;

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue +=
      string.slice(endIndex, gotCR ? index - 1 : index) +
      prefix +
      (gotCR
        ? `\r
`
        : `
`) +
      postfix;
    endIndex = index + 1;
    index = string.indexOf(
      `
`,
      endIndex,
    );
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/.bun/chalk@5.6.2/node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"];
var styles2 = Object.create(null);
var applyOptions = (object, options = {}) => {
  if (
    options.level &&
    !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)
  ) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === undefined ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk = (...strings) => strings.join(" ");
  applyOptions(chalk, options);
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(
        this,
        createStyler(style.open, style.close, this[STYLER]),
        this[IS_EMPTY],
      );
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    },
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  },
};
var getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function (...arguments_) {
        const styler = createStyler(
          getModelAnsi(model, levelMapping[level], "color", ...arguments_),
          ansi_styles_default.color.close,
          this[STYLER],
        );
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    },
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function (...arguments_) {
        const styler = createStyler(
          getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_),
          ansi_styles_default.bgColor.close,
          this[STYLER],
        );
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    },
  };
}
var proto = Object.defineProperties(() => {}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    },
  },
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent,
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) =>
    applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === undefined) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== undefined) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf(`
`);
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// packages/output/src/output.ts
var formatters = {
  bold: (text) => source_default.bold(text),
  dim: (text) => source_default.dim(text),
  gray: (text) => source_default.gray(text),
  error: (text) => source_default.red(text),
  fail: (text) => source_default.red.bold(text),
  warn: (text) => source_default.yellow.bold(text),
  header: (text) => source_default.bold.cyan(text),
  success: (text) => source_default.green(text),
  successBold: (text) => source_default.green.bold(text),
  cyan: (text) => source_default.cyan(text),
};
function format(msg) {
  return formatters[msg.style](msg.text);
}
function styled(text, style) {
  return format({ text, style });
}
function log(msg) {
  console.log(typeof msg === "string" ? msg : format(msg));
}
function error(msg) {
  console.error(typeof msg === "string" ? msg : format(msg));
}
function separator(width = 44) {
  console.log(source_default.gray("\u2501".repeat(width)));
}

// apps/cli/src/display.ts
function showBanner(state, opts) {
  separator();
  log(` ${styled("Ralph Loop", "header")}`);
  separator();
  const resumeTag = opts.isResume ? styled(" (resumed)", "dim") : "";
  log(` ${styled("Mode:", "bold")}       ${opts.mode}${resumeTag}`);
  if (opts.mode === "task") {
    log(` ${styled("Task:", "bold")}       ${state.name}`);
  }
  const engineLabel = state.engine === "claude" ? `${state.engine} (${state.model})` : state.engine;
  log(` ${styled("Engine:", "bold")}     ${engineLabel}`);
  log(` ${styled("Branch:", "bold")}     ${state.metadata.branch ?? "main"}`);
  if (opts.promptFile) {
    log(` ${styled("Prompt:", "bold")}     ${opts.promptFile}`);
  }
  log(` ${styled("No execute:", "bold")} ${opts.noExecute ? "yes (research+plan only)" : "no"}`);
  const maxLabel =
    opts.maxIterations && opts.maxIterations > 0 ? String(opts.maxIterations) : "unlimited";
  log(` ${styled("Max iters:", "bold")}  ${maxLabel}`);
  if (opts.iterationDelay && opts.iterationDelay > 0) {
    log(` ${styled("Delay:", "bold")}      ${opts.iterationDelay}s between runs`);
  }
  if (opts.mode === "task" && opts.taskPrompt) {
    const lines = opts.taskPrompt.split(`
`);
    const maxLines = 6;
    separator();
    log(` ${styled("Prompt:", "bold")}`);
    for (const line of lines.slice(0, maxLines)) {
      log(`  ${styled(line, "gray")}`);
    }
    if (lines.length > maxLines) {
      log(styled(`  \u2026 (${lines.length - maxLines} more lines)`, "dim"));
    }
  }
  separator();
}
function showStatus(state, taskDir) {
  log("============================================");
  log(` Task Status: ${state.name}`);
  log("============================================");
  log(` Phase:            ${state.phase}`);
  log(` Phase iteration:  ${state.phaseIteration}`);
  log(` Total iterations: ${state.totalIterations}`);
  log(` Status:           ${state.status}`);
  log(` Engine:           ${state.engine} (${state.model})`);
  log(` Created:          ${state.createdAt}`);
  log(` Last modified:    ${state.lastModified}`);
  log(` Branch:           ${state.metadata.branch ?? "\u2014"}`);
  log("--------------------------------------------");
  const cost = Math.round(state.usage.total_cost_usd * 100) / 100;
  const time = Math.round((state.usage.total_duration_ms / 1000) * 10) / 10 + "s";
  log(" Usage:");
  log(`   Cost:           $${cost}`);
  log(`   Time:           ${time}`);
  log(`   Turns:          ${state.usage.total_turns}`);
  log(`   Input tokens:   ${state.usage.total_input_tokens}`);
  log(`   Output tokens:  ${state.usage.total_output_tokens}`);
  log(`   Cached tokens:  ${state.usage.total_cache_read_input_tokens}`);
  log("--------------------------------------------");
  const storage = getStorage();
  log(" Files:");
  for (const f of ["RESEARCH.md", "PLAN.md", "PROGRESS.md"]) {
    const content = storage.read(join(taskDir, f));
    log(`   ${content !== null ? "[x]" : "[ ]"} ${f}`);
  }
  const progressContent = storage.read(join(taskDir, "PROGRESS.md"));
  if (progressContent !== null) {
    const { checked, unchecked } = countProgress(progressContent);
    log(` Progress:         ${checked} done / ${unchecked} remaining`);
  }
  log("--------------------------------------------");
  log(" History (last 10):");
  const recent = state.history.slice(-10);
  for (const entry of recent) {
    log(
      `   ${entry.timestamp} | ${entry.phase} iter ${entry.iteration} | ${entry.engine}/${entry.model} | ${entry.result}`,
    );
  }
  log("============================================");
}
function showList(tasksDir) {
  log("============================================");
  log(" Incomplete Tasks");
  log("============================================");
  let found = false;
  const storage = getStorage();
  const entries = storage.list(tasksDir);
  if (entries.length === 0) {
    log(" No tasks directory found.");
    log("============================================");
    return;
  }
  for (const entry of entries) {
    const raw = storage.read(join(tasksDir, entry, "state.json"));
    if (raw === null) continue;
    let state;
    try {
      state = JSON.parse(raw);
    } catch {
      continue;
    }
    if (state.phase === "done") continue;
    found = true;
    const name = String(state.name ?? entry);
    const phase = String(state.phase ?? "unknown");
    const status = String(state.status ?? "unknown");
    const total = String(state.totalIterations ?? 0);
    const prompt = String(state.prompt ?? "").slice(0, 60);
    let progressInfo = "";
    const progressContent = storage.read(join(tasksDir, entry, "PROGRESS.md"));
    if (progressContent !== null) {
      const { checked, unchecked } = countProgress(progressContent);
      progressInfo = ` | progress: ${checked} done / ${unchecked} remaining`;
    }
    const namePad = name.padEnd(20);
    log(
      ` ${namePad}  phase: ${phase.padEnd(8)}  status: ${status.padEnd(8)}  iters: ${total}${progressInfo}`,
    );
    log(`   ${prompt}`);
  }
  if (!found) {
    log(" No incomplete tasks found.");
  }
  log("============================================");
}

// packages/core/src/state.ts
import { join as join2 } from "path";
import { execSync } from "child_process";

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/external.js
var exports_external = {};
__export(exports_external, {
  void: () => voidType,
  util: () => util,
  unknown: () => unknownType,
  union: () => unionType,
  undefined: () => undefinedType,
  tuple: () => tupleType,
  transformer: () => effectsType,
  symbol: () => symbolType,
  string: () => stringType,
  strictObject: () => strictObjectType,
  setErrorMap: () => setErrorMap,
  set: () => setType,
  record: () => recordType,
  quotelessJson: () => quotelessJson,
  promise: () => promiseType,
  preprocess: () => preprocessType,
  pipeline: () => pipelineType,
  ostring: () => ostring,
  optional: () => optionalType,
  onumber: () => onumber,
  oboolean: () => oboolean,
  objectUtil: () => objectUtil,
  object: () => objectType,
  number: () => numberType,
  nullable: () => nullableType,
  null: () => nullType,
  never: () => neverType,
  nativeEnum: () => nativeEnumType,
  nan: () => nanType,
  map: () => mapType,
  makeIssue: () => makeIssue,
  literal: () => literalType,
  lazy: () => lazyType,
  late: () => late,
  isValid: () => isValid,
  isDirty: () => isDirty,
  isAsync: () => isAsync,
  isAborted: () => isAborted,
  intersection: () => intersectionType,
  instanceof: () => instanceOfType,
  getParsedType: () => getParsedType,
  getErrorMap: () => getErrorMap,
  function: () => functionType,
  enum: () => enumType,
  effect: () => effectsType,
  discriminatedUnion: () => discriminatedUnionType,
  defaultErrorMap: () => en_default,
  datetimeRegex: () => datetimeRegex,
  date: () => dateType,
  custom: () => custom,
  coerce: () => coerce,
  boolean: () => booleanType,
  bigint: () => bigIntType,
  array: () => arrayType,
  any: () => anyType,
  addIssueToContext: () => addIssueToContext,
  ZodVoid: () => ZodVoid,
  ZodUnknown: () => ZodUnknown,
  ZodUnion: () => ZodUnion,
  ZodUndefined: () => ZodUndefined,
  ZodType: () => ZodType,
  ZodTuple: () => ZodTuple,
  ZodTransformer: () => ZodEffects,
  ZodSymbol: () => ZodSymbol,
  ZodString: () => ZodString,
  ZodSet: () => ZodSet,
  ZodSchema: () => ZodType,
  ZodRecord: () => ZodRecord,
  ZodReadonly: () => ZodReadonly,
  ZodPromise: () => ZodPromise,
  ZodPipeline: () => ZodPipeline,
  ZodParsedType: () => ZodParsedType,
  ZodOptional: () => ZodOptional,
  ZodObject: () => ZodObject,
  ZodNumber: () => ZodNumber,
  ZodNullable: () => ZodNullable,
  ZodNull: () => ZodNull,
  ZodNever: () => ZodNever,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNaN: () => ZodNaN,
  ZodMap: () => ZodMap,
  ZodLiteral: () => ZodLiteral,
  ZodLazy: () => ZodLazy,
  ZodIssueCode: () => ZodIssueCode,
  ZodIntersection: () => ZodIntersection,
  ZodFunction: () => ZodFunction,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodError: () => ZodError,
  ZodEnum: () => ZodEnum,
  ZodEffects: () => ZodEffects,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodDefault: () => ZodDefault,
  ZodDate: () => ZodDate,
  ZodCatch: () => ZodCatch,
  ZodBranded: () => ZodBranded,
  ZodBoolean: () => ZodBoolean,
  ZodBigInt: () => ZodBigInt,
  ZodArray: () => ZodArray,
  ZodAny: () => ZodAny,
  Schema: () => ZodType,
  ParseStatus: () => ParseStatus,
  OK: () => OK,
  NEVER: () => NEVER,
  INVALID: () => INVALID,
  EMPTY_PATH: () => EMPTY_PATH,
  DIRTY: () => DIRTY,
  BRAND: () => BRAND,
});

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function (util2) {
  util2.assertEqual = (_) => {};
  function assertIs(_arg) {}
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function (e) {
      return obj[e];
    });
  };
  util2.objectKeys =
    typeof Object.keys === "function"
      ? (obj) => Object.keys(obj)
      : (object) => {
          const keys = [];
          for (const key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
              keys.push(key);
            }
          }
          return keys;
        };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item)) return item;
    }
    return;
  };
  util2.isInteger =
    typeof Number.isInteger === "function"
      ? (val) => Number.isInteger(val)
      : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator2 = " | ") {
    return array.map((val) => (typeof val === "string" ? `'${val}'` : val)).join(separator2);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function (objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second,
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set",
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (
        data.then &&
        typeof data.then === "function" &&
        data.catch &&
        typeof data.catch === "function"
      ) {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite",
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper =
      _mapper ||
      function (issue) {
        return issue.message;
      };
    const fieldErrors = { _errors: [] };
    const processError = (error2) => {
      for (const issue of error2.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error2 = new ZodError(issues);
  return error2;
};

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...(issueData.path || [])];
  const fullIssue = {
    ...issueData,
    path: fullPath,
  };
  if (issueData.message !== undefined) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message,
    };
  }
  let errorMessage = "";
  const maps = errorMaps
    .filter((m) => !!m)
    .slice()
    .reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage,
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === en_default ? undefined : en_default,
    ].filter((x) => !!x),
  });
  ctx.common.issues.push(issue);
}

class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid") this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted") this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted") return INVALID;
      if (s.status === "dirty") status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value,
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted") return INVALID;
      if (value.status === "aborted") return INVALID;
      if (key.status === "dirty") status.dirty();
      if (value.status === "dirty") status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var INVALID = Object.freeze({
  status: "aborted",
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function (errorUtil2) {
  errorUtil2.errToObj = (message) => (typeof message === "string" ? { message } : message || {});
  errorUtil2.toString = (message) => (typeof message === "string" ? message : message?.message);
})(errorUtil || (errorUtil = {}));

// node_modules/.bun/zod@3.25.76/node_modules/zod/v3/types.js
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error) return this._error;
        const error2 = new ZodError(ctx.common.issues);
        this._error = error2;
        return this._error;
      },
    };
  }
};
function processCreateParams(params) {
  if (!params) return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(
      `Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`,
    );
  }
  if (errorMap2) return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type") return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}

class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return (
      ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent,
      }
    );
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent,
      },
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success) return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap,
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async,
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result)
          ? {
              value: result.value,
            }
          : {
              issues: ctx.common.issues,
            };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true,
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) =>
      isValid(result)
        ? {
            value: result.value,
          }
        : {
            issues: ctx.common.issues,
          },
    );
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success) return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true,
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult)
      ? maybeAsyncResult
      : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () =>
        ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val),
        });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(
          typeof refinementData === "function" ? refinementData(val, ctx) : refinementData,
        );
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement },
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data),
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform },
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def),
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description,
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex =
  /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset) opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt)) return false;
  try {
    const [header] = jwt.split(".");
    if (!header) return false;
    const base64 = header
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null) return false;
    if ("typ" in decoded && decoded?.typ !== "JWT") return false;
    if (!decoded.alg) return false;
    if (alg && decoded.alg !== alg) return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}

class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message,
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message,
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message),
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message),
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options,
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message),
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options,
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message),
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message),
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message),
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message),
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message),
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message),
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message),
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message),
    });
  }
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }],
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }],
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }],
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params),
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return (valInt % stepInt) / 10 ** decCount;
}

class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    let ctx = undefined;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message),
        },
      ],
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message),
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message),
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message),
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message),
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message),
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find(
      (ch) => ch.kind === "int" || (ch.kind === "multipleOf" && util.isInteger(ch.value)),
    );
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min) min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params),
  });
};

class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = undefined;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType,
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message),
        },
      ],
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message),
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params),
  });
};

class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params),
  });
};

class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date,
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date",
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date",
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime()),
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message),
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message),
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params),
  });
};

class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params),
  });
};

class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params),
  });
};

class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params),
  });
};

class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params),
  });
};

class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params),
  });
};

class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType,
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params),
  });
};

class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params),
  });
};

class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : undefined,
          maximum: tooBig ? def.exactLength.value : undefined,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message,
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message,
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message,
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all(
        [...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        }),
      ).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) },
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) },
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) },
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params),
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape,
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element),
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}

class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null) return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data,
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] },
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys,
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data,
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve()
        .then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet,
            });
          }
          return syncPairs;
        })
        .then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...(message !== undefined
        ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError,
                };
              return {
                message: defaultError,
              };
            },
          }
        : {}),
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip",
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough",
    });
  }
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation,
      }),
    });
  }
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape(),
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject,
    });
    return merged;
  }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index,
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape,
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => shape,
    });
  }
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape,
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new ZodObject({
      ...this._def,
      shape: () => newShape,
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};

class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors,
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(
        options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: [],
            },
            parent: null,
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx,
            }),
            ctx: childCtx,
          };
        }),
      ).then(handleResults);
    } else {
      let dirty = undefined;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: [],
          },
          parent: null,
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx,
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors,
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params),
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [undefined, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};

class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator],
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(discriminator, options, params) {
    const optionsMap = new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(
          `A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`,
        );
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(
            `Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`,
          );
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params),
    });
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}

class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types,
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(
        this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
        this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
      );
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params),
  });
};

class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array",
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array",
      });
      status.dirty();
    }
    const items = [...ctx.data]
      .map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema) return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      })
      .filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest,
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params),
  });
};

class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data,
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third),
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second),
    });
  }
}

class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])),
      };
    });
    if (ctx.common.async) {
      const finalMap = new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params),
  });
};

class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message,
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message,
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = new Set();
      for (const element of elements2) {
        if (element.status === "aborted") return INVALID;
        if (element.status === "dirty") status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) =>
      valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)),
    );
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) },
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) },
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params),
  });
};

class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    function makeArgsIssue(args, error2) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          en_default,
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error2,
        },
      });
    }
    function makeReturnsIssue(returns, error2) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          en_default,
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error2,
        },
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function (...args) {
        const error2 = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error2.addIssue(makeArgsIssue(args, e));
          throw error2;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type
          .parseAsync(result, params)
          .catch((e) => {
            error2.addIssue(makeReturnsIssue(result, e));
            throw error2;
          });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function (...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create()),
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType,
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params),
    });
  }
}

class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params),
  });
};

class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value,
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params),
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params),
  });
}

class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type,
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues,
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef,
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(
      this.options.filter((opt) => !values.includes(opt)),
      {
        ...this._def,
        ...newDef,
      },
    );
  }
}
ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type,
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues,
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params),
  });
};

class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const promisified =
      ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(
      promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap,
        });
      }),
    );
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params),
  });
};

class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
      ? this._def.schema.sourceType()
      : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      },
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted") return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx,
          });
          if (result.status === "aborted") return INVALID;
          if (result.status === "dirty") return DIRTY(result.value);
          if (status.value === "dirty") return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted") return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx,
        });
        if (result.status === "aborted") return INVALID;
        if (result.status === "dirty") return DIRTY(result.value);
        if (status.value === "dirty") return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error(
            "Async refinement encountered during synchronous parse operation. Use .parseAsync instead.",
          );
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (inner.status === "aborted") return INVALID;
        if (inner.status === "dirty") status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema
          ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
          .then((inner) => {
            if (inner.status === "aborted") return INVALID;
            if (inner.status === "dirty") status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (!isValid(base)) return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(
            `Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`,
          );
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema
          ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
          .then((base) => {
            if (!isValid(base)) return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
              status: status.value,
              value: result,
            }));
          });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params),
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params),
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(undefined);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params),
  });
};

class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params),
  });
};

class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx,
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params),
  });
};

class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: [],
      },
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx,
      },
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value:
            result2.status === "valid"
              ? result2.value
              : this._def.catchValue({
                  get error() {
                    return new ZodError(newCtx.common.issues);
                  },
                  input: newCtx.data,
                }),
        };
      });
    } else {
      return {
        status: "valid",
        value:
          result.status === "valid"
            ? result.value
            : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data,
              }),
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params),
  });
};

class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params),
  });
};
var BRAND = Symbol("zod_brand");

class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx,
    });
  }
  unwrap() {
    return this._def.type;
  }
}

class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (inResult.status === "aborted") return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx,
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
      if (inResult.status === "aborted") return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value,
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx,
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline,
    });
  }
}

class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params),
  });
};
function cleanParams(params, data) {
  const p =
    typeof params === "function"
      ? params(data)
      : typeof params === "string"
        ? { message: params }
        : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate,
};
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (
  cls,
  params = {
    message: `Input not instance of ${cls.name}`,
  },
) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) =>
    ZodBoolean.create({
      ...arg,
      coerce: true,
    }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true }),
};
var NEVER = INVALID;
// packages/types/src/types.ts
var ContextEntrySchema = exports_external.discriminatedUnion("type", [
  exports_external.object({
    type: exports_external.literal("file"),
    file: exports_external.string(),
    label: exports_external.string(),
  }),
  exports_external.object({
    type: exports_external.literal("currentSection"),
    label: exports_external.string(),
  }),
]);
var PhaseFrontmatterSchema = exports_external.object({
  name: exports_external.string(),
  order: exports_external.number(),
  requires: exports_external.array(exports_external.string()).default([]),
  next: exports_external.string().nullable().default(null),
  autoAdvance: exports_external.enum(["allChecked"]).nullable().default(null),
  loopBack: exports_external.string().nullable().default(null),
  terminal: exports_external.boolean().default(false),
  context: exports_external.array(ContextEntrySchema).default([]),
});
var UsageSchema = exports_external.object({
  total_cost_usd: exports_external.number().default(0),
  total_duration_ms: exports_external.number().default(0),
  total_turns: exports_external.number().default(0),
  total_input_tokens: exports_external.number().default(0),
  total_output_tokens: exports_external.number().default(0),
  total_cache_read_input_tokens: exports_external.number().default(0),
  total_cache_creation_input_tokens: exports_external.number().default(0),
});
var HistoryEntrySchema = exports_external.object({
  timestamp: exports_external.string(),
  startedAt: exports_external.string().optional(),
  endedAt: exports_external.string().optional(),
  phase: exports_external.string(),
  iteration: exports_external.number(),
  engine: exports_external.string(),
  model: exports_external.string(),
  result: exports_external.string(),
  usage: exports_external
    .object({
      cost_usd: exports_external.number().optional(),
      duration_ms: exports_external.number().optional(),
      num_turns: exports_external.number().optional(),
      input_tokens: exports_external.number().optional(),
      output_tokens: exports_external.number().optional(),
      cache_read_input_tokens: exports_external.number().optional(),
      cache_creation_input_tokens: exports_external.number().optional(),
    })
    .optional(),
});
var StateSchema = exports_external.object({
  version: exports_external.string().default("1"),
  name: exports_external.string(),
  prompt: exports_external.string(),
  phase: exports_external.string(),
  phaseIteration: exports_external.number().default(0),
  totalIterations: exports_external.number().default(0),
  createdAt: exports_external.string(),
  lastModified: exports_external.string(),
  engine: exports_external.string().default("claude"),
  model: exports_external.string().default("opus"),
  status: exports_external.string().default("active"),
  usage: UsageSchema.default({}),
  history: exports_external.array(HistoryEntrySchema).default([]),
  metadata: exports_external
    .object({
      branch: exports_external.string().optional(),
    })
    .default({}),
});

// packages/phases/src/phases.ts
var import_front_matter = __toESM(require_front_matter(), 1);
import { resolve, dirname as dirname2 } from "path";
import { readdirSync as readdirSync2, readFileSync as readFileSync3 } from "fs";
import { fileURLToPath } from "url";
var __dirname2 = dirname2(fileURLToPath(import.meta.url));
var defaultPhasesDir = resolve(__dirname2, "..", "phases");
var defaultChecklistDir = resolve(__dirname2, "..", "checklists");
function resolvePhasesDir() {
  try {
    readdirSync2(defaultPhasesDir);
    return defaultPhasesDir;
  } catch {
    return resolve(__dirname2, "..", "phases");
  }
}
function resolveChecklistDirPath() {
  try {
    readdirSync2(defaultChecklistDir);
    return defaultChecklistDir;
  } catch {
    return resolve(__dirname2, "..", "templates", "checklists");
  }
}
var cachedPhases = null;
var cachedDir = null;
function loadPhases(dir = resolvePhasesDir()) {
  if (cachedPhases !== null && cachedDir === dir) return cachedPhases;
  const files = readdirSync2(dir).filter((f) => f.endsWith(".md"));
  const phases = [];
  for (const file of files) {
    const content = readFileSync3(resolve(dir, file), "utf-8");
    const { attributes, body } = import_front_matter.default(content);
    const config = PhaseFrontmatterSchema.parse(attributes);
    phases.push({ ...config, prompt: body.trim() });
  }
  phases.sort((a, b) => a.order - b.order);
  cachedPhases = phases;
  cachedDir = dir;
  return phases;
}
function getPhase(name, dir) {
  const phases = loadPhases(dir);
  const phase = phases.find((p) => p.name === name);
  if (!phase) throw new Error(`Unknown phase: ${name}`);
  return phase;
}
function getNextPhase(current, dir) {
  const phases = loadPhases(dir);
  const phase = phases.find((p) => p.name === current);
  if (!phase) throw new Error(`Unknown phase: ${current}`);
  if (phase.next) {
    return phase.next;
  }
  const idx = phases.indexOf(phase);
  if (idx < phases.length - 1) {
    return phases[idx + 1].name;
  }
  return null;
}
function getFirstPhase(dir) {
  const phases = loadPhases(dir);
  return phases[0];
}
function resolveChecklistDir() {
  return resolveChecklistDirPath();
}
function listChecklists() {
  const dir = resolveChecklistDirPath();
  return readdirSync2(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

// packages/core/src/state.ts
var STATE_FILE = "state.json";
function readState(taskDir) {
  const filePath = join2(taskDir, STATE_FILE);
  const raw = getStorage().read(filePath);
  if (raw === null) throw new Error(`state.json not found in ${taskDir}`);
  return StateSchema.parse(JSON.parse(raw));
}
function writeState(taskDir, state) {
  const filePath = join2(taskDir, STATE_FILE);
  getStorage().write(
    filePath,
    JSON.stringify(state, null, 2) +
      `
`,
  );
}
function updateState(taskDir, updater) {
  const state = readState(taskDir);
  const updated = updater(state);
  writeState(taskDir, updated);
  return updated;
}
function buildInitialState(opts) {
  const now = new Date().toISOString();
  let branch = "main";
  try {
    branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {}
  return StateSchema.parse({
    name: opts.name,
    prompt: opts.prompt,
    phase: opts.phase ?? getFirstPhase().name,
    engine: opts.engine ?? "claude",
    model: opts.model ?? "opus",
    createdAt: now,
    lastModified: now,
    metadata: { branch },
  });
}
function inferPhaseFromFiles(taskDir) {
  const storage = getStorage();
  if (storage.read(join2(taskDir, "RESEARCH.md")) === null) return getFirstPhase().name;
  const plan = storage.read(join2(taskDir, "PLAN.md"));
  const progress = storage.read(join2(taskDir, "PROGRESS.md"));
  if (plan === null || progress === null) return "plan";
  const unchecked = (progress.match(/^- \[ \]/gm) ?? []).length;
  return unchecked === 0 ? "done" : "exec";
}
function migrateState(taskDir) {
  const phase = inferPhaseFromFiles(taskDir);
  const name = taskDir.split("/").pop() ?? "unknown";
  const state = buildInitialState({ name, prompt: "", phase });
  writeState(taskDir, state);
  return state;
}
function ensureState(taskDir) {
  const filePath = join2(taskDir, STATE_FILE);
  const storage = getStorage();
  if (storage.read(filePath) !== null) {
    return readState(taskDir);
  }
  const hasFiles =
    storage.read(join2(taskDir, "RESEARCH.md")) !== null ||
    storage.read(join2(taskDir, "PLAN.md")) !== null ||
    storage.read(join2(taskDir, "PROGRESS.md")) !== null;
  if (hasFiles) {
    return migrateState(taskDir);
  }
  const name = taskDir.split("/").pop() ?? "unknown";
  const state = buildInitialState({ name, prompt: "" });
  writeState(taskDir, state);
  return state;
}

// packages/core/src/phases.ts
import { join as join3 } from "path";
function recordPhaseTransition(state, from, to, result) {
  const now = new Date().toISOString();
  return {
    ...state,
    phase: to,
    phaseIteration: 0,
    lastModified: now,
    history: [
      ...state.history,
      {
        timestamp: now,
        phase: from,
        iteration: state.phaseIteration,
        engine: state.engine,
        model: state.model,
        result: result ?? `advance -> ${to}`,
      },
    ],
  };
}
function advancePhase(state, taskDir) {
  const current = state.phase;
  const config = getPhase(current);
  const storage = getStorage();
  if (config.terminal) {
    throw new Error("Task is already done. Nothing to advance.");
  }
  if (config.loopBack) {
    const progress = storage.read(join3(taskDir, "PROGRESS.md")) ?? "";
    const hasIssues = /\u26A0\uFE0F/.test(progress);
    if (hasIssues) {
      return recordPhaseTransition(state, current, config.loopBack, "issues found -> loop back");
    }
    const { unchecked } = countProgress(progress);
    if (unchecked === 0) {
      const terminal = loadPhases().find((p) => p.terminal);
      if (terminal) {
        const updated = recordPhaseTransition(
          state,
          current,
          terminal.name,
          "no issues found -> advance to done",
        );
        return { ...updated, status: "completed" };
      }
    }
    const nextName2 = getNextPhase(current);
    if (!nextName2) throw new Error(`No next phase after ${current}`);
    return recordPhaseTransition(
      state,
      current,
      nextName2,
      "no issues found -> advance to next section",
    );
  }
  const nextName = getNextPhase(current);
  if (!nextName) {
    throw new Error(`No next phase after ${current}`);
  }
  const nextConfig = getPhase(nextName);
  for (const file of nextConfig.requires) {
    if (storage.read(join3(taskDir, file)) === null) {
      throw new Error(`Cannot advance to ${nextName} \u2014 ${file} does not exist yet`);
    }
  }
  if (nextName === "exec" && current === "plan") {
    let progressContent = storage.read(join3(taskDir, "PROGRESS.md"));
    if (progressContent !== null) {
      const { unchecked } = countProgress(progressContent);
      if (unchecked === 0) {
        throw new Error("Cannot advance to exec \u2014 PROGRESS.md has no unchecked items");
      }
      progressContent = appendChecklists(progressContent);
      storage.write(join3(taskDir, "PROGRESS.md"), progressContent);
    }
  }
  return recordPhaseTransition(state, current, nextName);
}
function setPhase(state, taskDir, targetPhase) {
  const from = state.phase;
  const updated = recordPhaseTransition(
    state,
    from,
    targetPhase,
    `set-phase: ${from} -> ${targetPhase}`,
  );
  writeState(taskDir, updated);
  return updated;
}
function autoTransitionAfterIteration(state, taskDir) {
  const config = getPhase(state.phase);
  const storage = getStorage();
  const progress = storage.read(join3(taskDir, "PROGRESS.md"));
  if (progress === null) return state;
  if (config.loopBack) {
    const hasIssues = /\u26A0\uFE0F/.test(progress);
    if (hasIssues) {
      const updated = recordPhaseTransition(
        state,
        state.phase,
        config.loopBack,
        "issues found -> loop back",
      );
      writeState(taskDir, updated);
      return updated;
    }
  }
  if (config.autoAdvance === "allChecked") {
    const { unchecked } = countProgress(progress);
    if (unchecked === 0) {
      if (config.loopBack) {
        const terminal = loadPhases().find((p) => p.terminal);
        if (terminal) {
          const updated = recordPhaseTransition(
            state,
            state.phase,
            terminal.name,
            "all items checked -> advance to done",
          );
          const final = { ...updated, status: "completed" };
          writeState(taskDir, final);
          return final;
        }
      }
      const nextName = getNextPhase(state.phase);
      if (nextName) {
        const updated = recordPhaseTransition(
          state,
          state.phase,
          nextName,
          "all items checked -> auto-advance",
        );
        writeState(taskDir, updated);
        return updated;
      }
    }
  }
  if (config.loopBack && config.autoAdvance === "allChecked") {
    const { unchecked } = countProgress(progress);
    if (unchecked > 0) {
      const nextName = getNextPhase(state.phase);
      if (nextName) {
        const updated = recordPhaseTransition(
          state,
          state.phase,
          nextName,
          "no issues found -> advance to next section",
        );
        writeState(taskDir, updated);
        return updated;
      }
    }
  }
  return state;
}
function appendChecklists(progress) {
  const storage = getStorage();
  const dir = resolveChecklistDir();
  const names = listChecklists();
  const sectionMatches = progress.match(/^## Section \d+/gm);
  let nextSection = (sectionMatches?.length ?? 0) + 1;
  for (const name of names) {
    const raw = storage.read(join3(dir, `${name}.md`));
    if (raw === null) continue;
    const h1Match = raw.match(/^# (.+)\n/);
    const title = h1Match ? h1Match[1] : "Checklist";
    const body = h1Match ? raw.slice(h1Match[0].length).replace(/^\n+/, "") : raw;
    progress += `
## Section ${nextSection} \u2014 ${title}

${body.trimEnd()}
`;
    nextSection++;
  }
  return progress;
}

// packages/core/src/git.ts
import { execSync as execSync2 } from "child_process";
import { join as join4 } from "path";
function getCurrentBranch() {
  try {
    return execSync2("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    return "main";
  }
}
function gitAdd(files) {
  execSync2(`git add ${files.map((f) => `"${f}"`).join(" ")}`, {
    stdio: "pipe",
  });
}
function gitCommit(message) {
  execSync2(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    stdio: "pipe",
  });
}
function gitPush() {
  const branch = getCurrentBranch();
  try {
    execSync2("git push", { stdio: "pipe" });
  } catch {
    try {
      execSync2(`git push -u origin ${branch}`, { stdio: "pipe" });
    } catch {
      try {
        execSync2(`git push --set-upstream origin ${branch}`, { stdio: "pipe" });
      } catch {}
    }
  }
}
function commitState(taskDir, message) {
  const stateFile = join4(taskDir, "state.json");
  try {
    gitAdd([stateFile]);
    gitCommit(message);
  } catch {}
}

// apps/cli/src/loop.ts
import { join as join5 } from "path";

// packages/core/src/templates.ts
import { resolve as resolve2, dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var __dirname3 = dirname3(fileURLToPath2(import.meta.url));
var packageRoot = resolve2(__dirname3, "..");
function renderTemplate(content, vars) {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
function resolveTemplatePath(name) {
  return resolve2(packageRoot, "templates", "scaffolds", `${name}.md`);
}

// packages/engine/src/engine.ts
var { spawn } = globalThis.Bun;

// packages/engine/src/formatters/claude-stream.ts
var SEP = styled("\u2501".repeat(50), "gray");
function formatCost(usd) {
  return (Math.round(usd * 100) / 100).toFixed(2);
}
function extractToolInputSummary(input) {
  if (typeof input.file_path === "string") {
    const parts = input.file_path.split("/");
    return `\uD83D\uDCC4 ${parts[parts.length - 1]}`;
  }
  if (typeof input.command === "string") {
    return `$ ${
      input.command.split(`
`)[0]
    }`;
  }
  if (typeof input.pattern === "string") {
    const inPath = typeof input.path === "string" ? ` in ${input.path.split("/").pop()}` : "";
    return `\uD83D\uDD0D ${input.pattern}${inPath}`;
  }
  if (typeof input.query === "string") return `\uD83D\uDD0D ${input.query}`;
  if (typeof input.url === "string") return `\uD83C\uDF10 ${input.url}`;
  if (typeof input.prompt === "string")
    return `\uD83D\uDCAC ${
      input.prompt.split(`
`)[0]
    }`;
  if (input.old_string !== undefined) return "\u270F\uFE0F  edit";
  if (input.content !== undefined) return "\uD83D\uDCDD write";
  return "";
}
function extractUsage(event) {
  const usage = event.usage ?? {};
  return {
    cost_usd: Math.round((event.total_cost_usd ?? 0) * 100) / 100,
    duration_ms: event.duration_ms ?? 0,
    num_turns: event.num_turns ?? 0,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  };
}
function processClaudeLine(line, state, options = {}) {
  const verbose = options.verbose ?? false;
  const output = [];
  if (!line.trim()) return output;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return output;
  }
  const type = event.type;
  if (!type) return output;
  switch (type) {
    case "system": {
      const subtype = event.subtype ?? "";
      if (subtype === "init") {
        const model = event.model ?? "unknown";
        const sid = (event.session_id ?? "").slice(0, 8);
        if (model === "unknown") {
          if (verbose) {
            output.push(
              `${styled("\u26A0 FAILED TO PARSE MODEL", "fail")} ${styled(`(${sid}\u2026)`, "dim")}`,
            );
            output.push(
              styled(
                "  Check log file for raw JSON output. Run with --log to capture full output.",
                "dim",
              ),
            );
          } else {
            output.push(
              `${styled("\u2717", "error")} ${styled("UNKNOWN", "bold")} ${styled(`(${sid}\u2026) - see --log`, "dim")}`,
            );
          }
        } else {
          if (verbose) {
            const ver = event.claude_code_version ?? "";
            const ntools = Array.isArray(event.tools) ? event.tools.length : 0;
            output.push(SEP);
            output.push(
              `  ${styled("model:", "dim")} ${styled(model, "bold")}  ${styled(`session: ${sid}\u2026  v${ver}  tools: ${ntools}`, "dim")}`,
            );
            output.push(SEP);
          } else {
            output.push(
              `${styled("\u2500\u2500", "gray")} ${styled(model, "bold")} ${styled(`(${sid}\u2026)`, "gray")}`,
            );
          }
        }
      } else if (subtype === "task_started" && verbose) {
        const desc = event.description ?? "";
        if (desc) output.push(`  ${styled(`\u22B3 agent: ${desc}`, "dim")}`);
      }
      break;
    }
    case "assistant": {
      state.turnCount++;
      const message = event.message;
      const content = message?.content ?? [];
      for (const block of content) {
        const btype = block.type;
        if (btype === "text") {
          const text = block.text;
          if (text)
            output.push(`
${styled(text, "bold")}`);
        } else if (btype === "tool_use") {
          state.toolCount++;
          const name = block.name ?? "?";
          const inputSummary = extractToolInputSummary(block.input ?? {});
          if (verbose) {
            output.push(`
  ${styled(`\u25B6 ${name}`, "header")}`);
            if (inputSummary) output.push(`    ${styled(inputSummary, "dim")}`);
          } else {
            let line2 = `  ${styled("\u25B6", "cyan")} ${styled(name, "cyan")}`;
            if (inputSummary) line2 += ` ${styled(inputSummary, "dim")}`;
            output.push(line2);
          }
        } else if (btype === "thinking") {
          if (verbose) {
            const thinking = block.thinking ?? "";
            if (thinking) {
              const lines = thinking.split(`
`);
              output.push(`
  ${styled("\uD83D\uDCAD thinking", "gray")}`);
              for (const tl of lines.slice(0, 3)) {
                output.push(`  ${styled(tl, "gray")}`);
              }
              if (lines.length > 3) {
                output.push(`  ${styled(`  \u2026 (${lines.length - 3} more lines)`, "gray")}`);
              }
            }
          } else {
            output.push(`  ${styled("\uD83D\uDCAD", "gray")}`);
          }
        }
      }
      break;
    }
    case "user": {
      if (verbose) {
        const message = event.message;
        const content = message?.content ?? [];
        for (const block of content) {
          if (block.type === "tool_result") {
            let resultText = "";
            const blockContent = block.content;
            if (typeof blockContent === "string") {
              resultText = blockContent;
            } else if (Array.isArray(blockContent)) {
              resultText = blockContent.filter((c) => c.type === "text").map((c) => c.text).join(`
`);
            }
            if (resultText) {
              const lines = resultText.split(`
`);
              const preview = lines.slice(0, 6);
              for (const pl of preview) {
                output.push(`    ${styled(pl, "dim")}`);
              }
              if (lines.length > 6) {
                output.push(`    ${styled(`\u2026 (${lines.length - 6} more lines)`, "dim")}`);
              }
            }
          }
        }
      } else {
        output.push(` ${styled("\u2713", "success")}`);
      }
      break;
    }
    case "result": {
      state.gotResult = true;
      const usage = extractUsage(event);
      state.usage = usage;
      const info = [
        `cost=$${formatCost(usage.cost_usd)}`,
        `time=${Math.round((usage.duration_ms / 1000) * 10) / 10}s`,
        `turns=${usage.num_turns}`,
        `in=${usage.input_tokens}`,
        `out=${usage.output_tokens}`,
        `cached=${usage.cache_read_input_tokens}`,
      ].join("  ");
      const subtype = event.subtype ?? "unknown";
      if (subtype === "error") {
        const errmsg = event.result ?? "unknown error";
        output.push(`
${styled("\u2717 Error", "fail")} ${styled(errmsg, "error")}`);
      } else {
        if (verbose) {
          output.push(`
${styled("\u2713 Done", "successBold")}  ${styled(info, "dim")}`);
          output.push(`${SEP}
`);
        } else {
          output.push(`
${styled("\u2713 done", "success")}  ${styled(info, "dim")}`);
        }
      }
      break;
    }
  }
  return output;
}

// packages/engine/src/formatters/codex-stream.ts
var TOOL_TYPES = new Set([
  "mcp_tool_call",
  "tool_call",
  "function_call",
  "computer_call",
  "command_execution",
]);
function isToolType(t) {
  return TOOL_TYPES.has(t);
}
function shortenInline(text, max = 140) {
  const collapsed = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (collapsed.length > max) return collapsed.slice(0, max) + "...";
  return collapsed;
}
function extractToolName(event) {
  const item = event.item ?? {};
  const rawItem = item.raw_item ?? {};
  const itemCall = item.call ?? {};
  const rawCall = rawItem.call ?? {};
  const itemFunc = item.function ?? {};
  const rawFunc = rawItem.function ?? {};
  const itemTool = item.tool;
  const rawTool = rawItem.tool;
  const candidates = [
    event.name,
    event.tool_name,
    event.tool?.name,
    event.tool,
    item.name,
    item.tool_name,
    typeof itemTool === "object" && itemTool ? itemTool.name : itemTool,
    rawItem.name,
    rawItem.tool_name,
    rawItem.recipient_name,
    typeof rawTool === "object" && rawTool ? rawTool.name : rawTool,
    itemCall.name,
    rawCall.name,
    itemFunc.name,
    rawFunc.name,
  ];
  const name = candidates.find((c) => typeof c === "string" && c.length > 0);
  const server = item.server ?? event.server ?? "";
  if (server && name) return `${server}/${name}`;
  return name ?? "";
}
function extractToolInputSummary2(event) {
  const item = event.item ?? {};
  const rawItem = item.raw_item ?? {};
  const itemCall = item.call ?? {};
  const rawCall = rawItem.call ?? {};
  const itemFunc = item.function ?? {};
  const rawFunc = rawItem.function ?? {};
  const candidates = [
    item.command,
    event.command,
    event.arguments,
    event.input,
    item.arguments,
    item.input,
    rawItem.arguments,
    rawItem.input,
    itemCall.arguments,
    rawCall.arguments,
    itemFunc.arguments,
    rawFunc.arguments,
  ];
  const val = candidates.find((c) => c !== undefined && c !== null);
  if (val === undefined || val === null) return "";
  const raw = typeof val === "string" ? val : JSON.stringify(val);
  return shortenInline(raw, 160);
}
function extractToolResultSummary(event) {
  const item = event.item ?? {};
  const rawItem = item.raw_item ?? {};
  const itemCall = item.call ?? {};
  const rawCall = rawItem.call ?? {};
  const itemError = item.error ?? {};
  const eventError = event.error ?? {};
  const candidates = [
    itemError.message,
    eventError.message,
    item.aggregated_output,
    event.aggregated_output,
    event.output,
    event.result,
    event.content,
    item.output,
    item.result,
    item.content,
    rawItem.output,
    rawItem.result,
    rawItem.content,
    itemCall.output,
    rawCall.output,
  ];
  const val = candidates.find((c) => c !== undefined && c !== null);
  if (val === undefined || val === null) return "";
  const raw = typeof val === "string" ? val : JSON.stringify(val);
  return shortenInline(raw, 160);
}
function extractThinkingText(event) {
  const item = event.item ?? {};
  const rawItem = item.raw_item ?? {};
  const candidates = [
    event.delta,
    event.text,
    event.summary,
    event.reasoning,
    event.message,
    item.delta,
    item.text,
    item.summary,
    item.reasoning,
    rawItem.delta,
    rawItem.text,
    rawItem.summary,
    rawItem.reasoning,
  ];
  const val = candidates.find((c) => typeof c === "string" && c.length > 0);
  return val ?? "";
}
function extractMessageText(event) {
  const item = event.item ?? {};
  const rawItem = item.raw_item ?? {};
  const itemType = item.type ?? rawItem.type ?? "";
  if (itemType === "agent_message") {
    return item.text ?? "";
  }
  if (itemType === "message") {
    const content = item.content ?? rawItem.content ?? [];
    return content
      .filter((c) => {
        const t = c.type ?? "";
        return t === "output_text" || t === "text" || t === "summary_text";
      })
      .map((c) => c.text ?? c.value ?? "")
      .join("");
  }
  return "";
}
function isImportantNonJson(line) {
  return /panicked at|thread .+ panicked|(^|\s)error([\s:]|$)|failed|exception|traceback|fatal/i.test(
    line,
  );
}
function processCodexLine(line, state, options = {}) {
  const verbose = options.verbose ?? false;
  const output = [];
  if (!line.trim()) return output;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    if (/hit your limit/i.test(line)) {
      state.rateLimited = true;
      output.push(`
${styled("\u2717 Rate limit reached", "fail")} ${styled(line, "error")}`);
    } else if (isImportantNonJson(line)) {
      output.push(`${styled("stderr:", "fail")} ${styled(line, "error")}`);
    } else if (verbose) {
      output.push(styled(line, "gray"));
    }
    return output;
  }
  const type = event.type;
  if (!type) return output;
  switch (type) {
    case "thread.started": {
      const tid = (event.thread_id ?? "").slice(0, 8);
      output.push(
        `${styled("\u2500\u2500", "gray")} ${styled("codex", "bold")} ${styled(`(${tid}...)`, "gray")}`,
      );
      break;
    }
    case "turn.started":
      output.push(`
${styled("\u25B6 turn started", "bold")}`);
      break;
    case "turn.completed": {
      const usage = event.usage;
      if (state.printingText) {
        output.push("");
        state.printingText = false;
      }
      if (usage) {
        const info = `in=${usage.input_tokens ?? 0}  out=${usage.output_tokens ?? 0}`;
        output.push(`
${styled("\u2713 done", "success")}  ${styled(info, "dim")}`);
      } else {
        output.push(`
${styled("\u2713 done", "success")}`);
      }
      break;
    }
    case "turn.failed": {
      const err = event.error?.message ?? event.message ?? "unknown error";
      if (state.printingText) {
        output.push("");
        state.printingText = false;
      }
      output.push(`
${styled("\u2717 Error", "fail")} ${styled(err, "error")}`);
      break;
    }
    case "error": {
      const msg = event.message ?? "unknown error";
      if (/hit your limit/i.test(msg)) {
        state.rateLimited = true;
        output.push(`${styled("\u2717 Rate limit reached", "fail")} ${styled(msg, "error")}`);
      } else {
        output.push(`${styled("error:", "error")} ${msg}`);
      }
      break;
    }
    case "response.output_text.delta":
    case "assistant.message.delta":
    case "message.delta":
    case "output_text.delta": {
      const delta = event.delta ?? event.text ?? event.message ?? "";
      if (delta) {
        if (!state.printingText) {
          output.push(`
${styled(delta, "bold")}`);
          state.printingText = true;
        } else {
          output.push(styled(delta, "bold"));
        }
      }
      break;
    }
    case "response.output_text.done":
    case "assistant.message.completed":
    case "message.completed":
    case "output_text.done": {
      const doneText = event.text ?? "";
      if (doneText) {
        if (!state.printingText) {
          output.push(`
${styled(doneText, "bold")}`);
        } else {
          output.push(styled(doneText, "bold"));
        }
      }
      state.printingText = false;
      break;
    }
    case "response.reasoning.delta":
    case "reasoning.delta":
    case "thinking.delta":
    case "assistant.thinking.delta":
    case "response.reasoning_summary.delta":
    case "response.reasoning_summary_text.delta": {
      const think = extractThinkingText(event);
      if (think) {
        if (state.printingText) {
          output.push("");
          state.printingText = false;
        }
        output.push(`  ${styled("thinking:", "gray")} ${styled(think, "dim")}`);
      }
      break;
    }
    case "tool.started":
    case "tool.call.started":
    case "item.started": {
      let name = extractToolName(event);
      const inputSummary = extractToolInputSummary2(event);
      const itemType = event.item?.type ?? event.item?.raw_item?.type ?? "";
      if (!name && itemType === "command_execution") name = "shell";
      if (name) {
        if (inputSummary) {
          output.push(
            `  ${styled("\u25B6", "cyan")} ${styled(name, "cyan")} ${styled(inputSummary, "dim")}`,
          );
        } else {
          output.push(`  ${styled("\u25B6", "cyan")} ${styled(name, "cyan")}`);
        }
        state.pendingTools++;
      }
      break;
    }
    case "response.output_item.added":
    case "item.added": {
      const msgText = extractMessageText(event);
      if (msgText) {
        if (!state.printingText) {
          output.push(`
${styled(msgText, "bold")}`);
        } else {
          output.push(styled(msgText, "bold"));
        }
        state.printingText = false;
      }
      const itemType = event.item?.type ?? event.item?.raw_item?.type ?? "";
      let name = extractToolName(event);
      const inputSummary = extractToolInputSummary2(event);
      if (name || isToolType(itemType)) {
        if (!name) name = itemType || "tool_call";
        if (inputSummary) {
          output.push(
            `  ${styled("\u25B6", "cyan")} ${styled(name, "cyan")} ${styled(inputSummary, "dim")}`,
          );
        } else {
          output.push(`  ${styled("\u25B6", "cyan")} ${styled(name, "cyan")}`);
        }
        state.pendingTools++;
      }
      break;
    }
    case "tool.completed":
    case "tool.call.completed":
    case "item.completed":
    case "response.output_item.done": {
      const msgText = extractMessageText(event);
      if (msgText) {
        if (!state.printingText) {
          output.push(`
${styled(msgText, "bold")}`);
        } else {
          output.push(styled(msgText, "bold"));
        }
        state.printingText = false;
      }
      const itemType = event.item?.type ?? event.item?.raw_item?.type ?? "";
      if (itemType === "reasoning") {
        const think = extractThinkingText(event);
        if (think) {
          if (state.printingText) {
            output.push("");
            state.printingText = false;
          }
          output.push(`  ${styled("thinking:", "gray")} ${styled(think, "dim")}`);
        }
      }
      const toolName = extractToolName(event);
      const resultSummary = extractToolResultSummary(event);
      const hasToolIdentity = toolName.length > 0 || isToolType(itemType);
      if (hasToolIdentity) {
        const displayName = toolName || itemType || "tool_call";
        if (toolName) {
          if (resultSummary) {
            output.push(
              ` ${styled("\u2713", "success")} ${styled(displayName, "dim")} ${styled(`\u2192 ${shortenInline(resultSummary, 140)}`, "dim")}`,
            );
          } else {
            output.push(` ${styled("\u2713", "success")} ${styled(displayName, "dim")}`);
          }
        } else if (isToolType(itemType)) {
          if (verbose) {
            if (resultSummary) {
              output.push(
                ` ${styled("\u2713", "success")} ${styled(displayName, "dim")} ${styled(`\u2192 ${shortenInline(resultSummary, 140)}`, "dim")}`,
              );
            } else {
              output.push(` ${styled("\u2713", "success")} ${styled(displayName, "dim")}`);
            }
          } else if (state.pendingTools > 0) {
            output.push(` ${styled("\u2713", "success")}`);
          }
        } else {
          output.push(` ${styled("\u2713", "success")}`);
        }
        if (state.pendingTools > 0) state.pendingTools--;
      }
      break;
    }
    case "response.completed": {
      const response = event.response ?? {};
      const responseOutput = response.output ?? [];
      const finalTexts = [];
      for (const item of responseOutput) {
        if (item.type !== "message") continue;
        const content = item.content ?? [];
        for (const c of content) {
          const ct = c.type ?? "";
          if (ct === "output_text" || ct === "text") {
            const text = c.text ?? "";
            if (text) finalTexts.push(text);
          }
        }
      }
      const finalText = finalTexts.join("");
      if (finalText) {
        if (!state.printingText) {
          output.push(`
${styled(finalText, "bold")}`);
        } else {
          output.push(styled(finalText, "bold"));
        }
        state.printingText = false;
      }
      break;
    }
    default:
      if (verbose) {
        const preview = JSON.stringify(event).slice(0, 220);
        output.push(styled(`${type}: ${preview}`, "dim"));
      }
      break;
  }
  return output;
}

// packages/engine/src/engine.ts
function handleEngineFailure(exitCode) {
  switch (exitCode) {
    case 42:
      return {
        message: "Rate limited \u2014 Codex rate limit hit. Stopping loop.",
        shouldStop: true,
      };
    case 130:
      return {
        message: "Interrupted (exit 130) \u2014 Claude hit usage limits or was cancelled (SIGINT).",
        shouldStop: false,
      };
    case 137:
      return {
        message: "Killed (exit 137) \u2014 Process was killed (SIGKILL / OOM).",
        shouldStop: false,
      };
    case 1:
      return {
        message: "Failed (exit 1) \u2014 Engine exited with a general error.",
        shouldStop: false,
      };
    default:
      return {
        message: `Failed (exit ${exitCode}) \u2014 Engine exited unexpectedly.`,
        shouldStop: false,
      };
  }
}
function buildClaudeArgs(model) {
  return [
    "-p",
    "-",
    "--dangerously-skip-permissions",
    "--model",
    model,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
}
function buildCodexArgs() {
  return ["exec", "--json", "--color", "never", "--dangerously-bypass-approvals-and-sandbox", "-"];
}
async function runEngine(opts) {
  const { engine, model, prompt } = opts;
  const isClaude = engine === "claude";
  const cmd = isClaude ? ["claude", ...buildClaudeArgs(model)] : ["codex", ...buildCodexArgs()];
  const proc = spawn({
    cmd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: isClaude ? "inherit" : "pipe",
  });
  const stdin = proc.stdin;
  stdin.write(new TextEncoder().encode(prompt));
  await stdin.flush();
  stdin.end();
  const stdout = proc.stdout;
  let usage = null;
  if (engine === "claude") {
    const claudeState = {
      turnCount: 0,
      toolCount: 0,
      gotResult: false,
      usage: null,
    };
    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(`
`);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const output = processClaudeLine(line, claudeState);
        for (const l of output) {
          process.stdout.write(
            l +
              `
`,
          );
        }
      }
    }
    if (buffer.trim()) {
      const output = processClaudeLine(buffer, claudeState);
      for (const l of output) {
        process.stdout.write(
          l +
            `
`,
        );
      }
    }
    usage = claudeState.usage;
  } else {
    const codexState = {
      printingText: false,
      rateLimited: false,
      pendingTools: 0,
    };
    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(`
`);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const output = processCodexLine(line, codexState);
        for (const l of output) {
          process.stdout.write(
            l +
              `
`,
          );
        }
      }
    }
    if (buffer.trim()) {
      const output = processCodexLine(buffer, codexState);
      for (const l of output) {
        process.stdout.write(
          l +
            `
`,
        );
      }
    }
    if (proc.stderr) {
      const stderr = proc.stderr;
      const stderrReader = stderr.getReader();
      const stderrDecoder = new TextDecoder();
      let stderrBuffer = "";
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrBuffer += stderrDecoder.decode(value, { stream: true });
        const lines = stderrBuffer.split(`
`);
        stderrBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const output = processCodexLine(line, codexState);
          for (const l of output) {
            process.stdout.write(
              l +
                `
`,
            );
          }
        }
      }
      if (stderrBuffer.trim()) {
        const output = processCodexLine(stderrBuffer, codexState);
        for (const l of output) {
          process.stdout.write(
            l +
              `
`,
          );
        }
      }
    }
  }
  const exitCode = await proc.exited;
  return { exitCode, usage };
}

// apps/cli/src/loop.ts
function buildTaskPrompt(state, taskDir) {
  const phaseConfig = getPhase(state.phase);
  let prompt = "";
  const storage = getStorage();
  const steering = storage.read(join5(taskDir, "STEERING.md"));
  if (steering !== null) {
    const lines = steering
      .split(`
`)
      .filter((line) => !line.startsWith("#"))
      .filter((line) => line.trim())
      .slice(0, 20);
    if (lines.length > 0) {
      prompt += `---
`;
      prompt += `# User Steering (READ FIRST)

`;
      prompt +=
        lines.join(`
`) +
        `

`;
      prompt += `---

`;
    }
  }
  if (phaseConfig.prompt) {
    prompt += renderTemplate(phaseConfig.prompt, buildTemplateVars(state, taskDir));
  }
  for (const entry of phaseConfig.context) {
    switch (entry.type) {
      case "file": {
        const content = storage.read(join5(taskDir, entry.file));
        if (content !== null) {
          prompt += `
---

## ${entry.label}

`;
          prompt += content;
        }
        break;
      }
      case "currentSection": {
        const progressContent = storage.read(join5(taskDir, "PROGRESS.md"));
        if (progressContent !== null) {
          const section = extractCurrentSection(progressContent);
          if (section) {
            if (entry.label) {
              prompt += `
---

## ${entry.label}

`;
            }
            prompt +=
              `
` + section;
          }
        }
        break;
      }
    }
  }
  return prompt;
}
function buildTemplateVars(state, taskDir) {
  const mcpTools =
    state.engine === "claude"
      ? [
          "",
          "## MCP Tools Available",
          "",
          "You have access to ralph MCP tools. **Use these instead of shell commands where applicable:**",
          "",
          "- `ralph_advance_phase(name)` \u2014 Advance this task to the next phase. **Use this instead of `./loop.sh advance`.**",
          "- `ralph_read_document(name, document)` \u2014 Read task documents (RESEARCH.md, PLAN.md, PROGRESS.md, STEERING.md)",
          "- `ralph_get_task(name)` \u2014 Get task status, metadata, and progress",
          "- `ralph_list_checklists()` \u2014 List available verification checklists with their contents",
          '- `ralph_apply_checklist(name, checklists)` \u2014 Append checklists as sections to PROGRESS.md (e.g. `["checklist_static", "checklist_tests"]`)',
          "",
          `Task name: \`${state.name}\``,
          "",
        ].join(`
`)
      : "";
  return {
    TASK_NAME: state.name,
    TASK_DIR: taskDir,
    TASK_PROMPT: state.prompt,
    DATE: new Date().toISOString().split("T")[0],
    PHASE: state.phase,
    PHASE_ITERATION: String(state.phaseIteration),
    MCP_TOOLS: mcpTools,
  };
}
function scaffoldTaskFiles(taskDir) {
  const storage = getStorage();
  if (storage.read(join5(taskDir, "STEERING.md")) === null) {
    const tmpl = storage.read(resolveTemplatePath("STEERING"));
    if (tmpl !== null) {
      storage.write(join5(taskDir, "STEERING.md"), tmpl);
    }
  }
}
function checkStopSignal(taskDir) {
  const storage = getStorage();
  const stopFile = join5(taskDir, "STOP");
  const reason = storage.read(stopFile);
  if (reason === null) return null;
  storage.remove(stopFile);
  log(`
${styled("STOP signal detected.", "warn")}`);
  log(`Reason: ${reason.trim()}`);
  updateState(taskDir, (s) => ({
    ...s,
    status: "blocked",
    lastModified: new Date().toISOString(),
  }));
  return reason;
}
function shouldContinue(state, iteration, opts) {
  if (opts.maxIterations > 0 && iteration >= opts.maxIterations) return false;
  const phaseConfig = getPhase(state.phase);
  if (phaseConfig.terminal) return false;
  if (opts.noExecute && state.phase === "exec") return false;
  return true;
}
function updateStateIteration(taskDir, result, startedAt, engine, model, usage) {
  return updateState(taskDir, (s) => {
    const now = new Date().toISOString();
    const newState = {
      ...s,
      phaseIteration: s.phaseIteration + 1,
      totalIterations: s.totalIterations + 1,
      lastModified: now,
      engine,
      model,
      history: [
        ...s.history,
        {
          timestamp: now,
          startedAt,
          endedAt: now,
          phase: s.phase,
          iteration: s.phaseIteration + 1,
          engine,
          model,
          result,
          usage: usage
            ? {
                cost_usd: usage.cost_usd,
                duration_ms: usage.duration_ms,
                num_turns: usage.num_turns,
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_read_input_tokens: usage.cache_read_input_tokens,
                cache_creation_input_tokens: usage.cache_creation_input_tokens,
              }
            : undefined,
        },
      ],
    };
    if (usage) {
      newState.usage = {
        total_cost_usd: s.usage.total_cost_usd + (usage.cost_usd ?? 0),
        total_duration_ms: s.usage.total_duration_ms + (usage.duration_ms ?? 0),
        total_turns: s.usage.total_turns + (usage.num_turns ?? 0),
        total_input_tokens: s.usage.total_input_tokens + (usage.input_tokens ?? 0),
        total_output_tokens: s.usage.total_output_tokens + (usage.output_tokens ?? 0),
        total_cache_read_input_tokens:
          s.usage.total_cache_read_input_tokens + (usage.cache_read_input_tokens ?? 0),
        total_cache_creation_input_tokens:
          s.usage.total_cache_creation_input_tokens + (usage.cache_creation_input_tokens ?? 0),
      };
    }
    return newState;
  });
}
function sleep(seconds) {
  return new Promise((resolve3) => setTimeout(resolve3, seconds * 1000));
}
async function mainLoop(opts) {
  return runWithContext(createDefaultContext(), () => _mainLoop(opts));
}
async function _mainLoop(opts) {
  const taskDir = join5(opts.tasksDir, opts.name);
  const storage = getStorage();
  let state;
  const existingState = storage.read(join5(taskDir, "state.json"));
  if (existingState !== null) {
    state = readState(taskDir);
    if (state.engine !== opts.engine || state.model !== opts.model) {
      state = { ...state, engine: opts.engine, model: opts.model };
      writeState(taskDir, state);
    }
  } else {
    state = buildInitialState({
      name: opts.name,
      prompt: opts.prompt,
      engine: opts.engine,
      model: opts.model,
    });
    writeState(taskDir, state);
  }
  const isResume = state.totalIterations > 0;
  scaffoldTaskFiles(taskDir);
  showBanner(state, {
    mode: "task",
    isResume,
    noExecute: opts.noExecute,
    maxIterations: opts.maxIterations,
    iterationDelay: opts.delay,
    taskPrompt: opts.prompt || state.prompt,
  });
  let iteration = 0;
  while (true) {
    state = readState(taskDir);
    if (!shouldContinue(state, iteration, opts)) {
      const phaseConfig = getPhase(state.phase);
      if (phaseConfig.terminal) {
        const progressContent2 = storage.read(join5(taskDir, "PROGRESS.md"));
        if (progressContent2 !== null) {
          const { checked, unchecked } = countProgress(progressContent2);
          log(`
All items checked (${checked} done / ${unchecked} remaining). Task complete!`);
        }
        log(`See: ${taskDir}/PROGRESS.md`);
      } else if (opts.noExecute && state.phase === "exec") {
        log(`
Research and planning complete. Stopping before execution (--no-execute).`);
        log(`See: ${taskDir}/PLAN.md, ${taskDir}/PROGRESS.md`);
      } else if (opts.maxIterations > 0 && iteration >= opts.maxIterations) {
        log(`
Reached max iterations: ${opts.maxIterations}`);
      }
      break;
    }
    iteration++;
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    log(`
======== ITERATION ${iteration} ${time} ========
`);
    log(` Phase: ${state.phase} (iteration ${state.phaseIteration})`);
    const progressContent = storage.read(join5(taskDir, "PROGRESS.md"));
    if (progressContent !== null) {
      const section = extractCurrentSection(progressContent);
      if (section) {
        const firstLine = section.split(`
`)[0];
        log(` Section: ${firstLine}`);
      }
      const { checked, unchecked } = countProgress(progressContent);
      log(` Progress: ${checked} done / ${unchecked} remaining`);
    }
    log("");
    const prompt = buildTaskPrompt(state, taskDir);
    const iterStart = new Date().toISOString();
    let engineResult;
    try {
      engineResult = await runEngine({
        engine: opts.engine,
        model: opts.model,
        prompt,
        logFlag: opts.log,
        taskDir,
      });
    } catch (err) {
      error({ text: `Engine spawn error: ${err}`, style: "error" });
      break;
    }
    if (engineResult.exitCode !== 0) {
      const failure = handleEngineFailure(engineResult.exitCode);
      log(`
${styled(failure.message, "fail")}`);
      updateStateIteration(
        taskDir,
        `failed:exit-${engineResult.exitCode}`,
        iterStart,
        opts.engine,
        opts.model,
        engineResult.usage,
      );
      if (failure.shouldStop) break;
      break;
    }
    state = updateStateIteration(
      taskDir,
      "success",
      iterStart,
      opts.engine,
      opts.model,
      engineResult.usage,
    );
    state = autoTransitionAfterIteration(state, taskDir);
    try {
      gitPush();
    } catch {}
    if (checkStopSignal(taskDir)) break;
    log(`
======== COMPLETED ITERATION ${iteration} ========
`);
    if (shouldContinue(state, iteration, opts) && opts.delay > 0) {
      log(`  [wait] Sleeping ${opts.delay}s before next iteration...
`);
      await sleep(opts.delay);
    }
  }
  log(`Ralph loop finished after ${iteration} iterations.`);
  if (iteration > 0) {
    try {
      gitPush();
    } catch {}
  }
}

// apps/cli/src/index.ts
function resolveTasksDir() {
  let dir = process.cwd();
  while (dir !== "/") {
    const candidate = join6(dir, ".ralph", "tasks");
    if (existsSync2(candidate)) return candidate;
    dir = resolve3(dir, "..");
  }
  return join6(process.cwd(), ".ralph", "tasks");
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tasksDir = resolveTasksDir();
  switch (args.mode) {
    case "list": {
      showList(tasksDir);
      break;
    }
    case "status": {
      if (!args.name) {
        error("Error: --name is required for status mode");
        process.exit(1);
      }
      const taskDir = join6(tasksDir, args.name);
      if (!existsSync2(join6(taskDir, "state.json"))) {
        error(`Error: task '${args.name}' not found`);
        process.exit(1);
      }
      const state = readState(taskDir);
      showStatus(state, taskDir);
      break;
    }
    case "advance": {
      if (!args.name) {
        error("Error: --name is required for advance mode");
        process.exit(1);
      }
      const taskDir = join6(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = advancePhase(state, taskDir);
      writeState(taskDir, updated);
      commitState(taskDir, `advance phase: ${state.phase} -> ${updated.phase}`);
      log(`Advanced: ${state.phase} -> ${updated.phase}`);
      break;
    }
    case "set-phase": {
      if (!args.name) {
        error("Error: --name is required for set-phase mode");
        process.exit(1);
      }
      if (!args.phase) {
        error("Error: --phase is required for set-phase mode");
        process.exit(1);
      }
      const taskDir = join6(tasksDir, args.name);
      const state = ensureState(taskDir);
      const updated = setPhase(state, taskDir, args.phase);
      log(`Set phase: ${state.phase} -> ${updated.phase}`);
      break;
    }
    case "task": {
      if (!args.name) {
        error("Error: --name is required for task mode");
        process.exit(1);
      }
      mkdirSync2(join6(tasksDir, args.name), { recursive: true });
      await mainLoop({
        name: args.name,
        prompt: args.prompt,
        engine: args.engine,
        model: args.model,
        maxIterations: args.maxIterations,
        noExecute: args.noExecute,
        delay: args.delay,
        log: args.log,
        tasksDir,
      });
      break;
    }
  }
}
await main().catch((err) => {
  error(err instanceof Error ? err.message : err);
  process.exit(1);
});
