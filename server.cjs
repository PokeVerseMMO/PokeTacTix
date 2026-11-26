var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../anime-autochess-pc/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { websocketMask, websocketUnmask } = require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module2.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module2.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        this._mask = void 0;
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver2;
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var {
      types: { isUint8Array }
    } = require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge2 = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge2 = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge2 ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge2) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http = require("http");
    var net = require("net");
    var querystring = require("querystring");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL: URL2 } = require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          options = initAsClient(this, address, protocols, options);
        } else {
          this._isServer = true;
        }
        if (options.autoPong) {
          this._autoPong = true;
          this._autoPongComplete = () => autoPongComplete(this);
          this._pendingAutoPongs = 0;
          this._maxPendingAutoPongs = options.maxPendingAutoPongs | 0;
        }
        this._closeTimeout = options.closeTimeout;
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        maxPendingAutoPongs: 60,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL2(parsedUrl);
        parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        const username = querystring.unescape(parsedUrl.username);
        const password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
      return opts;
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeCode = code;
      if (reason.length === 0) {
        websocket._closeMessage = EMPTY_BUFFER;
      } else {
        websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length);
        websocket._closeMessage.set(reason);
      }
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong && websocket.readyState === WebSocket2.OPEN) {
        if (websocket._maxPendingAutoPongs > 0 && websocket._pendingAutoPongs >= websocket._maxPendingAutoPongs) {
          websocket.terminate();
        } else {
          websocket._pendingAutoPongs++;
          websocket.pong(data, !this._isServer, websocket._autoPongComplete);
        }
      }
      websocket.emit("ping", data);
    }
    function autoPongComplete(websocket) {
      websocket._pendingAutoPongs--;
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream2;
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// ../anime-autochess-pc/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../anime-autochess-pc/node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Number} [options.maxPendingAutoPongs=60] The maximum number of
       *     pending automatic pongs
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          maxPendingAutoPongs: 60,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/server.ts
var server_exports = {};
__export(server_exports, {
  startServer: () => startServer
});
module.exports = __toCommonJS(server_exports);

// server/data.ts
var import_node_fs = require("node:fs");
var import_node_url = require("node:url");
var import_node_path = require("node:path");
var import_meta = {};
var ROOT = process.env.AUTOCHESS_ROOT ?? (0, import_node_path.join)((0, import_node_path.dirname)((0, import_node_url.fileURLToPath)(import_meta.url)), "..");
var dir = (0, import_node_path.join)(ROOT, "data");
var load = (name) => JSON.parse((0, import_node_fs.readFileSync)((0, import_node_path.join)(dir, name + ".json"), "utf8"));
var speciesRaw = load("pokemon/species");
var TYPE_CHART = load("pokemon/types");
var STATUS_DATA = load("pokemon/status");
var WEATHER_DATA = load("pokemon/weather");
var SYNERGIES = load("pokemon/synergies").types;
var CONFIG = load("Config");
var BALANCE = load("Balance");
var enemyRaw = load("EnemyData");
var SPECIES = speciesRaw.species;
var ROSTER_ALL = SPECIES.map((s) => ({
  id: s.id,
  name: s.name,
  faction: s.types[0],
  role: s.role,
  tier: s.cost,
  health: s.hp,
  attack: s.attack,
  armor: s.defence,
  mr: s.spDefence,
  speed: s.speed,
  range: s.range,
  startMana: s.startMana,
  maxMana: s.maxMana,
  crit: s.crit,
  critDamage: s.critDamage,
  ability: s.ability,
  description: s.description,
  kind: s.kind,
  types: s.types,
  family: s.evolutionFamily,
  legendary: s.legendary,
  spAttack: s.spAttack,
  generation: s.generation,
  weather: s.weather,
  evolutionOnly: s.evolutionOnly,
  poolId: s.poolId,
  evolutionLine: s.evolutionLine,
  stoneEvolutions: s.stoneEvolutions
}));
var ROSTER = ROSTER_ALL.filter((u) => !u.evolutionOnly);
var ENEMIES = enemyRaw.ById;
var BOSS_DATA = load("BossData").ById;
var TRANSFORM = load("pokemon/transformations");
var SPECIAL_ITEMS = [
  ...TRANSFORM.megaStones.map((m) => ({ key: m.key, faction: "Mega", id: m.name, text: "Holder Mega Evolves in battle (final-form " + m.species + " line only): +30% HP, +25% attack, +15 defence. One per team.", rarity: "Mega", species: m.species, form: m.form })),
  { key: TRANSFORM.dynamaxBand.key, faction: "Dynamax", id: TRANSFORM.dynamaxBand.name, text: TRANSFORM.dynamaxBand.text, rarity: "Mega" }
];
var RANKS = load("RankData");
var BY_ID = { ...ENEMIES, ...Object.fromEntries(ROSTER_ALL.map((u) => [u.id, u])) };
var ITEMDATA = load("pokemon/items");
var ITEMS = CONFIG.ItemsByKey;
for (const it of SPECIAL_ITEMS) ITEMS[it.key] = it;
for (const it of ITEMDATA.extra) ITEMS[it.key] = it;
for (const it of ITEMDATA.typeItems) ITEMS[it.key] = it;
for (const it of ITEMDATA.transfer) ITEMS[it.key] = it;
for (const it of ITEMDATA.crystals) ITEMS[it.key] = it;
for (const [k, icon] of Object.entries(ITEMDATA.icons)) if (ITEMS[k]) ITEMS[k].icon = icon;
var ITEM_LIST = [...CONFIG.Items, ...ITEMDATA.extra];
var TYPE_ITEMS = ITEMDATA.typeItems;
var GOGO = load("pokemon/cards");
if (process.env.TEST_GOGO_CARDS) for (const r of Object.keys(GOGO.odds)) for (let i = 1; i <= 5; i++) GOGO.cards.push({ id: `test_${r}_${i}`, name: `Test ${r} ${i}`, rarity: r, text: `Placeholder card ${i} (test data only).`, icon: "art/ui/icons/gold.png", gold: i });
var TRANSFER_ITEMS = ITEMDATA.transfer;
var CRYSTALS = ITEMDATA.crystals;
for (const it of ITEM_LIST) if (ITEMDATA.icons[it.key]) it.icon = ITEMDATA.icons[it.key];
var STONES = CONFIG.Stones;
for (const st of STONES) if (ITEMDATA.icons[st.key]) st.icon = ITEMDATA.icons[st.key];
var CLIENT_ROSTER = ROSTER_ALL.map((u) => ({
  evolutionLine: u.evolutionLine,
  stoneEvolutions: u.stoneEvolutions,
  evolutionOnly: u.evolutionOnly,
  id: u.id,
  name: u.name,
  faction: u.faction,
  role: u.role,
  tier: u.tier,
  types: u.types,
  legendary: u.legendary,
  family: u.family,
  health: u.health,
  attack: u.attack,
  range: u.range,
  ability: u.ability,
  description: u.description,
  armor: u.armor,
  mr: u.mr,
  speed: u.speed,
  crit: u.crit,
  maxMana: u.maxMana,
  startMana: u.startMana
}));
var RULES = {
  shopSize: CONFIG.ShopSize,
  benchSize: CONFIG.BenchSize,
  maxLevel: CONFIG.MaxCapacity,
  cols: CONFIG.Columns,
  rows: 8,
  startGold: CONFIG.StartingGold,
  startHealth: CONFIG.StartingHealth,
  rerollCost: CONFIG.RerollCost,
  shopOdds: CONFIG.ShopOdds,
  xpToLevel: CONFIG.XPToLevel,
  poolCopies: CONFIG.PoolCopies,
  starScale: BALANCE.StarScale,
  maxAttackSpeed: BALANCE.MaxAttackSpeed,
  manaPerAttack: BALANCE.ManaPerAttack,
  damageManaCap: BALANCE.DamageManaCap,
  combatSeconds: CONFIG.CombatTicks * CONFIG.CombatStepSeconds,
  factionNames: CONFIG.FactionNames,
  factionColors: CONFIG.FactionColors,
  traitDescriptions: CONFIG.TraitDescriptions,
  commanders: CONFIG.Commanders,
  factions: CONFIG.Factions,
  npcInterval: CONFIG.NPCRoundInterval,
  enemyBalance: CONFIG.EnemyBalance,
  economy: CONFIG.Economy,
  synergies: SYNERGIES,
  damage: CONFIG.Damage
};
var ABILITIES = { ...BALANCE.Abilities, ...Object.fromEntries(SPECIES.map((s) => [s.id, s.abilityParams])) };

// server/synergy.ts
var crystalTypes = (items) => [...items ?? []].map((k) => ITEMS[k]?.crystal).filter(Boolean);
function traitCounts(units) {
  const seen = /* @__PURE__ */ new Set(), counts = {};
  for (const u of units) {
    if (u.blessing) counts[u.blessing] = (counts[u.blessing] ?? 0) + 1;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const d = BY_ID[u.id];
    const own = d.types ?? [d.faction];
    for (const t of /* @__PURE__ */ new Set([...own, ...crystalTypes(u.items)])) counts[t] = (counts[t] ?? 0) + 1;
    counts[d.role] = (counts[d.role] ?? 0) + 1;
  }
  return counts;
}
var tierOf = (type, n) => (SYNERGIES[type]?.thresholds ?? []).filter((t) => n >= t).length;
function typeBonuses(counts, myTypes) {
  const out = {};
  for (const [type, def] of Object.entries(SYNERGIES)) {
    const tier = tierOf(type, counts[type] ?? 0);
    if (!tier || !(def.team || myTypes.includes(type))) continue;
    for (const [k, v] of Object.entries(def.effects[tier - 1])) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}
function single(att, def) {
  const m = TYPE_CHART.multipliers;
  if (TYPE_CHART.immune[att]?.includes(def)) return m.immune;
  if (TYPE_CHART.superEffective[att]?.includes(def)) return m.superEffective;
  if (TYPE_CHART.notVeryEffective[att]?.includes(def)) return m.notVeryEffective;
  return 1;
}
function typeMultiplier(attTypes, defTypes) {
  if (!attTypes?.length || !defTypes?.length) return 1;
  const m = TYPE_CHART.multipliers;
  let best = 0;
  for (const a of attTypes) best = Math.max(best, defTypes.reduce((p, d) => p * single(a, d), 1));
  return Math.min(m.maxMultiplier, Math.max(m.minMultiplier, best));
}

// server/rules.ts
var pk = (p) => p.perks ||= { shield: 0, fortune: 0, fortuneLeft: 0, hpRerolls: 0, freeReroll: 0, fastPromo: 0, paydayLeft: 0, paydayAmt: 0, trustFund: false, festive: false, allyCall: false, merrier: false, interestCap: 0, xpMul: 1, shopMod: [0, 0, 0, 0, 0], fountain: false };
function absorb(p, dmg) {
  const k = pk(p);
  let d = dmg;
  const f = Math.min(k.fortune, d);
  k.fortune -= f;
  d -= f;
  const s = Math.min(k.shield, d);
  k.shield -= s;
  d -= s;
  return d;
}
var ok = () => ({ ok: true });
var fail = (error) => ({ ok: false, error });
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function newMatch(seed = Date.now()) {
  const pool = {};
  for (const d of ROSTER) pool[d.id] = RULES.poolCopies[d.tier - 1];
  return { round: 0, phase: "Preparation", pool, players: [], nextUid: 0, rng: mulberry32(seed) };
}
function addPlayer(m, name, human, commander) {
  const p = {
    seat: m.players.length,
    name,
    human,
    hp: RULES.startHealth,
    gold: RULES.startGold,
    level: RULES.economy.startLevel,
    xp: 0,
    units: [],
    shop: [],
    shopLocked: false,
    rerolled: false,
    commander,
    eliminated: false,
    ready: false,
    streak: 0,
    lastResult: null,
    connected: true,
    items: []
  };
  m.players.push(p);
  return p;
}
var deployed = (p) => p.units.filter((u) => u.col !== null);
var bench = (p) => p.units.filter((u) => u.col === null);
function releaseShop(m, p) {
  for (const id of p.shop) if (id) m.pool[id]++;
  p.shop = [];
}
function rollShop(m, p) {
  releaseShop(m, p);
  const base = RULES.shopOdds[String(p.level)] ?? RULES.shopOdds["3"], mod = pk(p).shopMod;
  const odds = base.map((v, i) => Math.max(0, v + (mod[i] ?? 0)));
  for (let slot = 0; slot < RULES.shopSize; slot++) {
    let roll = Math.floor(m.rng() * 100) + 1, tier = 1;
    for (let t = 0; t < odds.length; t++) {
      roll -= odds[t];
      if (roll <= 0) {
        tier = t + 1;
        break;
      }
    }
    const candidates = ROSTER.filter((d) => d.tier === tier && m.pool[d.id] > 0);
    const total = candidates.reduce((s, d) => s + m.pool[d.id], 0);
    if (total === 0) {
      p.shop[slot] = null;
      continue;
    }
    let pick2 = Math.floor(m.rng() * total) + 1;
    for (const d of candidates) {
      pick2 -= m.pool[d.id];
      if (pick2 <= 0) {
        p.shop[slot] = d.id;
        m.pool[d.id]--;
        break;
      }
    }
  }
}
function grantAlly(m, p, u) {
  const mine = BY_ID[u.id].types ?? [BY_ID[u.id].faction];
  const c = ROSTER.filter((d2) => !d2.evolutionOnly && d2.id !== u.id && (m.pool[d2.poolId ?? d2.id] ?? 0) > 0 && (d2.types ?? [d2.faction]).some((t) => mine.includes(t)));
  if (!c.length || bench(p).length >= RULES.benchSize) return;
  const d = c[Math.floor(m.rng() * c.length)];
  m.pool[d.poolId ?? d.id]--;
  p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
}
function merge(p, m) {
  let again = true;
  while (again) {
    again = false;
    for (const candidate of p.units) {
      if (candidate.stars >= 3) continue;
      const matches = p.units.filter((u) => u.id === candidate.id && u.stars === candidate.stars);
      if (matches.length < 3) continue;
      matches.sort((a, b) => Number(b.col !== null) - Number(a.col !== null));
      const keep = matches[0];
      for (const gone of matches.slice(1, 3)) {
        keep.blessing ||= gone.blessing;
        p.units.splice(p.units.indexOf(gone), 1);
        for (const it of gone.items) keep.items.length < 3 && !keep.items.includes(it) ? keep.items.push(it) : p.items.push(it);
      }
      keep.stars++;
      if (m && pk(p).allyCall) grantAlly(m, p, keep);
      again = true;
      break;
    }
  }
}
function buy(m, p, slot) {
  const id = p.shop[slot];
  if (!id) return fail("That shop slot is empty.");
  const d = BY_ID[id];
  if (p.gold < d.tier && !(pk(p).fastPromo > 0)) return fail("Not enough gold.");
  if (bench(p).length >= RULES.benchSize) {
    const copies = p.units.filter((u) => u.id === id && u.stars === 1).length;
    if (copies < 2) return fail("Your bench is full.");
  }
  const fast = pk(p).fastPromo > 0;
  if (fast) pk(p).fastPromo--;
  if (!fast) p.gold -= d.tier;
  p.shop[slot] = null;
  p.units.push({ uid: ++m.nextUid, id, stars: fast ? 2 : 1, col: null, row: null, items: [] });
  merge(p, m);
  return ok();
}
function sell(m, p, uid) {
  const i = p.units.findIndex((u2) => u2.uid === uid);
  if (i < 0) return fail("Select a fighter first.");
  const u = p.units[i], copies = 3 ** (u.stars - 1);
  p.items.push(...u.items);
  m.pool[BY_ID[u.id].poolId ?? u.id] += copies;
  p.gold += BY_ID[u.id].tier * copies;
  p.units.splice(i, 1);
  return ok();
}
var validCell = (col, row) => Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < RULES.cols && row >= 0 && row < RULES.rows / 2;
function move(p, uid, col, row) {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a fighter first.");
  if (col === null || row === null) {
    if (u.col !== null && bench(p).length >= RULES.benchSize) return fail("Your bench is full.");
    u.col = null;
    u.row = null;
    return ok();
  }
  if (!validCell(col, row)) return fail("Place fighters on your half of the board.");
  const other = p.units.find((v) => v.col === col && v.row === row);
  if (other === u) return ok();
  if (!other && u.col === null && deployed(p).length >= p.level) return fail("Your army is at capacity. Buy XP to expand it.");
  if (u.col === null && BY_ID[u.id].legendary) {
    const lim = RULES.economy.maxLegendaryDeployed;
    if (deployed(p).filter((v) => v !== u && BY_ID[v.id].legendary).length >= lim) return fail("Only " + lim + " Legendary Pok\xE9mon may be deployed.");
  }
  if (other) {
    other.col = u.col;
    other.row = u.row;
  }
  u.col = col;
  u.row = row;
  return ok();
}
function equip(p, uid, item) {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a fighter first.");
  const bagIdx = p.items.indexOf(item);
  if (bagIdx < 0) return fail("You do not own that equipment.");
  if (!ITEMS[item] || ITEMS[item].transfer) return fail("That item cannot be equipped.");
  if (u.items.length >= 3) return fail("A fighter can carry up to 3 pieces of equipment.");
  if (u.items.includes(item)) return fail("That fighter already carries this equipment.");
  p.items.splice(bagIdx, 1);
  u.items.push(item);
  return ok();
}
function evolve(p, uid, stone) {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a Pok\xE9mon first.");
  const target = BY_ID[u.id].stoneEvolutions?.[stone];
  if (!target) return fail("That stone does not work on this Pok\xE9mon.");
  const i = p.items.indexOf(stone);
  if (i < 0) return fail("You do not own that stone.");
  p.items.splice(i, 1);
  u.id = target;
  return ok();
}
function unequip(p, uid, index) {
  const u = p.units.find((x) => x.uid === uid);
  if (!u || !Number.isInteger(index) || index < 0 || index >= u.items.length) return fail("Nothing to remove.");
  p.items.push(...u.items.splice(index, 1));
  return ok();
}
var isNpcRound = (round) => round > 0 && round % RULES.npcInterval === 0;
var encounterOf = (round) => Math.floor(round / RULES.npcInterval);
var isBossEncounter = (round) => encounterOf(round) % 2 === 0;
function reward(m, p, round, won) {
  const enc = encounterOf(round);
  const count = won ? Math.ceil(enc / 2) + (enc % 2 === 0 ? 2 : 0) : 1;
  const rarity = !won ? "Rare" : enc === 1 ? "Rare" : enc === 2 ? "Epic" : enc % 2 === 0 ? "Legendary" : "Epic";
  const choices = ITEM_LIST.filter((i) => i.rarity === rarity);
  let first = "";
  const pool = rarity === "Rare" ? [...choices, ...TYPE_ITEMS] : rarity === "Epic" ? [...choices, ...CRYSTALS] : choices;
  const roll = () => rarity === "Rare" && m.rng() < 0.3 ? TYPE_ITEMS[Math.floor(m.rng() * TYPE_ITEMS.length)] : rarity === "Epic" && m.rng() < 0.35 ? CRYSTALS[Math.floor(m.rng() * CRYSTALS.length)] : choices[Math.floor(m.rng() * choices.length)];
  for (let i = 0; i < count; i++) {
    if (p.human) {
      const opts = [];
      for (let t = 0; t < 40 && opts.length < Math.min(3, pool.length); t++) {
        const it = roll();
        if (!opts.includes(it.key)) opts.push(it.key);
      }
      (p.picks ||= []).push(opts);
      first ||= "choose";
    } else {
      const it = roll();
      p.items.push(it.key);
      first ||= it.id;
    }
  }
  if (won && enc % 2 === 0) {
    const sp = SPECIAL_ITEMS[Math.floor(m.rng() * SPECIAL_ITEMS.length)];
    p.items.push(sp.key);
    first ||= sp.id;
  }
  if (won && enc >= 6 && enc % 2 === 0) p.items.push("blessing_transfer");
  if (won) for (let i = 0; i < RULES.economy.stonePerNpcWin; i++) p.items.push(STONES[Math.floor(m.rng() * STONES.length)].key);
  if (p.human) return count === 1 ? "choose 1 of 3 equipment" : `choose ${count} equipment (1 of 3 each)`;
  return count === 1 ? first + (won ? "" : " (consolation)") : `${count} equipment (${rarity})`;
}
function blessOptions(m, u) {
  const own = [...BY_ID[u.id].types ?? [BY_ID[u.id].faction]], all = Object.keys(SYNERGIES);
  const opts = own.slice(0, 2);
  for (let t = 0; t < 60 && opts.length < 3; t++) {
    const c = all[Math.floor(m.rng() * all.length)];
    if (!opts.includes(c)) opts.push(c);
  }
  return opts;
}
var BLESS_MILESTONES = [];
function grantBlessings(m, p) {
  if (false) {
    const u = p.units.find((x) => x.stars >= 2 && !x.blessing);
    if (u) {
      p.blessGiven = true;
      (p.bless ||= []).push({ uid: u.uid, options: blessOptions(m, u) });
    }
  }
  if (BLESS_MILESTONES.includes(m.round)) (p.bless ||= []).push({ uid: null });
}
function autoBless(m, p) {
  while (p.bless?.length) {
    const q = p.bless[0];
    let u = q.uid !== null ? p.units.find((x) => x.uid === q.uid) : void 0;
    if (!u) u = [...p.units].sort((a, b) => b.stars - a.stars || Number(b.col !== null) - Number(a.col !== null)).find((x) => !x.blessing);
    p.bless.shift();
    if (!u || u.blessing) continue;
    u.blessing = (q.options && q.uid === u.uid ? q.options : blessOptions(m, u))[0];
  }
}
function drawCards(m, rarity, avoid = []) {
  const pool = GOGO.cards.filter((c) => c.rarity === rarity), weighted = pool.flatMap((c) => Array(c.weight ?? 1).fill(c)), fresh = pool.filter((c) => !avoid.includes(c.id)), src = fresh.length >= 2 ? fresh : pool;
  const out = [], bag = src === fresh ? weighted.filter((c) => !avoid.includes(c.id)) : weighted;
  while (out.length < Math.min(2, src.length)) {
    const c = bag[Math.floor(m.rng() * bag.length)];
    if (!out.includes(c.id)) out.push(c.id);
  }
  return out;
}
function grantCards(m, p) {
  if (!GOGO.rounds.includes(m.round)) return;
  if (!GOGO.cards.length) return;
  const r = (m.cardRarity ||= {})[m.round] ??= (() => {
    let x = m.rng() * 100;
    for (const [k, w] of Object.entries(GOGO.odds)) {
      if ((x -= w) < 0) return k;
    }
    return "Common";
  })();
  const options = drawCards(m, r);
  if (options.length) p.card = { rarity: r, options, rerolls: options.map(() => GOGO.rerolls) };
  if (p.commander === "Brock" && m.round === 9) p.cardExtra = 1;
}
function applyCard(m, p, c) {
  if (c.id) (p.cardsTaken ||= []).push(c.id);
  const fx2 = c.fx ?? c, k = pk(p);
  if (fx2.gold) p.gold += fx2.gold;
  if (fx2.xp) addXp(p, fx2.xp);
  if (fx2.shield) k.shield += fx2.shield;
  if (fx2.fortune) {
    k.fortune += fx2.fortune;
    k.fortuneLeft = fx2.fortuneRounds ?? 5;
  }
  if (fx2.hpRerolls) k.hpRerolls += fx2.hpRerolls;
  if (fx2.freeReroll) k.freeReroll = Math.min(1, k.freeReroll + fx2.freeReroll);
  if (fx2.fastPromo) k.fastPromo += fx2.fastPromo;
  if (fx2.paydayRounds) {
    k.paydayLeft += fx2.paydayRounds;
    k.paydayAmt = fx2.paydayAmt ?? 7;
  }
  if (fx2.trustFund) {
    k.trustFund = true;
    const g = { 8: 8, 9: 16, 10: 25 }[p.level];
    if (g && p.level >= 8) p.gold += g;
  }
  if (fx2.festive) k.festive = true;
  if (fx2.allyCall) k.allyCall = true;
  if (fx2.merrier) k.merrier = true;
  if (fx2.fountain) k.fountain = true;
  if (fx2.interestCap) k.interestCap = Math.max(k.interestCap, fx2.interestCap);
  if (fx2.xpDiscount) k.xpMul *= 1 - fx2.xpDiscount;
  if (fx2.shopMod) k.shopMod = k.shopMod.map((v, i) => v + (fx2.shopMod[i] ?? 0));
}
function activeSynergies(p) {
  const counts = traitCounts(deployed(p));
  let n = 0;
  for (const [t, c] of Object.entries(counts)) {
    const th = SYNERGIES[t]?.thresholds ?? [2, 4, 6];
    if (c >= th[0]) n++;
  }
  return n;
}
function autoCard(m, p) {
  for (let g = 0; g < 3 && p.card; g++) {
    const c = p.card, id = c.options[0];
    applyCard(m, p, GOGO.cards.find((x) => x.id === id));
    afterCard(m, p, c.rarity, c.options);
    delete p.card;
    if (p.cardExtra) {
      p.cardExtra--;
      nextCard(m, p, c.rarity, [id]);
    }
  }
  if (!p.human) autoBless(m, p);
}
var BROCK_ROUND = 9;
function afterCard(m, p, rarity, _o) {
  if (p.commander === "Brock" && m.round === BROCK_ROUND) addXp(p, rarity === "Epic" ? 16 : rarity === "Common" ? 26 : 0);
}
function nextCard(m, p, rarity, avoid) {
  const options = drawCards(m, rarity, avoid);
  if (options.length) p.card = { rarity, options, rerolls: options.map(() => GOGO.rerolls) };
}
function trapReward(m, p, hitId) {
  if (p.commander !== "Blue" || !p.cmd?.trap) return;
  if (hitId && BY_ID[hitId]) {
    if (bench(p).length < RULES.benchSize) {
      const base = BY_ID[hitId].evolutionLine?.[0] ?? hitId;
      const d = BY_ID[base] ?? BY_ID[hitId];
      if ((m.pool[d.poolId ?? d.id] ?? 0) > 0) m.pool[d.poolId ?? d.id]--;
      p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
      merge(p, m);
    }
    p.gold += 1;
  } else p.gold += 1;
}
function cmdSkill(m, p, a) {
  const c = p.cmd ||= { used: 0 }, u = a.uid !== void 0 ? p.units.find((x) => x.uid === a.uid) : void 0;
  switch (p.commander) {
    case "Sabrina": {
      if (m.round < 2) return fail("Power of Chaos unlocks after Stage I-2.");
      if (c.used >= 1) return fail("Power of Chaos has no uses left.");
      if (!u) return fail("Select a Hero.");
      if (u.blessing) return fail("Choose a Hero without a Blessing.");
      const opts = blessOptions(m, u);
      u.blessing = opts[Math.floor(m.rng() * opts.length)];
      c.used++;
      const t = u.blessing, odds = RULES.shopOdds[String(p.level)] ?? RULES.shopOdds["3"], has = (d) => [...d.types ?? [d.faction], d.role, d.faction].includes(t);
      for (let n = 0; n < 2 && bench(p).length < RULES.benchSize; n++) {
        let roll = Math.floor(m.rng() * 100) + 1, tier = 1;
        for (let i = 0; i < odds.length; i++) {
          roll -= odds[i];
          if (roll <= 0) {
            tier = i + 1;
            break;
          }
        }
        let cand = ROSTER.filter((d2) => !d2.evolutionOnly && d2.tier === tier && has(d2) && (m.pool[d2.poolId ?? d2.id] ?? 0) > 0);
        if (!cand.length) cand = ROSTER.filter((d2) => !d2.evolutionOnly && has(d2) && (m.pool[d2.poolId ?? d2.id] ?? 0) > 0);
        if (!cand.length) break;
        const d = cand[Math.floor(m.rng() * cand.length)];
        m.pool[d.poolId ?? d.id]--;
        p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
      }
      p.gold += 2;
      merge(p, m);
      return ok();
    }
    case "Misty":
      if (!u) return fail("Select a Hero.");
      c.water = u.uid;
      return ok();
    case "Joy":
      if (!u) return fail("Select an ally to protect.");
      c.love = u.uid;
      return ok();
    case "Blue":
      if (a.col === void 0 || a.row === void 0 || !validCell(a.col, a.row)) return fail("Place the trap on your half of the board.");
      c.trap = { col: a.col, row: a.row };
      return ok();
    default:
      return fail("Brock's skill is used in the Go Go Card stage.");
  }
}
function autoPick(p) {
  while (p.picks && p.picks.length) {
    const o = p.picks.shift();
    p.items.push(o[0]);
  }
}
var xpNeed = (p) => Math.max(1, Math.ceil((RULES.xpToLevel[String(p.level)] ?? 0) * pk(p).xpMul));
function addXp(p, amount) {
  p.xp += amount;
  while (p.level < RULES.maxLevel && p.xp >= xpNeed(p)) {
    p.xp -= xpNeed(p);
    p.level++;
    if (pk(p).trustFund) {
      const g = { 8: 8, 9: 16, 10: 25 }[p.level];
      if (g) p.gold += g;
    }
  }
  if (p.level === RULES.maxLevel) p.xp = 0;
}
function rerollCost(p) {
  return RULES.rerollCost;
}
function act(m, p, action) {
  const LIVE_ACTIONS = ["buy", "sell", "reroll", "xp", "lock"];
  if (p.eliminated || m.phase === "Finished") return fail("You can't act right now.");
  if (m.phase !== "Preparation" && !LIVE_ACTIONS.includes(action.a)) return fail("You can only do that during preparation.");
  switch (action.a) {
    case "buy":
      return Number.isInteger(action.slot) ? buy(m, p, action.slot) : fail("Bad slot.");
    case "sell":
      return sell(m, p, action.uid);
    case "move":
      return move(p, action.uid, action.col, action.row);
    case "equip":
      return equip(p, action.uid, action.item);
    case "unequip":
      return unequip(p, action.uid, action.index);
    case "cardpick": {
      const c = p.card;
      if (!c || !c.options.includes(action.id)) return fail("No card to choose.");
      applyCard(m, p, GOGO.cards.find((x) => x.id === action.id));
      afterCard(m, p, c.rarity, c.options);
      delete p.card;
      if (p.cardExtra) {
        p.cardExtra--;
        nextCard(m, p, c.rarity, [action.id]);
      }
      return ok();
    }
    case "cmd":
      return cmdSkill(m, p, action);
    case "cardreroll": {
      const c = p.card, i = action.slot;
      if (!c || !(i >= 0 && i < c.options.length)) return fail("No card to refresh.");
      if (!(c.rerolls[i] > 0)) return fail("No refreshes left on that card.");
      c.rerolls[i]--;
      const pool = GOGO.cards.filter((x) => x.rarity === c.rarity && !c.options.includes(x.id));
      if (pool.length) c.options[i] = pool[Math.floor(m.rng() * pool.length)].id;
      return ok();
    }
    case "bless": {
      const q = p.bless?.[0];
      if (!q || q.uid !== null) return fail("Nothing to bless.");
      const u = p.units.find((x) => x.uid === action.uid);
      if (!u || u.blessing) return fail("Choose a Pok\xE9mon without a Blessing.");
      q.uid = u.uid;
      q.options = blessOptions(m, u);
      return ok();
    }
    case "blesspick": {
      const q = p.bless?.[0], u = q && p.units.find((x) => x.uid === q.uid);
      if (!q || !u || !q.options?.includes(action.type)) return fail("Nothing to choose.");
      u.blessing = action.type;
      p.bless.shift();
      return ok();
    }
    case "transfer": {
      const a = p.units.find((x) => x.uid === action.from), b = p.units.find((x) => x.uid === action.to), i = p.items.indexOf("blessing_transfer");
      if (i < 0) return fail("You need a Blessing Transfer.");
      if (!a?.blessing || !b || b.blessing || a === b) return fail("Pick a blessed Pok\xE9mon and an unblessed target.");
      b.blessing = a.blessing;
      delete a.blessing;
      p.items.splice(i, 1);
      return ok();
    }
    case "pick": {
      const o = p.picks?.[0];
      if (!o || !o.includes(action.item)) return fail("Nothing to pick.");
      p.items.push(action.item);
      p.picks.shift();
      return ok();
    }
    case "lock":
      p.shopLocked = !p.shopLocked;
      return ok();
    case "ready":
      p.ready = true;
      return ok();
    case "evolve":
      return evolve(p, action.uid, action.stone);
    case "reroll": {
      if (p.shopLocked) return fail("Unlock the shop before refreshing.");
      const k = pk(p), free = k.freeReroll > 0 && m.rng() < k.freeReroll;
      if (free) {
        p.rerolled = true;
        rollShop(m, p);
        return ok();
      }
      if (k.hpRerolls > 0) {
        if (p.hp <= 1) return fail("Not enough HP.");
        k.hpRerolls--;
        p.hp -= 1;
        p.rerolled = true;
        rollShop(m, p);
        return ok();
      }
      const cost = rerollCost(p);
      if (p.gold < cost) return fail("Not enough gold.");
      p.gold -= cost;
      p.rerolled = true;
      rollShop(m, p);
      return ok();
    }
    case "xp":
      if (p.level === RULES.maxLevel) return fail("Maximum capacity reached.");
      if (p.gold < RULES.economy.xpBuyGold) return fail(`You need ${RULES.economy.xpBuyGold} gold.`);
      p.gold -= RULES.economy.xpBuyGold;
      addXp(p, RULES.economy.xpBuyAmount);
      return ok();
  }
  return fail("Unknown action.");
}
var stageBonus = (round) => {
  const st = Math.floor((Math.max(1, round) - 1) / 6) + 1;
  return st >= 5 ? 3 : st === 4 ? 2 : st === 3 ? 1 : 0;
};
function income(p, round = 1) {
  const e = RULES.economy, n = Math.abs(p.streak);
  const streak = e.streaks.reduce((b, [lo, hi, g]) => n >= lo && n <= hi ? g : b, 0);
  const result = p.lastResult === "win" ? e.winBonus : p.lastResult === "loss" ? e.lossBonus : 0;
  return e.baseIncome + stageBonus(round) + result + Math.min(Math.max(e.interestMax, pk(p).interestCap), Math.floor(p.gold / e.interestPer)) + streak;
}
function recordResult(p, won) {
  if (pk(p).merrier) p.gold += activeSynergies(p);
  p.lastResult = won ? "win" : "loss";
  p.streak = won ? p.streak > 0 ? p.streak + 1 : 1 : p.streak < 0 ? p.streak - 1 : -1;
}
function roundPerks(m, p) {
  const k = pk(p);
  if (k.paydayLeft > 0) {
    k.paydayLeft--;
    p.gold += k.paydayAmt;
  }
  if (k.fountain) p.hp = Math.min(RULES.startHealth, p.hp + 3);
  if (k.fortune > 0 && k.fortuneLeft > 0 && --k.fortuneLeft === 0) {
    p.gold += k.fortune;
    k.fortune = 0;
  }
  if (k.festive) {
    const cost = Math.max(1, p.level - 5), pool = ROSTER.filter((d) => !d.evolutionOnly && (m.pool[d.poolId ?? d.id] ?? 0) > 0);
    if (p.gold >= cost && pool.length && bench(p).length < RULES.benchSize) {
      const d = pool[Math.floor(m.rng() * pool.length)];
      p.gold -= cost;
      m.pool[d.poolId ?? d.id]--;
      p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
      merge(p, m);
    }
  }
}
function prepare(m) {
  m.round++;
  m.phase = "Preparation";
  for (const p of m.players) {
    p.ready = false;
    if (p.eliminated) continue;
    if (m.round > 1) {
      p.gold += income(p, m.round);
      addXp(p, RULES.economy.xpPerRound);
    }
    p.rerolled = false;
    if (m.round > 1) roundPerks(m, p);
    grantBlessings(m, p);
    grantCards(m, p);
    if (!p.human) {
      autoCard(m, p);
      autoBless(m, p);
    }
    if (!(p.shopLocked && p.shop.some(Boolean))) rollShop(m, p);
  }
}
function eliminate(m, p) {
  if (p.eliminated) return;
  p.eliminated = true;
  p.hp = 0;
  p.shopLocked = false;
  releaseShop(m, p);
  for (const u of p.units) m.pool[BY_ID[u.id].poolId ?? u.id] += 3 ** (u.stars - 1);
  p.units = [];
  p.items = [];
}
function botTurn(m, p, difficulty = "Intermediate") {
  const advanced = difficulty !== "Beginner";
  {
    const best = [...p.units].sort((x, y) => y.stars - x.stars || Number(y.col !== null) - Number(x.col !== null))[0];
    if (p.commander === "Sabrina" && m.round >= 2 && !p.cmd?.used) {
      const u = p.units.find((x) => !x.blessing);
      if (u) cmdSkill(m, p, { uid: u.uid });
    } else if ((p.commander === "Misty" || p.commander === "Joy") && best) cmdSkill(m, p, { uid: best.uid });
    else if (p.commander === "Blue" && !p.cmd?.trap) cmdSkill(m, p, { col: Math.floor(m.rng() * RULES.cols), row: Math.floor(m.rng() * RULES.rows / 2) });
  }
  const attempts = difficulty === "Hard" ? 4 : 2;
  const faction = RULES.factions[p.seat % RULES.factions.length];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const slots = [0, 1, 2, 3, 4];
    if (advanced) {
      const score = (slot) => {
        const d = p.shop[slot] ? BY_ID[p.shop[slot]] : null;
        if (!d) return -1;
        let s = d.tier + (d.faction === faction ? 4 : 0);
        for (const u of p.units) if (u.id === d.id && u.stars < 3) s += 5;
        return s;
      };
      slots.sort((a, b) => score(b) - score(a));
    }
    for (const slot of slots) if (bench(p).length < 5) buy(m, p, slot);
    if (p.gold >= 6 && attempt < attempts) act(m, p, { a: "reroll" });
  }
  if (p.gold >= 6 && p.level < RULES.maxLevel) act(m, p, { a: "xp" });
  const sorted = [...p.units].sort((a, b) => BY_ID[b.id].tier * 2 + b.stars * 5 - (BY_ID[a.id].tier * 2 + a.stars * 5));
  for (const u of p.units) {
    u.col = null;
    u.row = null;
  }
  const taken = /* @__PURE__ */ new Set();
  sorted.slice(0, p.level).forEach((u) => {
    const front = BY_ID[u.id].range === 1;
    for (let off = 0; off < 4 && u.col === null; off++) {
      const row = front ? 3 - off : off;
      for (let col = 0; col < RULES.cols; col++) {
        if (!taken.has(row * RULES.cols + col)) {
          taken.add(row * RULES.cols + col);
          u.col = col;
          u.row = row;
          break;
        }
      }
    }
  });
  while (bench(p).length > RULES.benchSize) sell(m, p, bench(p)[bench(p).length - 1].uid);
  for (const u of deployed(p)) for (let i = p.items.length - 1; i >= 0; i--) if (u.items.length < 3 && !u.items.includes(p.items[i])) u.items.push(p.items.splice(i, 1)[0]);
}

// server/supply.ts
var STAGE_LEN = Number(process.env.STAGE_LEN ?? 6);
var stageOf = (round) => Math.floor((Math.max(1, round) - 1) / STAGE_LEN) + 1;
var GOLD_REWARD = 8;
var rank = { Rare: 1, Epic: 2, Legendary: 3, Mega: 4 };
var pickFrom = (m, a) => a[Math.floor(m.rng() * a.length)];
function shuffle(m, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(m.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildSupply(m, stage, n) {
  let nid = 0;
  const E = (e) => ({ id: ++nid, by: null, ...e });
  const item = (r) => {
    const it = pickFrom(m, ITEM_LIST.filter((i) => i.rarity === r));
    return E({ kind: "item", key: it.key, label: it.id, text: it.text, icon: it.icon ?? null, rarity: r });
  };
  const recruit = (lo, hi, tag) => {
    const c = ROSTER.filter((u2) => !u2.evolutionOnly && u2.tier >= lo && u2.tier <= hi && (m.pool[u2.poolId ?? u2.id] ?? 0) > 0);
    const u = pickFrom(m, c.length ? c : ROSTER.filter((x) => !x.evolutionOnly));
    return E({ kind: "unit", unitId: u.id, label: u.name, text: `${tag}: a ${u.tier}-cost Pok\xE9mon joins your bench.`, icon: null });
  };
  const gold = () => E({ kind: "gold", label: `${GOLD_REWARD} Gold`, text: `Gain ${GOLD_REWARD} gold.`, icon: "art/ui/icons/gold.png" });
  const bless = (nth) => E({ kind: "bless", label: "Blessing Crystal", text: `${nth} Blessing: one Pok\xE9mon gains +1 synergy count of a type you choose.`, icon: "art/types/Fairy.png" });
  const stone = () => {
    const s = pickFrom(m, STONES);
    return E({ kind: "stone", key: s.key, label: s.id, text: s.text, icon: s.icon ?? null, rarity: s.rarity });
  };
  const mirror2 = () => E({ kind: "mirror", label: "Mirror Device", text: "Copy your best piece of equipment (bag or equipped).", icon: "art/types/Psychic.png" });
  const mega = () => {
    const s = pickFrom(m, SPECIAL_ITEMS.filter((x) => x.key.startsWith("mega_")));
    return E({ kind: "special", key: s.key, label: s.id, text: s.text, icon: s.icon ?? null, rarity: "Mega" });
  };
  const t = stage <= 1 ? [() => recruit(2, 3, "Recruit"), () => item("Rare"), () => recruit(1, 2, "Recruit"), () => item("Rare"), gold, () => item("Rare"), () => recruit(2, 3, "Recruit"), gold] : stage === 2 ? [() => bless("First"), () => item("Epic"), stone, () => item("Epic"), stone, () => item("Epic"), gold, () => recruit(3, 3, "Recruit")] : stage === 3 ? [() => bless("Second"), () => item("Legendary"), mirror2, () => item("Legendary"), () => item("Epic"), mirror2, () => item("Legendary"), () => item("Epic")] : [() => bless("Final"), mega, () => item("Legendary"), () => recruit(4, 5, "Rare recruit"), mega, () => item("Legendary"), () => recruit(4, 5, "Rare recruit"), () => item("Legendary")];
  return shuffle(m, t.slice(0, Math.max(2, n)).map((f) => f())).map((e, i) => ({ ...e, id: i + 1 }));
}
var SORT = (a, b) => a.hp - b.hp || a.seat - b.seat;
var supplyOrder = (m) => m.players.filter((p) => !p.eliminated).sort(SORT).map((p) => p.seat);
function claim(m, p, e) {
  switch (e.kind) {
    case "unit": {
      const id = e.unitId, d = BY_ID[id], pk2 = d.poolId ?? id;
      if (bench(p).length >= RULES.benchSize && p.units.filter((u) => u.id === id && u.stars === 1).length < 2) {
        p.gold += d.tier;
        break;
      }
      if ((m.pool[pk2] ?? 0) > 0) m.pool[pk2]--;
      p.units.push({ uid: ++m.nextUid, id, stars: 1, col: null, row: null, items: [] });
      merge(p, m);
      break;
    }
    case "item":
    case "stone":
    case "special":
      p.items.push(e.key);
      break;
    case "gold":
      p.gold += GOLD_REWARD;
      break;
    case "bless":
      (p.bless ||= []).push({ uid: null });
      break;
    case "mirror": {
      const all = [...p.items, ...p.units.flatMap((u) => u.items)].filter((k) => ITEM_LIST.some((i) => i.key === k) || CRYSTALS.some((c) => c.key === k));
      const best = all.sort((a, b) => (rank[ITEM_LIST.find((i) => i.key === b)?.rarity ?? "Rare"] ?? 2) - (rank[ITEM_LIST.find((i) => i.key === a)?.rarity ?? "Rare"] ?? 2))[0];
      if (best) p.items.push(best);
      else p.gold += GOLD_REWARD;
      break;
    }
  }
}
function botChoice(entries) {
  const score = (e) => ({ bless: 9, special: 8, mirror: 5, unit: e.label && 4, stone: 3, gold: 1, item: 2 + (rank[e.rarity ?? "Rare"] ?? 1) })[e.kind] ?? 1;
  return entries.filter((e) => e.by === null).sort((a, b) => score(b) - score(a))[0];
}

// server/server.ts
var import_node_http = require("node:http");
var import_promises = require("node:fs/promises");
var import_node_fs3 = require("node:fs");
var import_node_path3 = require("node:path");

// ../anime-autochess-pc/node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// server/abilities.ts
var ABILITY_FNS = {
  yuji(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.4, () => c.phys(tg, c.ad * a.ad));
    c.at(0.4 + a.delay, () => {
      if (tg.alive) c.mag(tg, (a.base2 * c.S + a.ad2 * c.ad) * c.P);
    });
    c.lock(1);
  },
  nobara(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P);
      tg.nobMark = { until: c.t + 0.5 + a.duration, left: 3, v: a.mark * c.S * c.P };
    });
  },
  megumi(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.4, () => c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P));
    c.at(0.8, () => {
      c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P);
      c.mod(tg, { armorPct: -a.shred, mrPct: -a.shred }, a.shredDuration);
    });
    c.lock(1);
  },
  yuta(c) {
    const a = c.a, low = c.lowestAllies(1)[0];
    const tg = c.target;
    c.at(0.4, () => {
      if (low) {
        c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower);
        c.shield(low, a.shield * c.S * c.u.healPower, 4);
      }
    });
    c.at(0.8, () => {
      if (tg && tg.alive) c.mag(tg, c.ad * a.ad2 * c.P);
    });
    c.lock(1);
  },
  gojo(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(a.windup, () => {
      const hits = c.line(tg, 9);
      hits.forEach((v, i) => c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P * Math.max(0.55, 1 - 0.15 * i), { kind: "ability" }));
    });
    c.lock(a.windup + 0.4);
  },
  kobeni(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.dashAdj(tg);
    c.mod(c.u, { dr: 0.2 }, 1);
    for (let i = 0; i < 3; i++) c.at(0.2 + i * 0.2, () => {
      if (tg.alive) c.phys(tg, c.ad * a.ad / 3);
    });
    c.lock(0.8);
  },
  aki(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      const raw = (a.base * c.S + a.ad * c.ad) * c.P;
      c.mag(tg, raw);
      c.stun(tg, a.stun);
      for (const v of c.adjacentFoes(tg)) c.mag(v, raw * 0.4, { area: true });
    });
    c.lock(0.9);
  },
  power(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    c.at(0.5, () => {
      c.phys(tg, c.ad * a.ad);
      for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.6, { area: true });
    });
    c.lock(0.9);
  },
  denji(c) {
    const a = c.a;
    if (!c.transformed) {
      c.transform({ hp: a.hp, speed: a.speed });
      c.lock(0.8);
      return;
    }
    const tg = c.target;
    if (!tg) return;
    c.at(0.5, () => {
      c.phys(tg, c.ad * a.ad * 1.25);
      c.mod(tg, { heal: -0.3 }, 4);
    });
    c.lock(0.9);
  },
  makima(c) {
    const a = c.a;
    c.at(a.windup, () => {
      const pool = c.foes.filter((v) => !v.boss && !(v.immuneUntil > c.t));
      const victim = c.foes.length > 1 ? pool.sort((x, y) => y.ad - x.ad)[0] : null;
      if (victim) c.control(victim, a.controlSeconds, a.controlBasicMultiplier);
      else {
        const tg = c.target;
        if (tg) {
          c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P);
          c.mod(tg, { ad: -a.fallbackWeak }, a.fallbackDuration);
        }
      }
    });
    c.lock(a.windup + 0.4);
  },
  silica(c) {
    const a = c.a, low = c.lowestAllies(1)[0];
    if (!low) return;
    c.at(0.4, () => {
      c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower);
      c.mod(low, { armor: a.defense, mr: a.defense }, 4);
    });
  },
  lisbeth(c) {
    const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    const adj = c.allyRing(c.u, 1).filter((v) => v !== c.u).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, 2);
    for (const v of adj) c.shield(v, v.maxHp * a.shield * 0.5, 4);
    c.lock(0.6);
  },
  sinon(c) {
    const a = c.a, far = c.farthestFoe(4) ?? c.target;
    if (!far) return;
    c.at(a.windup, () => {
      c.line(far, 9).slice(0, 3).forEach((v, i) => c.phys(v, c.ad * a.ad * (i === 0 ? 1 : 0.6), { pen: a.penetration }));
    });
    c.lock(a.windup + 0.4);
  },
  asuna(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.dashAdj(tg);
    c.at(0.3, () => c.phys(tg, c.ad * a.ad));
    c.mod(c.u, { speed: a.speed }, 3);
    c.lock(0.7);
  },
  kirito(c) {
    const a = c.a;
    let tg = c.target;
    if (!tg) return;
    for (let i = 0; i < 8; i++) c.at(0.2 * (i + 1), () => {
      if (tg && !tg.alive) tg = c.adjacentFoes(tg)[0]?.alive ? c.adjacentFoes(tg)[0] : c.foes.find((v) => v.alive) ?? null;
      if (tg && tg.alive) c.phys(tg, c.ad * a.ad / 8);
    }, true);
    c.lock(a.duration + 0.2);
  },
  reiner(c) {
    const a = c.a;
    if (!c.transformed) {
      c.transform({ hp: a.hp, armor: a.armor });
      c.lock(0.8);
      return;
    }
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    const tg = c.target;
    if (tg) c.at(0.4, () => c.phys(tg, c.ad * a.ad * 1.25));
    c.lock(0.8);
  },
  armin(c) {
    const a = c.a, tg = c.target;
    const dmg = (a.base * c.S + a.ad * c.ad) * c.P;
    if (!c.transformed) {
      c.at(a.windup, () => {
        c.transform({});
        for (const v of c.ring(c.u, a.transformRadius)) {
          c.mag(v, dmg * a.firstDamage * 1.25, { area: true });
          c.mod(v, { speed: -a.slow }, 3);
        }
      });
      c.lock(a.windup + 0.4);
      return;
    }
    if (!tg) return;
    c.at(a.windup, () => {
      for (const v of c.ring(tg, 1)) {
        c.mag(v, dmg * 1.25, { area: true });
        c.mod(v, { speed: -a.slow }, 3);
      }
    });
    c.lock(a.windup + 0.4);
  },
  mikasa(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const others = c.adjacentFoes(tg).slice(0, 2);
    c.dashBehind(tg);
    c.at(0.3, () => {
      c.phys(tg, c.ad * a.ad);
      for (const v of others) c.phys(v, c.ad * a.ad * 0.5, { area: true });
    });
    c.mod(c.u, { speed: a.speed }, 3);
    c.lock(0.7);
  },
  levi(c) {
    const a = c.a, tg = c.lowestFoe(3) ?? c.target;
    if (!tg) return;
    c.dashAdj(tg);
    c.mod(c.u, { dr: 0.3 }, a.duration);
    for (let i = 0; i < 6; i++) c.at(0.2 * (i + 1), () => {
      let v = tg;
      if (!v.alive) v = c.adjacentFoes(tg)[0] ?? c.foes.find((x) => x.alive);
      if (v && v.alive) c.phys(v, c.ad * a.ad / 6);
    }, true);
    c.lock(a.duration + 0.2);
  },
  eren(c) {
    const a = c.a;
    if (!c.transformed) {
      c.transform({ hp: a.hp, ad: a.attack });
      c.lock(0.8);
      return;
    }
    const tg = c.target;
    if (!tg) return;
    c.at(0.5, () => {
      for (const v of c.cone(tg, 2, 60)) {
        c.phys(v, c.ad * a.ad * 1.25, { area: true });
        c.stun(v, a.stun);
      }
    });
    c.lock(0.9);
  },
  amon(c) {
    const a = c.a, tg = c.target;
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    c.mod(c.u, { armor: a.armor }, 4);
    if (tg) c.at(0.4, () => c.phys(tg, c.ad * a.ad));
    c.lock(0.8);
  },
  arima(c) {
    const a = c.a, tg = c.target;
    const lance = c.u.castCount % 2 === 0;
    c.u.castCount++;
    if (lance) {
      if (!tg) return;
      c.at(0.5, () => {
        c.phys(tg, c.ad * a.ad);
        const behind = c.line(tg, 3).filter((v) => v !== tg)[0];
        if (behind) c.phys(behind, c.ad * a.ad * 0.5, { area: true });
      });
    } else {
      c.shield(c.u, a.shield * c.S * c.u.healPower, 4);
      c.u.counter = { until: c.t + 4, ad: a.ad2 };
    }
    c.lock(0.9);
  },
  touka(c) {
    const a = c.a;
    const near = c.foes.filter((v) => c.ring(c.u, 3).includes(v)).sort((x, y) => dist(c.u, x) - dist(c.u, y)).slice(0, 3);
    if (!near.length) {
      if (c.target) near.push(c.target);
      else return;
    }
    const per = (a.base * c.S + a.ad * c.ad) * c.P;
    for (let i = 0; i < 5; i++) {
      const v = near[i % near.length];
      c.at(0.3 + i * 0.1, () => {
        if (v.alive) c.mag(v, per);
      });
    }
    c.lock(1);
  },
  juuzou(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    for (let i = 0; i < 4; i++) c.at(0.2 * (i + 1), () => {
      if (!tg.alive) return;
      if (i === 0) c.mod(tg, { armorPct: -a.shred }, 4);
      c.phys(tg, c.ad * a.ad / 4);
    }, true);
    c.lock(a.duration + 0.2);
  },
  kaneki(c) {
    const a = c.a;
    if (!c.transformed) {
      c.transform({ hp: a.hp, vamp: a.vamp });
      c.lock(0.8);
      return;
    }
    const tg = c.target;
    if (!tg) return;
    c.at(0.5, () => {
      for (const v of c.cone(tg, 2, 60)) c.phys(v, c.ad * a.ad * 1.25, { area: true });
      c.heal(c.u, c.u.maxHp * a.heal);
    });
    c.lock(0.9);
  },
  panda(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, a.buffDuration);
    c.mod(c.u, { dr: a.reduction }, a.buffDuration);
    c.at(a.impact, () => {
      c.phys(tg, c.ad * a.ad);
      for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * a.splash, { area: true });
    });
    c.lock(a.duration);
  },
  nanami(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const marked = !!tg.nanMark;
    c.at(a.impact, () => {
      if (marked) {
        c.phys(tg, c.ad * a.repeatAd);
        c.stun(tg, a.stun);
      } else {
        c.phys(tg, c.ad * a.ad);
        tg.nanMark = true;
      }
    });
    c.lock(marked ? a.repeatDuration : a.duration);
  },
  shoko(c) {
    const a = c.a, low = c.lowestAllies(1)[0];
    if (!low) return;
    c.at(a.impact, () => {
      c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower);
      c.cleanse(low);
      c.mod(low, { dr: a.reduction }, a.buffDuration);
    });
    c.lock(a.duration);
  },
  katana_man(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const others = c.adjacentFoes(tg).slice(0, a.maxSecondary);
    c.at(a.impact, () => {
      c.dashBehind(tg);
      c.phys(tg, c.ad * a.ad);
      for (const v of others) c.phys(v, c.ad * a.ad * a.splash, { area: true });
    });
    c.lock(a.duration);
  },
  reze(c) {
    const a = c.a, per = (a.base * c.S + a.ad * c.ad) * c.P * 1.25;
    if (!c.transformed) {
      c.at(a.impact, () => {
        c.transform({});
        for (const v of c.ring(c.u, 1)) c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P * 1.25, { area: true });
      });
      c.lock(a.duration);
      return;
    }
    let tg = c.target;
    if (!tg) return;
    for (const cue of a.cues) c.at(cue, () => {
      if (tg && !tg.alive) tg = c.foes.find((v) => v.alive && dist(c.u, v) <= c.u.range) ?? null;
      if (!tg) return;
      c.mag(tg, per);
      for (const v of c.adjacentFoes(tg)) c.mag(v, per * a.splash, { area: true });
    });
    c.lock(a.duration);
  },
  himeno(c) {
    const a = c.a, tg = c.target, low = c.lowestAllies(1)[0];
    c.at(a.impact, () => {
      if (tg && tg.alive) {
        c.stun(tg, a.stun);
        c.mod(tg, { ad: -a.attackReduction }, a.buffDuration);
      }
      if (low) c.shield(low, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, 4);
    });
    c.lock(a.duration);
  },
  akane(c) {
    const a = c.a;
    const inRange = c.foes.filter((v) => dist(c.u, v) <= 3);
    const tg = inRange.sort((x, y) => y.mana / (y.maxMana || 1) - x.mana / (x.maxMana || 1))[0] ?? c.target;
    if (!tg) return;
    c.at(a.impact, () => {
      c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P);
      c.silence(tg, a.silence);
    });
    c.lock(a.duration);
  },
  heathcliff(c) {
    const a = c.a;
    c.at(a.impact, () => {
      c.shield(c.u, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, a.effectDuration);
      for (const v of c.allyRing(c.u, 1)) if (v !== c.u) c.mod(v, { dr: a.reduction }, a.effectDuration);
    });
    c.lock(a.duration);
  },
  yuuki(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    a.cues.slice(0, 10).forEach((cue) => c.at(cue, () => {
      if (tg.alive) c.phys(tg, c.ad * a.strikeAd);
    }, true));
    c.at(a.cues[10], () => {
      if (tg.alive) c.phys(tg, c.ad * a.finisherAd * (1 + a.missingHealthScale * (1 - tg.hp / tg.maxHp)));
    }, true);
    c.lock(a.duration);
  },
  leafa(c) {
    const a = c.a;
    c.at(a.impact, () => {
      for (const v of c.lowestAllies(a.maxAllies, 3)) {
        c.heal(v, (a.healBase * c.S + a.healAd * c.ad) * c.u.healPower);
        c.mod(v, { speed: a.attackSpeedBonus }, a.effectDuration);
      }
    });
    c.lock(a.duration);
  },
  eugeo(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(a.release, () => {
      for (const v of c.line(tg, a.length)) {
        c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P, { area: true });
        c.root(v, a.root);
      }
    });
    c.lock(a.duration);
  },
  kenny(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.reposition(tg, a.preferredTargetDistance[0], a.preferredTargetDistance[1], a.repositionRange);
    for (const cue of a.cues) c.at(cue, () => {
      if (tg.alive) c.phys(tg, c.ad * a.ad);
    });
    c.lock(a.duration);
  },
  sasha(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.u.focus = { tg, until: c.t + a.effectDuration, count: 0, third: a.thirdAd };
    c.lock(a.duration);
  },
  erwin(c) {
    const a = c.a;
    c.at(a.impact, () => {
      for (const v of c.allyRing(c.u, a.radius)) c.mod(v, { ad: a.attackBonus, speed: a.attackSpeedBonus }, a.effectDuration);
    });
    c.lock(a.duration);
  },
  ayato(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.reposition(tg, 2, c.u.range, a.repositionRange);
    for (const cue of a.cues) c.at(cue, () => {
      if (tg.alive) c.phys(tg, c.ad * a.ad);
    });
    c.mod(c.u, { speed: a.attackSpeedBonus }, a.effectDuration);
    c.lock(a.duration);
  },
  yoshimura(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const cell = { col: tg.col, row: tg.row };
    c.at(a.release, () => {
      for (const v of c.foes) {
        const d = dist(cell, v);
        if (d > a.radius) continue;
        c.phys(v, (a.base * c.S + a.ad * c.ad) * (d === 0 ? 1 : a.splash), { area: d > 0 });
      }
    });
    c.lock(a.duration);
  },
  hinami(c) {
    const a = c.a;
    c.at(a.impact, () => {
      for (const v of c.lowestAllies(a.maxAllies, 3)) {
        c.shield(v, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, a.effectDuration);
        for (const e of c.ring(v, 1)) c.mod(e, { speed: -a.attackSpeedReduction }, a.effectDuration);
      }
    });
    c.lock(a.duration);
  },
  tatara(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const dir2 = { col: tg.col, row: tg.row };
    a.cues.forEach((cue) => c.at(cue, () => {
      for (const v of c.cone(dir2, a.length, a.halfAngleDegrees)) c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P, { area: true });
    }, true));
    c.lock(a.duration);
  },
  // ---- PvE creeps and bosses ----
  kobold_sentinel(c) {
    const tg = c.target;
    if (!tg) return;
    c.at(0.4, () => {
      c.phys(tg, c.ad * 2);
      c.stun(tg, 0.5);
    });
    c.lock(0.8);
  },
  frenzy_boar(c) {
    const tg = c.target;
    if (!tg) return;
    c.at(0.4, () => c.phys(tg, c.ad * 2));
    c.lock(0.8);
  },
  lizardman_lord(c) {
    const tg = c.target;
    if (!tg) return;
    c.at(0.4, () => {
      for (const v of c.ring(tg, 1)) c.phys(v, c.ad * 1.6, { area: true });
    });
    c.lock(0.8);
  },
  illfang(c) {
    const tg = c.target;
    if (!tg) return;
    c.at(1, () => {
      c.phys(tg, c.ad * 1.6);
      c.stun(tg, 0.6);
      for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * 1.6 * 0.8, { area: true });
    }, true);
    c.lock(1.3);
  },
  gleam_eyes(c) {
    const tg = c.target;
    if (!tg) return;
    const dir2 = { col: tg.col, row: tg.row };
    c.at(1, () => {
      for (const v of c.cone(dir2, 2, 60)) c.phys(v, c.ad * 1.7, { area: true });
    }, true);
    c.lock(1.3);
  },
  skull_reaper(c) {
    const lone = c.foes.filter((v) => !c.adjacentFoes(v).length);
    const pool = lone.length ? lone : c.foes;
    const tg = c.farthestFoe(99, pool);
    if (!tg) return;
    if (c.u.stormPhase && c.u.castCount++ % 2 === 1) {
      for (let i = 0; i < 4; i++) c.at(0.5 * (i + 1), () => {
        for (const v of [...c.foes].filter((x) => x.alive).sort((x, y) => dist(c.u, x) - dist(c.u, y)).slice(0, 3)) c.phys(v, c.ad * 0.35, { area: true });
      }, true);
      c.lock(2.2);
      return;
    }
    c.at(0.6, () => {
      c.dashAdj(tg);
      c.phys(tg, c.ad * 1.5);
    }, true);
    c.lock(1);
  }
};
function dist(a, b) {
  const aq = a.col - Math.floor(a.row / 2), bq = b.col - Math.floor(b.row / 2);
  const dq = aq - bq, dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
var fx = (c, tg) => {
  if (c.a.status && tg) c.status(tg, c.a.status, c.a.statusChance ?? 0.5);
};
var ARCHETYPES = {
  strike(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.3, () => {
      if (tg.alive) {
        c.phys(tg, (a.base * c.S * 0.5 + a.ad * c.ad) * c.P);
        fx(c, tg);
      }
    });
    c.lock(0.8);
  },
  burst(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      if (tg.alive) {
        c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P);
        fx(c, tg);
      }
    });
    c.lock(0.8);
  },
  nova(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      for (const v of c.ring(tg, a.radius)) {
        c.mag(v, (a.base * c.S * 0.7 + a.ad * c.ad * 0.8) * c.P, { area: true });
        fx(c, v);
      }
    });
    c.lock(1);
  },
  heal(c) {
    const a = c.a, low = c.lowestAllies(1)[0];
    if (!low) return;
    c.at(0.4, () => {
      c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower);
      c.cleanse(low);
    });
    c.lock(0.8);
  },
  shield(c) {
    const tg = c.target, a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, a.dur);
    c.mod(c.u, { dr: a.reduction }, a.dur);
    if (tg) c.at(0.4, () => {
      if (tg.alive) {
        c.phys(tg, c.ad * a.ad * 0.8);
        fx(c, tg);
      }
    });
    c.lock(0.8);
  }
};
Object.assign(ABILITY_FNS, {
  charizard(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.6, () => {
      for (const v of c.cone(tg, 3, 70)) {
        c.mag(v, (a.base * c.S * 0.9 + a.ad * c.ad) * c.P, { area: true });
        c.status(v, "burn", 0.7);
      }
    });
    c.lock(1.1);
  },
  gengar(c) {
    const tg = c.lowestFoe();
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      if (!tg.alive) return;
      const weak = tg.hp / tg.maxHp < 0.5 ? 1.3 : 1;
      c.mag(tg, (a.base * c.S * 1.3 + a.ad * c.ad * 1.2) * c.P * weak);
      c.status(tg, "confusion", 0.7);
    });
    c.lock(0.9);
  },
  greninja(c) {
    const tg = c.farthestFoe();
    if (!tg) return;
    const a = c.a;
    c.dashBehind(tg);
    c.at(0.3, () => {
      if (tg.alive) {
        c.phys(tg, c.ad * (a.ad + 0.5));
        c.status(tg, "slow", 0.6);
      }
    });
    c.lock(0.8);
  },
  gardevoir(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      for (const v of c.ring(tg, 2)) {
        c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true });
        c.status(v, "confusion", 0.4);
      }
    });
    c.lock(1);
  },
  blissey(c) {
    const a = c.a;
    const low = c.lowestAllies(2);
    if (!low.length) return;
    c.at(0.4, () => {
      for (const v of low) {
        c.heal(v, (a.base * c.S * 1.4 + a.ad * c.ad) * c.u.healPower);
        c.cleanse(v);
      }
    });
    c.lock(1);
  },
  snorlax(c) {
    const a = c.a, tg = c.target;
    c.shield(c.u, c.u.maxHp * 0.22, 4);
    c.mod(c.u, { dr: 0.2 }, 4);
    for (const v of c.allyRing(c.u, 1)) if (v !== c.u) c.shield(v, v.maxHp * 0.1, 3);
    if (tg) c.at(0.4, () => {
      for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.6, { area: true });
      if (tg.alive) c.phys(tg, c.ad * a.ad);
    });
    c.lock(1);
  },
  dragonite(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.dashAdj(tg);
    c.mod(c.u, { speed: 0.25, ad: 0.15 }, 4);
    c.at(0.3, () => {
      if (tg.alive) c.phys(tg, c.ad * (a.ad + 0.6));
    });
    c.lock(0.9);
  },
  tyranitar(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.4, () => {
      if (tg.alive) {
        c.phys(tg, c.ad * (a.ad + 0.4));
        c.mod(tg, { armorPct: -0.25 }, 4);
      }
      for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.5, { area: true });
    });
    c.lock(1);
  },
  alakazam(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.4, () => {
      if (tg.alive) {
        c.mag(tg, (a.base * c.S * 1.2 + a.ad * c.ad) * c.P);
        c.status(tg, "confusion", 0.5);
      }
    });
    for (const v of c.lowestAllies(2)) if (v !== c.u) v.mana = Math.min(v.maxMana, v.mana + 15);
    c.lock(0.9);
  },
  machamp(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    for (let i = 0; i < 4; i++) c.at(0.2 + i * 0.18, () => {
      if (tg.alive) c.phys(tg, c.ad * a.ad / 3);
    });
    c.lock(1);
  },
  ninetales(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      for (const v of c.ring(tg, 1.5)) {
        c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true });
        c.status(v, "burn", 0.6);
      }
    });
    c.lock(1);
  },
  politoed(c) {
    const a = c.a;
    c.at(0.4, () => {
      for (const v of c.allyRing(c.u, 3)) c.heal(v, (a.base * c.S * 0.5 + a.ad * c.ad * 0.4) * c.u.healPower);
    });
    c.lock(0.9);
  },
  abomasnow(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.5, () => {
      for (const v of c.ring(tg, 1.5)) {
        c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true });
        c.status(v, "freeze", 0.3);
      }
    });
    c.lock(1);
  },
  lucario(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    c.at(0.35, () => {
      if (tg.alive) c.mag(tg, (a.base * c.S * 1.1 + a.ad * c.ad * 1.2) * c.P, { pen: 0.3 });
    });
    c.lock(0.8);
  },
  raichu(c) {
    const tg = c.target;
    if (!tg) return;
    const a = c.a;
    const chain = [tg, ...c.foes.filter((v) => v !== tg).sort((x, y) => Math.abs(x.col - tg.col) + Math.abs(x.row - tg.row) - (Math.abs(y.col - tg.col) + Math.abs(y.row - tg.row))).slice(0, 2)];
    chain.forEach((v, i) => c.at(0.3 + i * 0.2, () => {
      if (v.alive) {
        c.mag(v, (a.base * c.S * (1 - i * 0.2) + a.ad * c.ad) * c.P);
        c.status(v, "paralysis", 0.5);
      }
    }));
    c.lock(1);
  }
});

// server/combat.ts
function hexDistance(a, b) {
  const aq = a.col - Math.floor(a.row / 2), bq = b.col - Math.floor(b.row / 2);
  const dq = aq - bq, dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
var mirror = (col, row) => ({ col: RULES.cols - 1 - col, row: RULES.rows - 1 - row });
var cx = (p) => p.col + (p.row % 2 ? 0.5 : 0);
var cy = (p) => p.row * 0.866;
var idx = (n) => n >= 4 ? 1 : n >= 2 ? 0 : -1;
var pick = (arr, i) => i < 0 ? 0 : arr[i];
function simulate(a, b, seed, opts = {}) {
  const rng = mulberry32(seed);
  const events = [];
  const units = [];
  let uid = 0, t = 0;
  const sides = [a, b];
  const traits = [0, 1].map((s) => sides[s].some((x) => x.npc) ? {} : traitCounts(sides[s]));
  const pending = [];
  const megaUsed = [false, false], gmaxUsed = [false, false];
  for (const side of [0, 1]) {
    const tc = traits[side];
    const T = (name) => idx(tc[name] ?? 0);
    const cmd = opts.commanders?.[side];
    for (const s of sides[side]) {
      const d = BY_ID[s.id];
      const scale = RULES.starScale ** (s.stars - 1);
      const pos = side === 0 ? { col: s.col, row: s.row } : mirror(s.col, s.row);
      const u = {
        uid: ++uid,
        id: s.id,
        side,
        cside: side,
        stars: s.stars,
        col: pos.col,
        row: pos.row,
        hp: d.health * scale * (s.hpMul ?? 1),
        maxHp: d.health * scale * (s.hpMul ?? 1),
        ad: d.attack * scale * (s.adMul ?? 1),
        armor: d.armor,
        mr: d.mr,
        speed: d.speed,
        range: d.range,
        mana: d.startMana,
        maxMana: d.maxMana,
        crit: d.crit,
        critDmg: d.critDamage,
        power: 1,
        healPower: 1,
        attackAt: 0.2 + rng() * 0.3,
        moveAt: 0,
        lockUntil: 0,
        rootUntil: 0,
        silenceUntil: 0,
        hits: 0,
        casts: 0,
        castCount: 0,
        lifesteal: 0,
        pen: 0,
        dmgBonus: 0,
        missingAd: 0,
        saoStep: 0,
        saoCap: 0,
        saoBonus: 0,
        jjkStep: 0,
        vamp: 0,
        areaVampDiv: 1,
        shield: 0,
        shieldUntil: 0,
        mods: [],
        bleeds: [],
        gen: 0,
        dmgMana: [],
        alive: true,
        role: d.role,
        faction: d.faction,
        boss: !!s.boss || d.enemyClass === "boss",
        npc: !!s.npc,
        items: new Set(s.items ?? []),
        transformed: false,
        itemHits: 0,
        cd: {},
        used: {},
        water: !!s.water,
        love: !!s.love,
        kiritoStep: 0,
        immuneUntil: 0,
        mind: 0,
        antiHealUntil: 0
      };
      if (d.role === "Fighter") u.ad *= 1 + pick([0.12, 0.24], T("Fighter"));
      if (d.role === "Caster") u.power += pick([0.15, 0.3], T("Caster"));
      if (d.role === "Assassin") {
        u.crit += pick([0.1, 0.2], T("Assassin"));
        u.critDmg += pick([0.1, 0.2], T("Assassin"));
      }
      if (d.role === "Support") u.healPower += pick([0.2, 0.3], T("Support"));
      if (d.role === "Ranger") {
        u.speed *= 1 + pick([0.1, 0.2], T("Ranger"));
        u.pen = pick([0.1, 0.2], T("Ranger"));
      }
      if (d.role === "Guardian") {
        const g = pick([15, 30], T("Guardian"));
        u.armor += g;
        u.mr += g;
      }
      if (d.faction === "AOT") u.dmgBonus = pick([0.12, 0.24], T("AOT"));
      if (d.faction === "CSM") u.missingAd = pick([0.2, 0.4], T("CSM"));
      if (d.faction === "TG") u.lifesteal = pick([0.08, 0.16], T("TG"));
      if (d.faction === "SAO") {
        u.saoStep = pick([0.03, 0.05], T("SAO"));
        u.saoCap = pick([0.18, 0.35], T("SAO"));
      }
      if (d.faction === "JJK") u.jjkStep = pick([0.06, 0.12], T("JJK"));
      let hpPct2 = 0, adPct = 0, spd = 0;
      for (const key of u.items) {
        const it = ITEMS[key];
        if (!it) continue;
        adPct += it.attack ?? 0;
        if (it.family && d.evolutionFamily === it.family) {
          adPct += it.famAttack ?? 0;
          u.power += it.famPower ?? 0;
        }
        spd += it.speed ?? 0;
        u.power += it.power ?? 0;
        u.crit += it.crit ?? 0;
        hpPct2 += it.health ?? 0;
        u.armor += it.armor ?? 0;
        u.mr += it.mr ?? 0;
        u.healPower += it.healPower ?? 0;
      }
      for (const key of u.items) {
        const it = ITEMS[key];
        if (!it) continue;
        u.critDmg += it.critDmg ?? 0;
        u.lifesteal += it.lifesteal ?? 0;
        u.itemDmg = (u.itemDmg ?? 0) + (it.dmgMul ?? 0);
        u.mana = Math.min(u.maxMana, u.mana + (it.startMana ?? 0));
      }
      u.regen = u.items.has("leftovers") ? 0.015 : 0;
      u.sash = u.items.has("focus_sash");
      u.rocky = u.items.has("rocky_helmet");
      u.claw = u.items.has("quick_claw");
      u.kings = u.items.has("kings_rock");
      u.herb = u.items.has("mental_herb");
      u.lifeOrb = u.items.has("life_orb");
      u.sitrus = u.items.has("sitrus_berry");
      if (u.items.has("black_sludge") && (d.types ?? []).includes("Poison")) u.regen = Math.max(u.regen, 0.02);
      {
        const line = d.evolutionLine ?? [u.id];
        if (u.items.has("eviolite") && s.stars < line.length) {
          u.armor += 30;
          u.mr += 30;
        }
      }
      u.ad *= 1 + adPct;
      u.speed *= 1 + spd;
      u.maxHp *= 1 + hpPct2;
      u.hp = u.maxHp;
      u.types = d.types ?? [];
      u.synTypes = [.../* @__PURE__ */ new Set([...u.types, ...crystalTypes(u.items), ...s.blessing ? [s.blessing] : []])];
      u.dmgMul = 1 + (u.itemDmg ?? 0);
      for (const key of u.items) {
        const it = ITEMS[key];
        if (it?.typeBoost && u.types.includes(it.typeBoost)) u.dmgMul += it.typeDmg ?? 0.2;
      }
      u.synTier = Object.fromEntries((d.types ?? []).map((ty) => [ty, s.npc ? 0 : tierOf(ty, tc[ty] ?? 0)]));
      if (!s.npc) {
        const b2 = typeBonuses(tc, u.synTypes);
        u.ad *= 1 + (b2.atkPct ?? 0);
        u.maxHp *= 1 + (b2.hpPct ?? 0);
        u.hp = u.maxHp;
        u.speed *= 1 + (b2.speedPct ?? 0);
        u.armor += b2.armor ?? 0;
        u.mr += b2.mr ?? 0;
        u.crit += b2.crit ?? 0;
        u.critDmg += b2.critDmg ?? 0;
        u.power += b2.power ?? 0;
        u.lifesteal += b2.lifesteal ?? 0;
        u.pen += b2.pen ?? 0;
        u.healPower += b2.healPower ?? 0;
        u.dmgMul += b2.dmgMul ?? 0;
        u.mana = Math.min(u.maxMana, u.mana + (b2.startMana ?? 0));
        if (b2.shield) {
          u.shield = u.maxHp * b2.shield;
          u.shieldUntil = 9999;
        }
      }
      {
        const R = TRANSFORM.rules, line = d.evolutionLine ?? [u.id];
        for (const key of u.items) {
          const it = ITEMS[key];
          if (it?.form && it.species === u.id && s.stars >= line.length && !megaUsed[side]) {
            megaUsed[side] = true;
            u.mega = it.form;
            u.maxHp *= R.megaHp;
            u.hp = u.maxHp;
            u.ad *= R.megaAttack;
            u.armor += R.megaDefense;
            u.mr += R.megaDefense;
          }
        }
        if (u.items.has("dynamax_band") && TRANSFORM.gmax[u.id] && !gmaxUsed[side]) {
          gmaxUsed[side] = true;
          u.gmax = TRANSFORM.gmax[u.id];
        }
      }
      if (u.items.has("soul")) u.itemPen = 0.25;
      if (u.items.has("blood")) u.bloodVamp = 0.12;
      if (u.items.has("liberator")) u.cd.liberator = 0;
      if (u.items.has("simple_domain")) u.cd.domain = 0;
      if (u.items.has("thunder")) u.cd.thunder = 6;
      if (u.items.has("signal")) u.cd.signal = 8;
      if (u.items.has("devil_blood")) {
        u.cd.devil = 6;
        u.devilUses = 0;
      }
      if (d.id === "illfang") u.guard = true;
      if (d.id === "gleam_eyes") u.cd.aura = 3;
      units.push(u);
    }
    const mine = units.filter((u) => u.side === side && !u.npc);
  }
  const start = units.map((u) => ({ uid: u.uid, id: u.id, side: u.side, stars: u.stars, col: u.col, row: u.row, hp: u.maxHp, items: [...u.items], mana: Math.round(u.mana), maxMana: u.maxMana, art: u.mega, npc: u.npc || void 0, boss: u.boss || void 0 }));
  const trapHit = [void 0, void 0];
  const alive = (side) => units.filter((u) => u.alive && u.side === side);
  const foesOf = (u) => units.filter((v) => v.alive && v.cside !== u.cside);
  const friendsOf = (u) => units.filter((v) => v.alive && v.cside === u.cside);
  const occupied = (col, row, ignore) => units.some((v) => v.alive && v !== ignore && v.col === col && v.row === row);
  const inBounds = (col, row) => col >= 0 && col < RULES.cols && row >= 0 && row < RULES.rows;
  const modSum = (u, key) => {
    let s = 0;
    for (const m of u.mods) if (m.until > t && m.k[key]) s += m.k[key];
    return s;
  };
  const drOf = (u) => {
    let f = 1;
    for (const m of u.mods) if (m.until > t && m.k.dr) f *= 1 - m.k.dr;
    return f;
  };
  const armorOf = (u) => (u.armor + modSum(u, "armor")) * (1 + modSum(u, "armorPct") + weatherDefBonus(u, "armorPct"));
  const mrOf = (u) => (u.mr + modSum(u, "mr")) * (1 + modSum(u, "mrPct") + weatherDefBonus(u, "mrPct"));
  const speedOf = (u) => {
    const sao = u.saoStep ? Math.min(u.saoCap, u.hits * u.saoStep) : 0;
    const kir = u.kiritoStep ? Math.min(0.24, u.hits * u.kiritoStep) : 0;
    return Math.min(RULES.maxAttackSpeed, Math.max(0.25, u.speed * (1 + sao + kir + modSum(u, "speed"))));
  };
  const adOf = (u) => u.ad * Math.max(0.1, 1 + u.missingAd * (1 - u.hp / u.maxHp) + modSum(u, "ad"));
  const highestHp = (u) => friendsOf(u).reduce((best, v) => !best || v.maxHp > best.maxHp ? v : best, null);
  const emitMana = (u) => {
    const v = Math.round(u.mana);
    if (u.manaSent !== v) {
      u.manaSent = v;
      events.push({ t, k: "mana", u: u.uid, v });
    }
  };
  const addMana = (u, amount) => {
    u.mana = Math.min(u.maxMana, u.mana + amount);
    emitMana(u);
  };
  const later = (delay, fn, owner, chan = false) => pending.push({ at: t + delay, fn, owner, gen: chan && owner ? owner.gen : void 0 });
  const hpPct = (u) => u.hp / u.maxHp;
  function nearest(u, list) {
    let best = null, bd = Infinity;
    for (const v of list) {
      const d = hexDistance(u, v);
      if (d < bd || d === bd && best && v.uid < best.uid) {
        best = v;
        bd = d;
      }
    }
    return best;
  }
  function pickTarget(u, foes) {
    if (u.role === "Assassin") {
      const back = foes.filter((v) => v.role === "Caster" || v.role === "Ranger" || v.role === "Support");
      if (back.length) return nearest(u, back);
    }
    return nearest(u, foes);
  }
  function heal(src, tgt, amt) {
    if (!tgt.alive) return;
    let v = amt;
    if (modSum(tgt, "heal")) v *= 1 + modSum(tgt, "heal");
    v = Math.min(tgt.maxHp - tgt.hp, Math.max(0, v));
    if (v <= 0) return;
    tgt.hp += v;
    events.push({ t, k: "heal", u: src.uid, tg: tgt.uid, v: Math.round(v) });
  }
  function healOver(src, tgt, total, secs) {
    const n = Math.max(1, Math.round(secs));
    for (let i = 1; i <= n; i++) later(i, () => heal(src, tgt, total / n));
  }
  function shield(src, tgt, amt, dur) {
    if (!tgt.alive || amt <= 0) return;
    tgt.shield = tgt.shieldUntil > t ? tgt.shield + amt : amt;
    tgt.shieldUntil = Math.max(tgt.shieldUntil, t + dur);
    events.push({ t, k: "shield", u: src.uid, tg: tgt.uid, v: Math.round(amt) });
  }
  function addMod(tgt, k, dur) {
    const key = JSON.stringify(k);
    const same = tgt.mods.find((m) => m.key === key);
    if (same) same.until = Math.max(same.until, t + dur);
    else tgt.mods.push({ until: t + dur, k, key });
    if (tgt.mods.length > 40) tgt.mods = tgt.mods.filter((m) => m.until > t);
  }
  function stun(tgt, s) {
    if (!tgt.alive || s <= 0) return;
    if (tgt.items.has("curing") && !tgt.used.curing) {
      tgt.used.curing = true;
      tgt.bleeds = [];
      return;
    }
    tgt.lockUntil = Math.max(tgt.lockUntil, t + s);
    tgt.gen++;
  }
  function applyBleed(src, tgt, dps, secs, tag, cap) {
    const mine = tgt.bleeds.filter((b2) => b2.tag === tag);
    if (mine.length >= cap) {
      mine.sort((x, y) => x.until - y.until)[0].until = t + secs;
    } else tgt.bleeds.push({ src, until: t + secs, dps, tag });
  }
  let weather = null;
  const evoOf = (u) => {
    const l = BY_ID[u.id]?.evolutionLine ?? [u.id];
    return l[Math.min(u.stars - 1, l.length - 1)];
  };
  const formOf = (u) => {
    if (u.mega) return u.mega;
    const l = BY_ID[u.id]?.evolutionLine ?? [u.id];
    return l[Math.min(u.stars - 1, l.length - 1)];
  };
  function setWeather(name) {
    weather = { name, until: t + WEATHER_DATA.duration };
    events.push({ t, k: "weather", name, v: WEATHER_DATA.duration });
    later(WEATHER_DATA.duration, () => {
      if (weather && weather.until <= t + 1e-6) {
        weather = null;
        events.push({ t, k: "weather", name: "none" });
      }
    });
  }
  const weatherDef = () => weather ? WEATHER_DATA.weather[weather.name] : null;
  const weatherDefBonus = (u, key) => {
    const w = weatherDef();
    return w?.def && u.types?.some((x) => w.def.types.includes(x)) ? w.def[key] : 0;
  };
  const weatherDmgMul = (src) => {
    const w = weatherDef();
    if (!w || !src.types) return 1;
    let m = 1;
    for (const ty of src.types) {
      if (w.boost?.[ty]) m *= w.boost[ty];
      if (w.nerf?.[ty]) m *= w.nerf[ty];
    }
    return m;
  };
  const ST = STATUS_DATA.statuses;
  function clearStatus(tgt, name) {
    if (tgt.status?.[name]) {
      delete tgt.status[name];
      events.push({ t, k: "status", u: tgt.uid, name, on: false });
    }
  }
  function applyStatus(src, tgt, name, chance = 1) {
    const def = ST[name];
    if (!def || !tgt.alive || rng() >= Math.min(1, chance)) return false;
    if (tgt.boss && def.hardCc) return false;
    if (tgt.herb && !tgt.herbUsed) {
      tgt.herbUsed = true;
      events.push({ t, k: "buff", u: tgt.uid, name: "mental_herb" });
      return false;
    }
    if (def.hardCc && (tgt.ccImmuneUntil ?? 0) > t) return false;
    tgt.status ??= {};
    const cur = tgt.status[name], dur = def.duration;
    if (cur && def.stack === "stack") {
      cur.stacks = Math.min(def.maxStacks ?? 1, cur.stacks + 1);
      cur.until = t + dur;
      cur.src = src;
    } else if (cur) cur.until = Math.max(cur.until, t + dur);
    else {
      tgt.status[name] = { until: t + dur, stacks: 1, src };
    }
    events.push({ t, k: "status", u: tgt.uid, name, on: true, v: tgt.status[name].stacks });
    if (def.hardCc) {
      stun(tgt, dur);
      tgt.ccImmuneUntil = t + dur + STATUS_DATA.ccImmunitySeconds;
    }
    if (def.speed) addMod(tgt, { speed: def.speed }, dur);
    later(dur + 0.05, () => {
      const c = tgt.status?.[name];
      if (c && c.until <= t + 1e-6) clearStatus(tgt, name);
    });
    return true;
  }
  function statusTick(u) {
    if (!u.status) return;
    for (const [name, c] of Object.entries(u.status)) {
      if (c.until <= t - 1e-6) {
        clearStatus(u, name);
        continue;
      }
      const def = ST[name];
      if (def.dotPct) deal(c.src ?? u, u, u.maxHp * def.dotPct * (c.stacks ?? 1), "magic", "dot", { pen: 1 });
    }
  }
  const hasStatus = (u, name) => !!u.status?.[name] && u.status[name].until > t;
  function onHitStatus(src, tgt) {
    const ty = (src.types ?? []).find((x) => STATUS_DATA.onHit[x]);
    if (!ty) return;
    const [name, base] = STATUS_DATA.onHit[ty], tier = src.synTier?.[ty] ?? 0;
    applyStatus(src, tgt, name, base * (1 + STATUS_DATA.synergyScale * tier));
  }
  function deal(src, tgt, raw, type, kind, o = {}) {
    if (!tgt.alive || raw <= 0) return 0;
    let defense = type === "physical" ? armorOf(tgt) : mrOf(tgt);
    if (defense > 0) {
      if (kind === "basic") defense *= 1 - Math.min(0.9, (src.pen ?? 0) + (src.itemPen ?? 0));
      if (o.pen) defense *= 1 - o.pen;
    }
    let dmg = raw * (100 / (100 + Math.max(-50, defense)));
    const direct = kind === "basic" || kind === "ability";
    if (direct) {
      dmg *= (src.dmgMul ?? 1) * typeMultiplier(src.types, tgt.types) * weatherDmgMul(src);
      if (tgt.status?.sleep && ST.sleep.wakeOnDamage && hasStatus(tgt, "sleep")) {
        tgt.lockUntil = t;
        clearStatus(tgt, "sleep");
      }
      if (src.dmgBonus && tgt === highestHp(tgt)) dmg *= 1 + src.dmgBonus;
      if (src.id === "nanami" && tgt.nanMark) dmg *= 1.3;
      if (tgt.guard) {
        const toSrc = { x: cx(src) - cx(tgt), y: cy(src) - cy(tgt) };
        const foe = nearest(tgt, foesOf(tgt));
        const f = foe ? { x: cx(foe) - cx(tgt), y: cy(foe) - cy(tgt) } : null;
        if (f) {
          const l1 = Math.hypot(toSrc.x, toSrc.y) || 1, l2 = Math.hypot(f.x, f.y) || 1;
          if ((toSrc.x * f.x + toSrc.y * f.y) / (l1 * l2) >= 0.5) dmg *= 0.75;
        }
      }
      dmg *= drOf(tgt);
      if (kind === "ability" && tgt.items.has("simple_domain") && tgt.cd.domain <= t) {
        dmg *= 0.7;
        tgt.cd.domain = t + 6;
      }
      if (kind === "basic") {
        if (tgt.items.has("liberator") && tgt.cd.liberator <= t) {
          dmg *= 0.6;
          tgt.cd.liberator = t + 4;
        }
        if (o.crit && tgt.items.has("koukaku")) {
          const cd = src.critDmg;
          dmg *= (1 + (cd - 1) * 0.5) / cd;
        }
      }
    }
    if (tgt.shieldUntil > t && tgt.shield > 0) {
      const absorbed = Math.min(dmg, tgt.shield);
      tgt.shield -= absorbed;
      dmg -= absorbed;
    }
    let actual = Math.min(tgt.hp, dmg);
    if (actual >= tgt.hp - 1e-6 && tgt.sash && !tgt.sashUsed && tgt.hp >= tgt.maxHp - 1e-6 && tgt.hp > 1) {
      tgt.sashUsed = true;
      actual = tgt.hp - 1;
      events.push({ t, k: "buff", u: tgt.uid, name: "focus_sash" });
    }
    if (actual >= tgt.hp - 1e-6 && tgt.items.has("pochita") && !tgt.used.pochita && tgt.hp > 1) {
      tgt.used.pochita = true;
      actual = tgt.hp - 1;
      shield(tgt, tgt, tgt.maxHp * 0.15, 2);
      healOver(tgt, tgt, tgt.maxHp * 0.1, 2);
    }
    tgt.hp -= actual;
    events.push({ t, k: "dmg", u: src.uid, tg: tgt.uid, v: Math.round(actual), crit: !!o.crit, name: type });
    tgt.dmgMana = tgt.dmgMana.filter((m) => t - m.t < 1);
    const used = tgt.dmgMana.reduce((s, m) => s + m.v, 0);
    const gain = Math.max(0, Math.min(RULES.damageManaCap - used, actual / tgt.maxHp * 100));
    tgt.dmgMana.push({ t, v: gain });
    addMana(tgt, gain);
    if (direct && actual > 0) {
      const div = o.area ? 3 : 1;
      if (src.lifeOrb && src.alive) {
        src.hp = Math.max(1, src.hp - src.maxHp * 0.02);
      }
      if (tgt.rocky && kind === "basic" && src.alive && src !== tgt) deal(tgt, src, actual * 0.12, "physical", "item", { pen: 1 });
      if (src.lifesteal && kind === "basic") heal(src, src, actual * src.lifesteal * src.healPower);
      if (src.bloodVamp) heal(src, src, actual * (o.area ? 0.04 : src.bloodVamp));
      if (src.vamp) heal(src, src, actual * src.vamp / div);
    }
    if (tgt.hp <= 1e-4) {
      tgt.alive = false;
      tgt.hp = 0;
      events.push({ t, k: "die", u: tgt.uid });
    } else {
      const frac = hpPct(tgt);
      if (tgt.sitrus && !tgt.used.sitrus && frac < 0.5) {
        tgt.used.sitrus = true;
        heal(tgt, tgt, tgt.maxHp * 0.3);
        events.push({ t, k: "buff", u: tgt.uid, name: "sitrus_berry" });
      }
      if (tgt.items.has("ixa") && !tgt.used.ixa && frac < 0.35) {
        tgt.used.ixa = true;
        shield(tgt, tgt, tgt.maxHp * 0.2, 4);
        tgt.counter = { until: t + 4, ad: 1 };
      }
      if (tgt.items.has("arata") && !tgt.used.arata && frac < 0.5) {
        tgt.used.arata = true;
        addMod(tgt, { dr: 0.15 }, 4);
      }
      for (const h of friendsOf(tgt)) {
        if (h.items.has("healing_crystal") && !h.used.crystal && frac < 0.5 && hexDistance(h, tgt) <= 2) {
          h.used.crystal = true;
          const low = friendsOf(h).filter((v) => hpPct(v) < 1 || v === h).sort((x, y) => hpPct(x) - hpPct(y))[0];
          if (low) healOver(h, low, low.maxHp * 0.15, 3);
          break;
        }
      }
      if (tgt.water && !tgt.used.water && frac < 0.5) {
        tgt.used.water = true;
        tgt.shield = tgt.shieldUntil > t ? tgt.shield + tgt.maxHp * 0.85 : tgt.maxHp * 0.85;
        tgt.shieldUntil = Math.max(tgt.shieldUntil, t + 60);
        events.push({ t, k: "shield", u: tgt.uid, tg: tgt.uid, v: Math.round(tgt.maxHp * 0.85) });
      }
      if (tgt.kanekiHeal && !tgt.used.kaneki && frac < 0.3) {
        tgt.used.kaneki = true;
        healOver(tgt, tgt, tgt.maxHp * 0.15, 3);
      }
    }
    return actual;
  }
  const neighbours = (p) => {
    const out = [];
    for (let row = p.row - 1; row <= p.row + 1; row++) for (let col = p.col - 1; col <= p.col + 1; col++)
      if (inBounds(col, row) && hexDistance(p, { col, row }) === 1) out.push({ col, row });
    return out;
  };
  const teleport = (u, col, row) => {
    u.col = col;
    u.row = row;
    events.push({ t, k: "move", u: u.uid, col, row, x: 1 });
  };
  function stepToward(u, goal, steps) {
    for (let i = 0; i < steps; i++) {
      const here = hexDistance(u, goal);
      const next = neighbours(u).filter((c) => !occupied(c.col, c.row, u) && hexDistance(c, goal) < here).sort((p, q) => hexDistance(p, goal) - hexDistance(q, goal))[0];
      if (!next) break;
      teleport(u, next.col, next.row);
    }
  }
  function dashAdj(u, tg) {
    if (hexDistance(u, tg) <= 1) return true;
    const cell = neighbours(tg).filter((c) => !occupied(c.col, c.row, u)).sort((p, q) => hexDistance(p, u) - hexDistance(q, u))[0];
    if (!cell) return false;
    teleport(u, cell.col, cell.row);
    return true;
  }
  function dashBehind(u, tg) {
    const dx = cx(tg) - cx(u), dy = cy(tg) - cy(u), len = Math.hypot(dx, dy) || 1;
    const cell = neighbours(tg).filter((c) => !occupied(c.col, c.row, u)).sort((p, q) => ((cx(q) - cx(tg)) * dx + (cy(q) - cy(tg)) * dy) / len - ((cx(p) - cx(tg)) * dx + (cy(p) - cy(tg)) * dy) / len)[0];
    if (!cell || ((cx(cell) - cx(tg)) * dx + (cy(cell) - cy(tg)) * dy) / len <= 0) return false;
    teleport(u, cell.col, cell.row);
    return true;
  }
  function reposition(u, tg, minD, maxD, hops) {
    let best = null, bs = -Infinity;
    for (let row = 0; row < RULES.rows; row++) for (let col = 0; col < RULES.cols; col++) {
      if (occupied(col, row, u) || hexDistance(u, { col, row }) > Math.max(1, hops)) continue;
      const d = hexDistance({ col, row }, tg);
      if (d < minD || d > maxD) continue;
      const foes = foesOf(u).filter((v) => v !== tg && hexDistance(v, { col, row }) <= 1).length;
      const score = -foes * 3 - Math.abs(d - (minD + maxD) / 2);
      if (score > bs) {
        bs = score;
        best = { col, row };
      }
    }
    if (best) {
      teleport(u, best.col, best.row);
      return true;
    }
    return false;
  }
  function lineFrom(from, tg, len, side, viewer) {
    const dx = cx(tg) - cx(from), dy = cy(tg) - cy(from), l = Math.hypot(dx, dy) || 1;
    const list = side === "foe" ? foesOf(viewer) : friendsOf(viewer);
    return list.map((v) => {
      const px = cx(v) - cx(from), py = cy(v) - cy(from);
      const along = (px * dx + py * dy) / l, perp = Math.abs(px * dy - py * dx) / l;
      return { v, along, perp };
    }).filter((e) => e.along > 0.01 && e.along <= len + 0.01 && e.perp <= 0.62).sort((p, q) => p.along - q.along).map((e) => e.v);
  }
  function makeCtx(u) {
    const a2 = ABILITIES[u.id] ?? {};
    const S = RULES.starScale ** (u.stars - 1);
    const foes = foesOf(u), friends = friendsOf(u);
    const target = nearest(u, foes);
    const c = {
      u,
      t,
      S,
      ad: adOf(u),
      P: u.power,
      a: a2,
      target,
      foes,
      friends,
      at: (delay, fn, chan) => later(delay, fn, u, !!chan),
      status: (tg, name, chance = 1) => applyStatus(u, tg, name, chance),
      lock: (sec) => {
        u.lockUntil = Math.max(u.lockUntil, t + sec);
        lockSec = Math.max(lockSec, sec);
      },
      phys: (tg, raw, o = {}) => deal(u, tg, raw, "physical", "ability", o),
      mag: (tg, raw, o = {}) => deal(u, tg, raw, "magic", "ability", o),
      ring: (center, r) => foesOf(u).filter((v) => hexDistance(center, v) <= r),
      allyRing: (center, r) => friendsOf(u).filter((v) => hexDistance(center, v) <= r),
      adjacentFoes: (tg) => foesOf(u).filter((v) => v !== tg && hexDistance(tg, v) === 1),
      line: (tg, len) => lineFrom(u, tg, len, "foe", u),
      lineFrom: (from, tg, len) => lineFrom(from, tg, len, "foe", u),
      cone: (tg, range, deg) => {
        const dx = cx(tg) - cx(u), dy = cy(tg) - cy(u), l = Math.hypot(dx, dy) || 1;
        return foesOf(u).filter((v) => {
          if (hexDistance(u, v) > range) return false;
          const px = cx(v) - cx(u), py = cy(v) - cy(u), pl = Math.hypot(px, py) || 1;
          return Math.acos(Math.max(-1, Math.min(1, (px * dx + py * dy) / (l * pl)))) <= deg * Math.PI / 180 + 1e-6;
        });
      },
      lowestFoe: (maxDist = 99) => foesOf(u).filter((v) => hexDistance(u, v) <= maxDist).sort((x, y) => hpPct(x) - hpPct(y))[0] ?? null,
      farthestFoe: (maxDist = 99, pool) => (pool ?? foesOf(u)).filter((v) => hexDistance(u, v) <= maxDist).sort((x, y) => hexDistance(u, y) - hexDistance(u, x))[0] ?? null,
      lowestAllies: (n, maxDist = 99) => friendsOf(u).filter((v) => hexDistance(u, v) <= maxDist).sort((x, y) => hpPct(x) - hpPct(y)).slice(0, n),
      heal: (tg, amt) => heal(u, tg, amt),
      shield: (tg, amt, dur) => shield(u, tg, amt, dur),
      mod: (tg, k, dur) => addMod(tg, k, dur),
      stun: (tg, s) => stun(tg, s),
      root: (tg, s) => {
        tg.rootUntil = Math.max(tg.rootUntil, t + s);
      },
      silence: (tg, s) => {
        tg.silenceUntil = Math.max(tg.silenceUntil, t + s);
      },
      cleanse: (tg) => {
        tg.bleeds = [];
        tg.mods = tg.mods.filter((m) => !Object.values(m.k).some((x) => x < 0));
      },
      dashAdj: (tg) => dashAdj(u, tg),
      dashBehind: (tg) => dashBehind(u, tg),
      reposition: (tg, mn, mx, hops) => reposition(u, tg, mn, mx, hops),
      transform: (o) => {
        u.transformed = true;
        if (o.hp) {
          const add = u.maxHp * o.hp;
          u.maxHp += add;
          u.hp += add;
        }
        const k = {};
        if (o.ad) k.ad = o.ad;
        if (o.speed) k.speed = o.speed;
        if (o.armor) k.armor = o.armor;
        if (Object.keys(k).length) u.mods.push({ until: Infinity, k, key: "tf" });
        if (o.vamp) u.vamp = o.vamp;
        events.push({ t, k: "buff", u: u.uid, name: "transform" });
      },
      transformed: u.transformed,
      control: (tg, secs, mult) => {
        tg.cside = u.cside;
        tg.ctrlMult = mult * u.power;
        tg.attackAt = Math.max(tg.attackAt, t + 0.2);
        events.push({ t, k: "buff", u: tg.uid, name: "control" });
        later(secs, () => {
          tg.cside = tg.side;
          tg.ctrlMult = 0;
          tg.immuneUntil = t + 5;
        });
      }
    };
    return c;
  }
  let lockSec = 0;
  function cast(u) {
    const d = BY_ID[u.id];
    u.mana = 0;
    emitMana(u);
    u.casts++;
    lockSec = 0;
    const c = makeCtx(u);
    if (u.jjkStep && u.casts <= 5) u.power += u.jjkStep;
    events.push({ t, k: "cast", u: u.uid, tg: c.target?.uid, name: d.ability });
    const form = formOf(u), wk = BY_ID[u.id]?.weather;
    if (wk && u.stars >= (d.evolutionLine?.length ?? 1)) setWeather(wk);
    const fn = ABILITY_FNS[form] ?? ABILITY_FNS[evoOf(u)] ?? ABILITY_FNS[u.id] ?? ARCHETYPES[d.kind];
    if (fn) fn(c);
    else if (c.target) {
      const tg = c.target, a2 = c.a;
      later(0.6, () => {
        deal(u, tg, ((a2.base ?? 100) * c.S + (a2.ad ?? 1.5) * c.ad) * u.power, "magic", "ability");
        stun(tg, 0.5);
      }, u);
    }
    if (!lockSec) c.lock(0.8);
    const gen = u.gen;
    later(lockSec, () => {
      if (u.alive && u.gen === gen) afterCast(u);
    }, u);
  }
  function afterCast(u) {
    const foes = foesOf(u);
    if (!foes.length) return;
    if (u.items.has("odm") && !u.used.odm) {
      u.used.odm = true;
      const far = foes.sort((x, y) => hexDistance(u, y) - hexDistance(u, x))[0];
      stepToward(u, far, 4);
    } else if (u.items.has("katana") && !u.used.katana) {
      u.used.katana = true;
      const tg = nearest(u, foes);
      stepToward(u, tg, 2);
      if (tg && hexDistance(u, tg) <= u.range) deal(u, tg, adOf(u), "physical", "item");
    }
    if (u.items.has("narukami") && (u.cd.narukami ?? 0) <= t) {
      u.cd.narukami = t + 6;
      const tg = nearest(u, foes);
      if (tg) lineFrom(u, tg, 6, "foe", u).slice(0, 3).forEach((v, i) => deal(u, v, adOf(u) * 0.8 * u.power * 0.75 ** i, "magic", "item"));
    }
    if (u.items.has("rika") && (u.cd.rika ?? 0) <= t) {
      u.cd.rika = t + 6;
      const low = friendsOf(u).filter((v) => hexDistance(u, v) <= 2).sort((x, y) => hpPct(x) - hpPct(y))[0];
      if (low) shield(u, low, low.maxHp * 0.1, 4);
    }
  }
  function onBasicHit(u, tg, crit) {
    u.itemHits++;
    const ad = adOf(u);
    if (u.items.has("cloud") && u.itemHits % 3 === 0) deal(u, tg, ad * 0.4, "physical", "item");
    if (u.items.has("repulser") && u.itemHits % 5 === 0) lineFrom(u, tg, 4, "foe", u).slice(0, 3).forEach((v) => deal(u, v, ad * 0.8, "physical", "item"));
    if (u.items.has("excalibur") && u.itemHits % 4 === 0) foesOf(u).filter((v) => v !== tg && hexDistance(v, tg) === 1).slice(0, 2).forEach((v) => deal(u, v, ad * 0.6, "physical", "item", { area: true }));
    if (u.items.has("chainsaw")) applyBleed(u, tg, ad * 0.15, 3, "chainsaw", 3);
    if (u.items.has("captain") && crit && (u.cd.captain ?? 0) <= t) {
      u.cd.captain = t + 4;
      for (let i = 0; i < 2; i++) deal(u, tg, ad * 0.25, "physical", "item");
    }
    if (u.items.has("rinkaku")) {
      if ((u.cd.rinkaku ?? 0) <= t) {
        u.rinkakuCount = (u.rinkakuCount ?? 0) + 1;
        if (u.rinkakuCount >= 4) {
          u.rinkakuCount = 0;
          u.cd.rinkaku = t + 3;
          for (let i = 0; i < 2; i++) deal(u, tg, ad * 0.2, "physical", "item");
          heal(u, u, u.maxHp * 0.03);
        }
      }
    }
    if (u.id === "skull_reaper") applyBleed(u, tg, ad * 0.1, 3, "reaper", 2);
    if (tg.counter && tg.counter.until > t && hexDistance(tg, u) <= 2 && tg.alive) {
      const k = tg.counter;
      tg.counter = null;
      deal(tg, u, adOf(tg) * k.ad, "physical", "item");
    }
  }
  function basicAttack(u, tg) {
    u.attackAt = t + 1 / speedOf(u);
    if (hasStatus(u, "confusion") && rng() < ST.confusion.selfChance) {
      const mates = friendsOf(u).filter((v) => v !== u);
      tg = mates.length ? mates[Math.floor(rng() * mates.length)] : u;
    }
    const isCrit = rng() < Math.min(1, u.crit);
    let dmg = adOf(u) * (isCrit ? u.critDmg : 1);
    if (u.focus && u.focus.until > t) {
      if (u.focus.tg !== tg) u.focus = null;
      else if (++u.focus.count === 3) {
        dmg = adOf(u) * u.focus.third;
        u.focus = null;
      }
    }
    if (u.ctrlMult && u.cside !== u.side) dmg *= u.ctrlMult;
    u.hits++;
    addMana(u, RULES.manaPerAttack);
    events.push({ t, k: "atk", u: u.uid, tg: tg.uid });
    deal(u, tg, dmg, "physical", "basic", { crit: isCrit });
    if (tg.nobMark && tg.nobMark.until > t && tg.nobMark.left > 0 && tg.alive) {
      tg.nobMark.left--;
      deal(u, tg, tg.nobMark.v, "magic", "item");
    }
    if (tg.alive || true) onBasicHit(u, tg, isCrit);
    if (tg.alive && tg.cside !== u.cside) {
      onHitStatus(u, tg);
      if (u.kings && rng() < 0.12) applyStatus(u, tg, "flinch", 1);
    }
    if (u.claw && rng() < 0.15) u.attackAt = t;
  }
  function periodic(u) {
    const foes = foesOf(u);
    if (u.cd.thunder !== void 0 && t >= u.cd.thunder) {
      u.cd.thunder += 6;
      const tg = nearest(u, foes);
      if (tg && hexDistance(u, tg) <= u.range + 1) {
        for (const v of foes) if (hexDistance(v, tg) <= 1) deal(u, v, adOf(u), "physical", "item", { area: v !== tg });
      }
    }
    if (u.cd.signal !== void 0 && t >= u.cd.signal) {
      u.cd.signal += 8;
      friendsOf(u).filter((v) => v !== u && hexDistance(u, v) <= 2 && v.mana < v.maxMana && !(v.sigAt > t)).sort((x, y) => hexDistance(u, x) - hexDistance(u, y)).slice(0, 2).forEach((v) => {
        addMana(v, 20);
        v.sigAt = t + 8;
      });
    }
    if (u.cd.devil !== void 0 && t >= u.cd.devil && u.devilUses < 3) {
      u.cd.devil += 6;
      const low = friendsOf(u).filter((v) => hexDistance(u, v) <= 2 && hpPct(v) < 1).sort((x, y) => hpPct(x) - hpPct(y))[0];
      if (low) {
        u.devilUses++;
        heal(u, low, low.maxHp * 0.06);
      }
    }
    if (u.id === "gleam_eyes") {
      if (t >= u.cd.aura) {
        u.cd.aura += 3;
        for (const v of foes) if (hexDistance(u, v) <= 1) deal(u, v, adOf(u) * 0.15, "magic", "item", { area: true });
      }
      if (u.phase && t >= (u.cd.fire ?? 0)) {
        u.cd.fire = t + 1;
        for (const v of foes) if (u.fireHexes?.some((h) => h.col === v.col && h.row === v.row)) deal(u, v, adOf(u) * 0.2, "magic", "item", { area: true });
      }
    }
    if (u.boss && !u.phase && hpPct(u) <= 0.4) {
      u.phase = true;
      if (u.id === "illfang") {
        u.guard = false;
        u.mods.push({ until: Infinity, k: { speed: 0.4 }, key: "phase" });
      }
      if (u.id === "skull_reaper") u.stormPhase = true;
      events.push({ t, k: "buff", u: u.uid, name: "phase" });
    }
  }
  for (const u of units) {
    const w = BY_ID[u.id]?.weather;
    if (w && u.stars >= (BY_ID[u.id].evolutionLine?.length ?? 1) && !weather) setWeather(w);
  }
  const limit = RULES.combatSeconds;
  for (const u of units) {
    if (u.mega) events.push({ t: 0.5, k: "form", u: u.uid, art: u.mega, name: "mega", v: u.maxHp });
    if (u.gmax) {
      const R = TRANSFORM.rules;
      later(R.gmaxStart, () => {
        if (!u.alive) return;
        const extra = u.maxHp * (R.gmaxHp - 1);
        u.maxHp += extra;
        u.hp += extra;
        u.ad *= R.gmaxAttack;
        u.gmaxOn = true;
        events.push({ t, k: "form", u: u.uid, art: u.gmax, name: "gmax", v: u.maxHp, x: 1 });
      });
      later(R.gmaxStart + R.gmaxDuration, () => {
        if (!u.alive || !u.gmaxOn) return;
        u.gmaxOn = false;
        u.ad /= R.gmaxAttack;
        u.maxHp /= R.gmaxHp;
        u.hp = Math.min(u.hp, u.maxHp);
        events.push({ t, k: "form", u: u.uid, art: u.mega ?? null, name: "gmax", v: u.maxHp });
      });
    }
  }
  while (t < limit && alive(0).length > 0 && alive(1).length > 0) {
    t = Math.round((t + 0.1) * 10) / 10;
    pending.sort((x, y) => x.at - y.at);
    while (pending.length && pending[0].at <= t + 1e-9) {
      const p = pending.shift();
      if (p.owner && !p.owner.alive) continue;
      if (p.gen !== void 0 && p.owner && p.owner.gen !== p.gen) continue;
      p.fn();
    }
    if (Math.abs(t - Math.round(t)) < 1e-9) {
      for (const u of units) if (u.alive) {
        statusTick(u);
        if (u.regen && u.hp < u.maxHp) heal(u, u, u.maxHp * u.regen);
      }
      {
        const w = weatherDef();
        if (w?.chipPct) {
          for (const u of units) if (u.alive && !u.types?.some((x) => w.chipImmune.includes(x))) deal(u, u, u.maxHp * w.chipPct, "magic", "dot", { pen: 1 });
        }
      }
      for (const u of units) if (u.alive && u.bleeds.length) {
        u.bleeds = u.bleeds.filter((b2) => b2.until > t - 1e-9);
        for (const b2 of u.bleeds) deal(b2.src, u, b2.dps, "physical", "dot");
      }
    }
    for (const u of units) if (u.alive) periodic(u);
    for (const u of units) if (u.alive && u.love && !(u.cd.love > t)) {
      u.cd.love = t + 3;
      const tg = pickTarget(u, foesOf(u));
      if (!tg) continue;
      const ax = cx(u), ay = cy(u);
      let dx = cx(tg) - ax, dy = cy(tg) - ay;
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      const dmg = [100, 190, 320, 540][Math.min(3, Math.max(0, (opts.stage ?? 1) - 1))];
      events.push({ t, k: "cast", u: u.uid, tg: tg.uid, name: "love_energy" });
      for (const v of units) {
        if (!v.alive || v === u) continue;
        const px = cx(v) - ax, py = cy(v) - ay, along = px * dx + py * dy, off = Math.abs(px * dy - py * dx);
        if (along < 0 || along > 12 || off > 0.7) continue;
        if (v.cside === u.cside) heal(u, v, v.maxHp * 0.05);
        else deal(u, v, dmg * u.power, "magic", "ability", { area: true });
      }
    }
    for (const sd of [0, 1]) {
      const tr = opts.trap?.[sd];
      if (!tr || trapHit[sd]) continue;
      const cell = sd === 0 ? tr : mirror(tr.col, tr.row);
      const v = units.find((x) => x.alive && x.cside !== sd && !x.npc && x.col === cell.col && x.row === cell.row);
      if (v) {
        trapHit[sd] = v.id;
        events.push({ t, k: "trap", u: v.uid, side: sd, col: cell.col, row: cell.row });
      }
    }
    for (const u of units) {
      if (!u.alive || u.lockUntil > t + 1e-9) continue;
      const foes = foesOf(u);
      const target = pickTarget(u, foes);
      if (!target) break;
      if (u.mana >= u.maxMana && u.maxMana > 0 && u.silenceUntil <= t) {
        cast(u);
        continue;
      }
      const dist2 = hexDistance(u, target);
      if (dist2 <= u.range) {
        if (u.attackAt <= t + 1e-9) {
          if (hasStatus(u, "paralysis") && rng() < ST.paralysis.skipChance) u.attackAt = t + 0.4;
          else basicAttack(u, target);
        }
      } else if (u.moveAt <= t + 1e-9 && u.rootUntil <= t) {
        const queue = [{ col: u.col, row: u.row }];
        const seen = /* @__PURE__ */ new Set([u.row * RULES.cols + u.col]);
        let step = null;
        for (let i = 0; i < queue.length && !step; i++) {
          const p = queue[i];
          if (p.first && hexDistance(p, target) <= u.range) {
            step = p.first;
            break;
          }
          for (const n of neighbours(p)) {
            const key = n.row * RULES.cols + n.col;
            if (seen.has(key) || occupied(n.col, n.row, u)) continue;
            seen.add(key);
            queue.push({ ...n, first: p.first ?? n });
          }
        }
        if (step) {
          u.col = step.col;
          u.row = step.row;
          u.moveAt = t + 0.45;
          events.push({ t, k: "move", u: u.uid, col: u.col, row: u.row });
        } else u.moveAt = t + 0.2;
      }
    }
  }
  while (pending.length && pending[0].at <= t + 0.9) {
    pending.sort((x, y) => x.at - y.at);
    const p = pending.shift();
    if (p.owner && !p.owner.alive) continue;
    p.fn();
  }
  const s0 = alive(0), s1 = alive(1);
  let winner = -1;
  if (s0.length && !s1.length) winner = 0;
  else if (s1.length && !s0.length) winner = 1;
  else if (s0.length && s1.length) {
    const r0 = s0.reduce((s, u) => s + u.hp, 0) / units.filter((u) => u.side === 0).reduce((s, u) => s + u.maxHp, 0);
    const r1 = s1.reduce((s, u) => s + u.hp, 0) / units.filter((u) => u.side === 1).reduce((s, u) => s + u.maxHp, 0);
    winner = r0 > r1 ? 0 : r1 > r0 ? 1 : -1;
  }
  return { winner, survivors: [s0.length, s1.length], stars: [s0.reduce((n, u) => n + u.stars, 0), s1.reduce((n, u) => n + u.stars, 0)], duration: t, start, events, traits, trapHit };
}

// server/profiles.ts
var import_node_fs2 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path2 = require("node:path");
var file = () => process.env.AUTOCHESS_SAVE ?? (0, import_node_path2.join)((0, import_node_os.homedir)(), ".anime-autochess", "profiles.json");
var cache = null;
function load2() {
  if (cache) return cache;
  try {
    cache = (0, import_node_fs2.existsSync)(file()) ? JSON.parse((0, import_node_fs2.readFileSync)(file(), "utf8")) : {};
  } catch {
    cache = {};
  }
  return cache;
}
function save() {
  try {
    (0, import_node_fs2.mkdirSync)((0, import_node_path2.dirname)(file()), { recursive: true });
    const tmp = file() + ".tmp";
    (0, import_node_fs2.writeFileSync)(tmp, JSON.stringify(cache, null, 1));
    (0, import_node_fs2.renameSync)(tmp, file());
  } catch (e) {
    console.warn("could not save profiles:", e.message);
  }
}
function getProfile(name) {
  const all = load2(), key = name.toLowerCase();
  return all[key] ??= { name, rp: 0, matches: 0, rankedMatches: 0, wins: 0, top4: 0, best: 8, peak: 0 };
}
function rankInfo(rp) {
  const tiers = RANKS.Tiers;
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (rp >= tiers[k].min) i = k;
  const tier = tiers[i], next = tiers[i + 1];
  let division = 0;
  if (tier.divisions) division = 3 - Math.min(2, Math.floor((rp - tier.min) / RANKS.DivisionSize));
  const numerals = ["", "I", "II", "III"];
  return {
    tier: tier.name,
    division,
    label: tier.divisions ? `${tier.name} ${numerals[division]}` : tier.name,
    title: tier.title,
    color: tier.color,
    rp,
    nextAt: next ? next.min : null
  };
}
function recordMatch(name, placement, ranked) {
  const p = getProfile(name);
  p.matches++;
  if (placement === 1) p.wins++;
  if (placement <= 4) p.top4++;
  p.best = Math.min(p.best, placement);
  let delta = 0;
  if (ranked) {
    delta = RANKS.Placement[Math.min(7, Math.max(0, placement - 1))];
    if (delta < 0) delta = p.rankedMatches < RANKS.ProtectedMatches ? 0 : Math.max(delta, -RANKS.MaxLoss);
    p.rankedMatches++;
    p.rp = Math.max(0, p.rp + delta);
    p.peak = Math.max(p.peak, p.rp);
  }
  save();
  return { delta, profile: p, rank: rankInfo(p.rp) };
}

// server/room.ts
var PREP_SECONDS = Number(process.env.PREP_SECONDS ?? 30);
var SUPPLY_TURN_SECONDS = Number(process.env.SUPPLY_TURN_SECONDS ?? 12);
var COMBAT_PAD_MS = Number(process.env.COMBAT_PAD_MS ?? 3e3);
var ROMAN = ["", "I", "II", "III", "IV", "V"];
var roundDamage = (round) => {
  const t = RULES.damage.table, st = Math.min(5, stageOf(round)), i = (Math.max(1, round) - 1) % STAGE_LEN;
  return (t[ROMAN[st]] ?? t.V)[Math.min(i, 5)];
};
var SPEED = Number(process.env.SPEED ?? 1);
var BOSSES = TRANSFORM.pve.bosses;
var CREEP_SETS = TRANSFORM.pve.creepSets;
var Room = class {
  id;
  match;
  conns = /* @__PURE__ */ new Map();
  started = false;
  finished = false;
  timer = null;
  prepEndsAt = 0;
  difficulty;
  placements = 0;
  fights = /* @__PURE__ */ new Map();
  onFinish;
  log = [];
  ranked = false;
  npcMeta = null;
  rewards = /* @__PURE__ */ new Map();
  constructor(id, difficulty = "Intermediate", seed = Date.now()) {
    this.id = id;
    this.difficulty = difficulty;
    this.match = newMatch(seed);
  }
  get humans() {
    return this.match.players.filter((p) => p.human);
  }
  get open() {
    return !this.started && this.match.players.length < 8;
  }
  join(name, commander, conn) {
    if (!this.open) return null;
    const p = addPlayer(this.match, name, true, commander);
    this.conns.set(p.seat, conn);
    this.broadcastLobby();
    return p;
  }
  leave(seat) {
    this.conns.delete(seat);
    const p = this.match.players[seat];
    if (!p) return;
    p.connected = false;
    if (this.started) this.checkAllReady();
    else this.broadcastLobby();
  }
  broadcastLobby() {
    for (const [seat, c] of this.conns) {
      c.send({ t: "lobby", players: this.match.players.map((p) => ({ name: p.name, commander: p.commander })), you: seat });
    }
  }
  start() {
    if (this.started) return;
    this.started = true;
    const stay = this.match.players.filter((p) => p.connected);
    const oldConns = new Map(this.conns);
    this.conns.clear();
    const old = this.match.players;
    this.match.players = [];
    for (const p of stay) {
      const seat = old.indexOf(p);
      p.seat = this.match.players.length;
      this.match.players.push(p);
      const c = oldConns.get(seat);
      if (c) this.conns.set(p.seat, c);
    }
    let n = 0;
    while (this.match.players.length < 8) {
      n++;
      addPlayer(this.match, `Rival ${n}`, false, RULES.commanders[(n - 1) % RULES.commanders.length].id);
    }
    if (process.env.TEST_START_GOLD) {
      for (const p of this.match.players) if (p.human) p.gold += Number(process.env.TEST_START_GOLD);
    }
    if (process.env.TEST_START_UNITS) {
      for (const p of this.match.players) if (p.human) for (const spec of process.env.TEST_START_UNITS.split(",")) {
        const [id, st] = spec.split(":");
        p.units.push({ uid: this.match.nextUid++, id, stars: Number(st || 1), col: null, row: null, items: [] });
      }
    }
    if (process.env.TEST_START_BLESS) {
      for (const p of this.match.players) if (p.human) {
        p.bless = [{ uid: null }];
        p.items.push("blessing_transfer");
      }
    }
    if (process.env.TEST_START_ITEMS) {
      for (const p of this.match.players) if (p.human) p.items.push(...process.env.TEST_START_ITEMS.split(","));
    }
    this.nextRound();
  }
  supply = null;
  // After the last round of a stage, a Supply draft happens before the next Preparation.
  nextRound() {
    const m = this.match;
    if (m.round > 0 && m.round % STAGE_LEN === 0 && m.players.filter((p) => !p.eliminated).length >= 2) return this.startSupply();
    this.beginPrep();
  }
  startSupply() {
    const m = this.match;
    m.phase = "Supply";
    const order = supplyOrder(m);
    this.supply = { stage: stageOf(m.round), entries: buildSupply(m, stageOf(m.round), order.length), order, idx: 0, endsAt: 0 };
    this.supplyTurn();
  }
  supplyTurn() {
    const m = this.match, S = this.supply;
    if (this.timer) clearTimeout(this.timer);
    while (S.idx < S.order.length) {
      const p = m.players[S.order[S.idx]];
      if (!p.human || !p.connected) {
        this.supplyTake(p, botChoice(S.entries));
        S.idx++;
        continue;
      }
      S.endsAt = Date.now() + SUPPLY_TURN_SECONDS * 1e3 / SPEED;
      this.pushAll();
      this.timer = setTimeout(() => {
        const q = m.players[S.order[S.idx]];
        this.supplyTake(q, botChoice(S.entries));
        S.idx++;
        this.supplyTurn();
      }, SUPPLY_TURN_SECONDS * 1e3 / SPEED);
      return;
    }
    this.supply = null;
    this.beginPrep();
  }
  supplyTake(p, e) {
    if (!e) return;
    e.by = p.seat;
    claim(this.match, p, e);
    if (!p.human || !p.connected) autoBless(this.match, p);
  }
  beginPrep() {
    const m = this.match;
    prepare(m);
    this.npcMeta = null;
    if (isNpcRound(m.round)) {
      const enc = encounterOf(m.round);
      this.npcMeta = isBossEncounter(m.round) ? { name: BOSSES[(enc / 2 - 1) % BOSSES.length].name, boss: true } : { name: "Wild Pok\xE9mon", boss: false };
    }
    this.plan = null;
    if (!isNpcRound(m.round)) {
      this.plan = this.makePlan(m.players.filter((p) => !p.eliminated));
      this.planRound = m.round;
    }
    for (const p of m.players) if (!p.eliminated && (!p.human || !p.connected)) botTurn(m, p, this.difficulty);
    this.prepEndsAt = Date.now() + PREP_SECONDS * 1e3 / SPEED;
    this.pushAll();
    this.timer = setTimeout(() => this.combat(), PREP_SECONDS * 1e3 / SPEED);
  }
  handle(seat, action) {
    const m = this.match, p = m.players[seat];
    if (!p || !this.started) return;
    if (action.a === "supplypick") {
      const S = this.supply, e = S?.entries.find((x) => x.id === action.id);
      if (m.phase !== "Supply" || !S || S.order[S.idx] !== seat || !e || e.by !== null) return this.push(seat, "Not your turn to choose.");
      this.supplyTake(p, e);
      S.idx++;
      this.supplyTurn();
      return;
    }
    const res = act(m, p, action);
    this.push(seat, res.ok ? "" : res.error);
    if (res.ok && action.a === "ready") this.checkAllReady();
  }
  // Scouting an opponent during battle: send them the fight that player is in, from that player's point of view.
  combatAt = 0;
  watch(seat, target) {
    const m = this.match, f = this.fights.get(target);
    if (m.phase !== "Combat" || !f || !this.conns.get(seat)) return;
    this.conns.get(seat).send({ t: "combat", you: f.you, vs: f.vs, round: m.round, npc: f.vs === this.npcMeta?.name || void 0, spectate: target, elapsed: (Date.now() - this.combatAt) / 1e3, ...f.result });
  }
  checkAllReady() {
    const humans = this.humans.filter((p) => p.connected && !p.eliminated);
    if (humans.length && humans.every((p) => p.ready) && this.match.phase === "Preparation") {
      if (this.timer) clearTimeout(this.timer);
      this.combat();
    }
  }
  // Who fights whom is decided when preparation starts so every player can see their next opponent.
  plan = null;
  planRound = 0;
  makePlan(alive) {
    const m = this.match, order = [...alive].sort(() => m.rng() - 0.5), pairs = [];
    while (order.length >= 2) pairs.push([order.shift(), order.shift(), false]);
    if (order.length === 1) {
      const solo = order[0];
      const ghost = alive.filter((p) => p !== solo)[Math.floor(m.rng() * (alive.length - 1))];
      pairs.push([solo, ghost, true]);
    }
    return pairs;
  }
  opponentOf(seat) {
    if (!this.plan || this.planRound !== this.match.round) return null;
    for (const [a, b, ghost] of this.plan) {
      if (a.seat === seat) return b.seat;
      if (!ghost && b.seat === seat) return a.seat;
    }
    return null;
  }
  combat() {
    const m = this.match;
    if (m.phase !== "Preparation") return;
    m.phase = "Combat";
    for (const p of m.players) {
      autoCard(m, p);
      autoPick(p);
      autoBless(m, p);
    }
    for (const p of m.players) if (p.human && p.connected && !p.eliminated) {
    }
    const alive = m.players.filter((p) => !p.eliminated);
    if (isNpcRound(m.round)) return this.npcCombat(alive);
    const pairs = this.plan && this.planRound === m.round ? this.plan.filter(([a, b]) => !a.eliminated && !b.eliminated) : this.makePlan(alive);
    this.fights.clear();
    this.combatAt = Date.now();
    let longest = 0;
    const slots = (p) => this.slotsOf(p);
    const results = [];
    for (const [a, b, ghost] of pairs) {
      const res = simulate(slots(a), slots(b), Math.floor(m.rng() * 1e9), { commanders: [a.commander, b.commander], trap: [a.cmd?.trap, b.cmd?.trap], stage: stageOf(m.round) });
      results.push({ a, b, res, ghost });
      longest = Math.max(longest, res.duration);
      this.fights.set(a.seat, { you: 0, result: res, vs: b.name });
      if (!ghost) this.fights.set(b.seat, { you: 1, result: res, vs: a.name });
    }
    for (const [seat, f] of this.fights) {
      this.conns.get(seat)?.send({ t: "combat", you: f.you, vs: f.vs, round: m.round, ...f.result });
    }
    this.pushAll();
    const waitMs = ((longest + 1) * 1e3 + COMBAT_PAD_MS) / SPEED;
    this.timer = setTimeout(() => this.resolve(results), waitMs);
  }
  slotsOf(p) {
    return deployed(p).map((u) => ({ id: u.id, stars: u.stars, col: u.col, row: u.row, items: [...u.items], blessing: u.blessing, water: p.cmd?.water === u.uid || void 0, love: p.cmd?.love === u.uid || void 0, hpMul: 1 + (p.cardBuff?.hp ?? 0), adMul: 1 + (p.cardBuff?.ad ?? 0) }));
  }
  npcLineup(round) {
    const enc = encounterOf(round), eb = RULES.enemyBalance;
    if (isBossEncounter(round)) {
      const n = enc / 2 - 1;
      const B = BOSSES[n % BOSSES.length];
      return [{
        id: B.id,
        stars: B.stars,
        col: 3,
        row: 3,
        npc: true,
        boss: true,
        hpMul: eb.BossHealth.base + eb.BossHealth.perBoss * n,
        adMul: eb.BossAttack.base + eb.BossAttack.perBoss * n
      }];
    }
    const set = CREEP_SETS[(enc - 1) / 2 % CREEP_SETS.length | 0];
    return [2, 3, 4].slice(0, eb.CreepCount).map((col, i) => ({
      id: set[i % set.length],
      stars: enc >= 5 ? 2 : 1,
      col,
      row: 3,
      npc: true,
      hpMul: eb.CreepHealth.base + eb.CreepHealth.perRound * round,
      adMul: eb.CreepAttack.base + eb.CreepAttack.perRound * round
    }));
  }
  npcCombat(alive) {
    const m = this.match;
    this.fights.clear();
    this.combatAt = Date.now();
    this.rewards.clear();
    let longest = 0;
    const lineup = this.npcLineup(m.round);
    const results = [];
    for (const p of alive) {
      const res = simulate(this.slotsOf(p), lineup, Math.floor(m.rng() * 1e9), { commanders: [p.commander, void 0], trap: [p.cmd?.trap, void 0], stage: stageOf(m.round) });
      results.push({ a: p, b: p, res, ghost: true });
      longest = Math.max(longest, res.duration);
      this.fights.set(p.seat, { you: 0, result: res, vs: this.npcMeta.name });
    }
    for (const [seat, f] of this.fights) this.conns.get(seat)?.send({ t: "combat", you: 0, vs: f.vs, round: m.round, npc: true, ...f.result });
    this.pushAll();
    this.timer = setTimeout(() => this.resolveNpc(results), ((longest + 1) * 1e3 + COMBAT_PAD_MS) / SPEED);
  }
  resolveNpc(results) {
    const m = this.match;
    for (const { a, res } of results) {
      const won = res.winner === 0;
      const text = reward(m, a, m.round, won);
      this.rewards.set(a.seat, (won ? "Victory! Reward: " : "Defeated. ") + text);
      trapReward(m, a, res.trapHit?.[0]);
      recordResult(a, won);
    }
    this.nextRound();
  }
  resolve(results) {
    const m = this.match;
    const dead = [];
    for (const { a, b, res, ghost } of results) {
      trapReward(m, a, res.trapHit?.[0]);
      if (!ghost) trapReward(m, b, res.trapHit?.[1]);
      const D = RULES.damage, base = roundDamage(m.round);
      if (res.winner === -1) {
        for (const [pl, foe] of [[a, 1], [b, 0]]) {
          if (ghost && pl === b) continue;
          const dm = base + res.stars[foe];
          pl.hp -= absorb(pl, ghost ? Math.max(1, Math.round(dm * D.ghostMultiplier)) : dm);
          if (pl.hp <= 0 && !dead.includes(pl)) dead.push(pl);
        }
        continue;
      }
      const loser = res.winner === 0 ? b : a, winner = res.winner === 0 ? a : b;
      if (!(ghost && winner === b)) recordResult(winner, true);
      if (!(ghost && loser === b)) recordResult(loser, false);
      if (ghost && loser === b) continue;
      const dmg = base + res.stars[res.winner];
      loser.hp -= absorb(loser, ghost ? Math.max(1, Math.round(dmg * D.ghostMultiplier)) : dmg);
      if (loser.hp <= 0) dead.push(loser);
    }
    dead.sort((x, y) => x.hp - y.hp);
    for (const p of dead) {
      p.placement = m.players.filter((q) => !q.eliminated).length;
      eliminate(m, p);
    }
    const left = m.players.filter((p) => !p.eliminated);
    if (left.length <= 1 || this.humans.length > 0 && this.humans.every((p) => p.eliminated || !p.connected)) {
      if (left[0]) left[0].placement = 1;
      this.finish();
      return;
    }
    this.nextRound();
  }
  finish() {
    this.finished = true;
    this.match.phase = "Finished";
    if (this.timer) clearTimeout(this.timer);
    const standings = [...this.match.players].map((p) => ({ name: p.name, placement: p.placement ?? 99, human: p.human, commander: p.commander })).sort((a, b) => a.placement - b.placement);
    for (const [seat, c] of this.conns) {
      const me = this.match.players[seat];
      let rank2 = null;
      if (me && me.human) {
        const r = recordMatch(me.name, me.placement ?? 8, this.ranked);
        rank2 = { delta: r.delta, ranked: this.ranked, ...r.rank, matches: r.profile.matches, wins: r.profile.wins, best: r.profile.best };
      }
      c.send({ t: "over", placement: me?.placement ?? 8, standings, rank: rank2 });
    }
    this.onFinish?.();
  }
  snapshot(seat, message = "") {
    const m = this.match, p = m.players[seat];
    const counts = traitCounts(deployed(p));
    const need = xpNeed(p);
    const endsAt = m.phase === "Preparation" ? this.prepEndsAt : m.phase === "Supply" ? this.supply?.endsAt : void 0;
    const phaseClock = endsAt ? {
      endsAt,
      remaining: Math.max(0, (endsAt - Date.now()) * SPEED / 1e3),
      duration: m.phase === "Preparation" ? PREP_SECONDS : SUPPLY_TURN_SECONDS,
      rate: SPEED
    } : null;
    return {
      t: "state",
      round: m.round,
      phase: m.phase,
      timeLeft: Math.round(phaseClock?.remaining ?? 0),
      phaseClock,
      supply: m.phase === "Supply" && this.supply ? { stage: this.supply.stage, entries: this.supply.entries, order: this.supply.order, turn: this.supply.order[this.supply.idx] ?? null } : null,
      message,
      seat,
      npc: this.npcMeta,
      opponent: this.opponentOf(seat),
      ranked: this.ranked,
      pool: this.poolInfo(p),
      you: {
        name: p.name,
        hp: p.hp,
        gold: p.gold,
        level: p.level,
        xp: p.xp,
        xpNeed: need,
        commander: p.commander,
        cmd: p.cmd ?? { used: 0 },
        units: p.units,
        shop: p.shop,
        shopLocked: p.shopLocked,
        rerollCost: rerollCost(p),
        ready: p.ready,
        traits: counts,
        eliminated: p.eliminated,
        placement: p.placement ?? null,
        items: p.items,
        card: p.card ? { rarity: p.card.rarity, rerolls: p.card.rerolls, options: p.card.options.map((id) => GOGO.cards.find((c) => c.id === id)) } : null,
        cardBuff: p.cardBuff ?? null,
        cardsTaken: (p.cardsTaken ?? []).map((id) => GOGO.cards.find((c) => c.id === id)).filter(Boolean),
        bless: p.bless?.[0] ? { uid: p.bless[0].uid, options: p.bless[0].options ?? null, left: p.bless.length } : null,
        picks: p.picks?.[0] ?? null,
        picksLeft: p.picks?.length ?? 0,
        reward: this.rewards.get(seat) ?? ""
      },
      players: m.players.map((q) => ({ seat: q.seat, name: q.name, hp: Math.max(0, q.hp), shield: Math.round(pk(q).shield + pk(q).fortune), board: q.units.map((u) => ({ uid: u.uid, id: u.id, stars: u.stars, col: u.col, row: u.row, items: u.items, blessing: u.blessing })), traits: traitCounts(deployed(q)), eliminated: q.eliminated, level: q.level, commander: q.commander, human: q.human, rank: q.human ? rankInfo(getProfile(q.name).rp).label : "" }))
    };
  }
  // Trainer avatars: positions are relayed so visitors scouting an island can be seen by its owner (and other scouts).
  avatars = /* @__PURE__ */ new Map();
  avatarTimer = null;
  setAvatar(seat, d) {
    const n = (v, lo, hi) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
    const island = Number.isInteger(d.island) && d.island >= 0 && d.island < this.match.players.length ? d.island : seat;
    this.avatars.set(seat, { island, x: n(d.x, -30, 30), y: n(d.y, -2, 8), z: n(d.z, -30, 30), yaw: n(d.yaw, -7, 7), mv: d.mv ? 1 : 0 });
    if (!this.avatarTimer) this.avatarTimer = setTimeout(() => {
      this.avatarTimer = null;
      const list = [...this.avatars].map(([seat2, a]) => ({ seat: seat2, ...a }));
      for (const c of this.conns.values()) c.send({ t: "avatars", list });
    }, 80);
  }
  // Shared hero pool visibility: copies still available, total copies, and copies currently owned by all players.
  poolInfo(me) {
    const m = this.match, owned = {}, out = {};
    for (const q of m.players) for (const u of q.units) {
      const k = BY_ID[u.id].poolId ?? u.id;
      owned[k] = (owned[k] ?? 0) + 3 ** (u.stars - 1);
    }
    for (const id of /* @__PURE__ */ new Set([...me.shop, ...Object.keys(m.pool)])) {
      if (!id) continue;
      const d = BY_ID[id];
      if (!d) continue;
      const total = RULES.poolCopies[d.tier - 1] ?? 0, mine = me.shop.filter((x) => x === id).length;
      out[id] = [(m.pool[id] ?? 0) + mine, total, owned[id] ?? 0];
    }
    return out;
  }
  push(seat, message = "") {
    const c = this.conns.get(seat);
    if (c) c.send(this.snapshot(seat, message));
  }
  pushAll() {
    for (const seat of this.conns.keys()) this.push(seat);
  }
};

// server/server.ts
var root = ROOT;
var MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ogg": "audio/ogg" };
var FILL_SECONDS = Number(process.env.FILL_SECONDS ?? 15);
function startServer(port = Number(process.env.PORT ?? 8080)) {
  const http = (0, import_node_http.createServer)(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    if (path === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ abilityIcons: (() => {
        try {
          return (0, import_node_fs3.readdirSync)((0, import_node_path3.join)(ROOT, "client/art/ui/abilities")).map((f) => f.replace(/\.png$/, ""));
        } catch {
          return [];
        }
      })(), roster: CLIENT_ROSTER, items: [...ITEM_LIST.map((i) => ({ ...i, cat: "Regular" })), ...TYPE_ITEMS.map((i) => ({ ...i, cat: "Synergy Exclusive" })), ...CRYSTALS.map((i) => ({ ...i, cat: "Magic Crystal" })), ...[...TRANSFER_ITEMS, ...STONES, ...SPECIAL_ITEMS].map((i) => ({ ...i, cat: "Special" }))], gogoCards: GOGO.cards.map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, text: c.text, icon: c.icon })), economy: RULES.economy, xpTable: RULES.xpToLevel, synergies: RULES.synergies, enemies: Object.values(ENEMIES).map((u) => ({ id: u.id, name: u.name, faction: u.faction, role: u.role, tier: u.tier, health: u.health, attack: u.attack, range: u.range, ability: u.ability, description: u.description, armor: u.armor, mr: u.mr, speed: u.speed, crit: u.crit, maxMana: u.maxMana, startMana: u.startMana, npc: true, boss: u.enemyClass === "boss" })), rules: { startHealth: RULES.startHealth, gogoNames: GOGO.rarityNames, gogoRounds: GOGO.rounds, npcInterval: RULES.npcInterval, dmgTable: RULES.damage.table, stageLen: STAGE_LEN, xpBuyGold: RULES.economy.xpBuyGold, xpBuyAmount: RULES.economy.xpBuyAmount, factions: RULES.factions, cols: RULES.cols, factionNames: RULES.factionNames, factionColors: RULES.factionColors, traitDescriptions: RULES.traitDescriptions, commanders: RULES.commanders, maxLevel: RULES.maxLevel, shopSize: RULES.shopSize, benchSize: RULES.benchSize } }));
      return;
    }
    if (path === "/api/art") {
      const out = [];
      const walk = async (dir2, rel) => {
        let entries = [];
        try {
          entries = await (0, import_promises.readdir)(dir2, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) e.isDirectory() ? await walk((0, import_node_path3.join)(dir2, e.name), rel + e.name + "/") : /\.(png|webp|jpg|jpeg)$/i.test(e.name) && out.push(rel + e.name);
      };
      await walk((0, import_node_path3.join)(root, "client", "art"), "");
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ files: out }));
      return;
    }
    if (path === "/api/profile") {
      const name = String(url.searchParams.get("name") ?? "").slice(0, 20);
      const p = name ? getProfile(name) : null;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(p ? { name: p.name, matches: p.matches, wins: p.wins, best: p.best, ...rankInfo(p.rp) } : {}));
      return;
    }
    const file2 = (0, import_node_path3.normalize)((0, import_node_path3.join)(root, "client", path));
    if (!file2.startsWith((0, import_node_path3.join)(root, "client"))) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = await (0, import_promises.readFile)(file2);
      res.writeHead(200, { "content-type": MIME[(0, import_node_path3.extname)(file2)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  const wss = new import_websocket_server.default({ server: http });
  const rooms = /* @__PURE__ */ new Set();
  let waiting = null, waitTimer = null, nextId = 1;
  const makeRoom = (ranked = false) => {
    const room = new Room(`room-${nextId++}`);
    room.ranked = ranked;
    rooms.add(room);
    room.onFinish = () => setTimeout(() => rooms.delete(room), 6e4);
    return room;
  };
  const startWaiting = () => {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    if (waiting) {
      const r = waiting;
      waiting = null;
      r.start();
    }
  };
  wss.on("connection", (ws) => {
    let room = null, me = null;
    const conn = { send: (m) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
    }, close: () => ws.close() };
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.t === "join" && !room) {
        const name = String(msg.name ?? "Player").slice(0, 20) || "Player";
        const commander = RULES.commanders.some((c) => c.id === msg.commander) ? msg.commander : "Blue";
        if (msg.mode === "solo") {
          room = makeRoom();
          const p = room.join(name, commander, conn);
          me = p;
          room.difficulty = ["Beginner", "Intermediate", "Hard"].includes(msg.difficulty) ? msg.difficulty : "Intermediate";
          room.start();
        } else {
          if (!waiting || !waiting.open) {
            waiting = makeRoom(true);
          }
          room = waiting;
          const p = room.join(name, commander, conn);
          me = p;
          if (room.match.players.length >= 8) startWaiting();
          else if (!waitTimer) waitTimer = setTimeout(startWaiting, FILL_SECONDS * 1e3);
        }
      } else if (msg.t === "avatar" && room && room.started && me) {
        room.setAvatar(room.match.players.indexOf(me), msg);
      } else if (msg.t === "watch" && room && room.started && me) {
        room.watch(room.match.players.indexOf(me), Number(msg.seat));
      } else if (msg.t === "act" && room && room.started) {
        room.handle(room.match.players.indexOf(me), msg.action);
      }
    });
    ws.on("close", () => {
      if (room && me) room.leave(room.match.players.indexOf(me));
    });
  });
  return new Promise((resolve) => {
    http.listen(port, () => {
      const addr = http.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      resolve({ port: actual, close() {
        wss.close();
        http.close();
      } });
    });
  });
}
if (process.env.AUTOCHESS_RUN !== "0" && process.argv[1] && /server\.(ts|cjs)$/.test(process.argv[1])) {
  startServer().then((s) => console.log(`Anime AutoChess server on http://localhost:${s.port}`));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  startServer
});
