#include "quickjs.h"
#include "quickjs-host.h"
#include <emscripten/emscripten.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* The wasm module imports a single host_call symbol provided by the embedder.
   Keep the signature aligned with docs/host-call-abi.md (all uint32 params). */
__attribute__((import_module("host"), import_name("host_call")))
extern uint32_t host_call(uint32_t fn_id,
                          uint32_t req_ptr,
                          uint32_t req_len,
                          uint32_t resp_ptr,
                          uint32_t resp_capacity);

static JSRuntime *det_rt = NULL;
static JSContext *det_ctx = NULL;
static uint64_t det_gas_limit = JS_GAS_UNLIMITED;

static void free_det_runtime(void) {
  if (det_ctx) {
    JS_FreeContext(det_ctx);
    det_ctx = NULL;
  }
  if (det_rt) {
    JS_RunGC(det_rt);
    JS_FreeRuntime(det_rt);
    det_rt = NULL;
  }
  det_gas_limit = JS_GAS_UNLIMITED;
}

static uint32_t wasm_host_call(JSContext *ctx,
                               uint32_t fn_id,
                               const uint8_t *req_ptr,
                               uint32_t req_len,
                               uint8_t *resp_ptr,
                               uint32_t resp_capacity,
                               void *opaque) {
  (void)ctx;
  (void)opaque;

  if (!req_ptr && req_len > 0) {
    return JS_HOST_CALL_TRANSPORT_ERROR;
  }

  return host_call(fn_id,
                   (uint32_t)(uintptr_t)req_ptr,
                   req_len,
                   (uint32_t)(uintptr_t)resp_ptr,
                   resp_capacity);
}

static char *dup_printf(const char *fmt, ...) {
  va_list args;
  va_start(args, fmt);
  int needed = vsnprintf(NULL, 0, fmt, args);
  va_end(args);
  if (needed < 0) {
    return NULL;
  }

  char *buf = (char *)malloc((size_t)needed + 1);
  if (!buf) {
    return NULL;
  }

  va_start(args, fmt);
  vsnprintf(buf, (size_t)needed + 1, fmt, args);
  va_end(args);
  return buf;
}

static uint64_t gas_used(uint64_t gas_limit, uint64_t gas_remaining) {
  if (gas_limit == JS_GAS_UNLIMITED) {
    return 0;
  }
  return gas_limit - gas_remaining;
}

static char *format_with_gas(const char *kind, const char *payload, uint64_t gas_limit,
                             uint64_t gas_remaining, const JSGasTrace *trace) {
  if (trace) {
    return dup_printf(
        "%s %s GAS remaining=%" PRIu64 " used=%" PRIu64
        " TRACE {\"opcodeCount\":%" PRIu64 ",\"opcodeGas\":%" PRIu64
        ",\"arrayCbBase\":{\"count\":%" PRIu64 ",\"gas\":%" PRIu64
        "},\"arrayCbPerEl\":{\"count\":%" PRIu64 ",\"gas\":%" PRIu64
        "},\"alloc\":{\"count\":%" PRIu64 ",\"bytes\":%" PRIu64 ",\"gas\":%" PRIu64 "}}",
        kind, payload, gas_remaining, gas_used(gas_limit, gas_remaining), trace->opcode_count,
        trace->opcode_gas, trace->builtin_array_cb_base_count, trace->builtin_array_cb_base_gas,
        trace->builtin_array_cb_per_element_count, trace->builtin_array_cb_per_element_gas,
        trace->allocation_count, trace->allocation_bytes, trace->allocation_gas);
  }

  return dup_printf("%s %s GAS remaining=%" PRIu64 " used=%" PRIu64, kind, payload, gas_remaining,
                    gas_used(gas_limit, gas_remaining));
}

static char *format_exception(JSContext *ctx, uint64_t gas_limit, const char *fallback,
                              const JSGasTrace *trace) {
  JSValue exception = JS_GetException(ctx);
  const char *msg = JS_ToCString(ctx, exception);
  uint64_t remaining = JS_GetGasRemaining(ctx);

  const char *payload = msg ? msg : fallback;
  char *out = format_with_gas("ERROR", payload, gas_limit, remaining, trace);

  if (msg) {
    JS_FreeCString(ctx, msg);
  }
  JS_FreeValue(ctx, exception);
  return out;
}

static int run_gc_checkpoint(JSContext *ctx) { return JS_RunGCCheckpoint(ctx); }

static char *hex32(const uint8_t *bytes, size_t length)
{
  static const char *HEX = "0123456789abcdef";
  char *out;

  if (!bytes || length != 32)
    return NULL;

  out = malloc(65);
  if (!out)
    return NULL;

  for (size_t i = 0; i < 32; i++) {
    out[i * 2] = HEX[(bytes[i] >> 4) & 0x0f];
    out[i * 2 + 1] = HEX[bytes[i] & 0x0f];
  }
  out[64] = '\0';
  return out;
}

static char *hex_bytes(const uint8_t *bytes, size_t length)
{
  static const char *HEX = "0123456789abcdef";
  char *out;

  if (length > 0 && !bytes)
    return NULL;

  out = malloc((length * 2) + 1);
  if (!out)
    return NULL;

  for (size_t i = 0; i < length; i++) {
    out[i * 2] = HEX[(bytes[i] >> 4) & 0x0f];
    out[i * 2 + 1] = HEX[bytes[i] & 0x0f];
  }
  out[length * 2] = '\0';
  return out;
}

static int js_set_prop(JSContext *ctx, JSValue obj, const char *name, JSValue val)
{
  if (JS_IsException(val))
    return -1;
  if (JS_DefinePropertyValueStr(ctx, obj, name, val,
                                JS_PROP_C_W_E) < 0) {
    JS_FreeValue(ctx, val);
    return -1;
  }
  return 0;
}

typedef struct {
  char *specifier;
  char *source;
  size_t source_len;
} ModulePackEntry;

typedef struct {
  ModulePackEntry *entries;
  uint32_t entry_count;
} ModulePack;

static void free_module_pack(ModulePack *pack) {
  if (!pack) {
    return;
  }
  if (pack->entries) {
    for (uint32_t i = 0; i < pack->entry_count; i++) {
      free(pack->entries[i].specifier);
      free(pack->entries[i].source);
    }
    free(pack->entries);
  }
  pack->entries = NULL;
  pack->entry_count = 0;
}

static ModulePackEntry *find_module_pack_entry(ModulePack *pack,
                                               const char *specifier) {
  if (!pack || !specifier) {
    return NULL;
  }
  for (uint32_t i = 0; i < pack->entry_count; i++) {
    if (strcmp(pack->entries[i].specifier, specifier) == 0) {
      return &pack->entries[i];
    }
  }
  return NULL;
}

static char *copy_cstring_len(const char *value, size_t length) {
  char *out = malloc(length + 1);
  if (!out) {
    return NULL;
  }
  memcpy(out, value, length);
  out[length] = '\0';
  return out;
}

static int parse_module_pack_json(JSContext *ctx,
                                  const char *module_pack_json,
                                  ModulePack *out_pack) {
  JSValue parsed = JS_UNDEFINED;
  JSValue length_value = JS_UNDEFINED;
  uint32_t module_count = 0;

  memset(out_pack, 0, sizeof(*out_pack));

  parsed = JS_ParseJSON(ctx, module_pack_json, strlen(module_pack_json),
                        "<module-pack>");
  if (JS_IsException(parsed)) {
    goto fail;
  }

  if (!JS_IsArray(ctx, parsed)) {
    JS_ThrowTypeError(ctx, "module pack json must be an array");
    goto fail;
  }

  length_value = JS_GetPropertyStr(ctx, parsed, "length");
  if (JS_IsException(length_value)) {
    goto fail;
  }
  if (JS_ToUint32(ctx, &module_count, length_value) != 0) {
    goto fail;
  }
  JS_FreeValue(ctx, length_value);
  length_value = JS_UNDEFINED;

  if (module_count == 0) {
    JS_ThrowTypeError(ctx, "module pack must contain at least one module");
    goto fail;
  }

  out_pack->entries = calloc(module_count, sizeof(*out_pack->entries));
  if (!out_pack->entries) {
    JS_ThrowOutOfMemory(ctx);
    goto fail;
  }
  out_pack->entry_count = module_count;

  for (uint32_t i = 0; i < module_count; i++) {
    JSValue item = JS_GetPropertyUint32(ctx, parsed, i);
    JSValue specifier_value = JS_UNDEFINED;
    JSValue source_value = JS_UNDEFINED;
    const char *specifier_cstr = NULL;
    const char *source_cstr = NULL;
    size_t source_len = 0;

    if (JS_IsException(item)) {
      goto fail;
    }
    if (!JS_IsObject(item)) {
      JS_FreeValue(ctx, item);
      JS_ThrowTypeError(ctx, "module pack entry must be an object");
      goto fail;
    }

    specifier_value = JS_GetPropertyStr(ctx, item, "specifier");
    source_value = JS_GetPropertyStr(ctx, item, "source");
    if (JS_IsException(specifier_value) || JS_IsException(source_value)) {
      JS_FreeValue(ctx, specifier_value);
      JS_FreeValue(ctx, source_value);
      JS_FreeValue(ctx, item);
      goto fail;
    }

    specifier_cstr = JS_ToCString(ctx, specifier_value);
    source_cstr = JS_ToCStringLen(ctx, &source_len, source_value);
    if (!specifier_cstr || !source_cstr) {
      JS_FreeCString(ctx, specifier_cstr);
      JS_FreeCString(ctx, source_cstr);
      JS_FreeValue(ctx, specifier_value);
      JS_FreeValue(ctx, source_value);
      JS_FreeValue(ctx, item);
      goto fail;
    }

    out_pack->entries[i].specifier =
        copy_cstring_len(specifier_cstr, strlen(specifier_cstr));
    out_pack->entries[i].source = copy_cstring_len(source_cstr, source_len);
    out_pack->entries[i].source_len = source_len;

    JS_FreeCString(ctx, specifier_cstr);
    JS_FreeCString(ctx, source_cstr);
    JS_FreeValue(ctx, specifier_value);
    JS_FreeValue(ctx, source_value);
    JS_FreeValue(ctx, item);

    if (!out_pack->entries[i].specifier || !out_pack->entries[i].source) {
      JS_ThrowOutOfMemory(ctx);
      goto fail;
    }
  }

  JS_FreeValue(ctx, parsed);
  return 0;

fail:
  if (!JS_IsUndefined(length_value)) {
    JS_FreeValue(ctx, length_value);
  }
  if (!JS_IsUndefined(parsed)) {
    JS_FreeValue(ctx, parsed);
  }
  free_module_pack(out_pack);
  return -1;
}

static JSModuleDef *module_pack_loader(JSContext *ctx,
                                       const char *module_name,
                                       void *opaque,
                                       JSValueConst attributes) {
  ModulePack *pack = (ModulePack *)opaque;
  ModulePackEntry *entry = find_module_pack_entry(pack, module_name);
  JSValue module_obj = JS_UNDEFINED;

  (void)attributes;

  if (!entry) {
    JS_ThrowReferenceError(ctx,
                           "ModuleResolutionError: module specifier not found: %s",
                           module_name);
    return NULL;
  }

  module_obj = JS_Eval(ctx, entry->source, entry->source_len, entry->specifier,
                       JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(module_obj)) {
    return NULL;
  }

  JSModuleDef *module_def = (JSModuleDef *)JS_VALUE_GET_PTR(module_obj);
  JS_FreeValue(ctx, module_obj);
  return module_def;
}

static char *escape_js_string(const char *input) {
  size_t needed = 2; /* quotes */
  for (const unsigned char *p = (const unsigned char *)input; *p; p++) {
    switch (*p) {
    case '\\':
    case '"':
    case '\n':
    case '\r':
    case '\t':
      needed += 2;
      break;
    default:
      needed += 1;
      break;
    }
  }

  char *out = malloc(needed + 1);
  if (!out) {
    return NULL;
  }

  char *cursor = out;
  *cursor++ = '"';
  for (const unsigned char *p = (const unsigned char *)input; *p; p++) {
    switch (*p) {
    case '\\':
      *cursor++ = '\\';
      *cursor++ = '\\';
      break;
    case '"':
      *cursor++ = '\\';
      *cursor++ = '"';
      break;
    case '\n':
      *cursor++ = '\\';
      *cursor++ = 'n';
      break;
    case '\r':
      *cursor++ = '\\';
      *cursor++ = 'r';
      break;
    case '\t':
      *cursor++ = '\\';
      *cursor++ = 't';
      break;
    default:
      *cursor++ = (char)*p;
      break;
    }
  }
  *cursor++ = '"';
  *cursor = '\0';
  return out;
}

static char *format_prefixed_exception(JSContext *ctx, uint64_t gas_limit,
                                       const char *prefix,
                                       const char *fallback,
                                       const JSGasTrace *trace) {
  JSValue exception = JS_GetException(ctx);
  const char *msg = JS_ToCString(ctx, exception);
  uint64_t remaining = JS_GetGasRemaining(ctx);
  char *payload = dup_printf("%s: %s", prefix, msg ? msg : fallback);
  char *out = format_with_gas("ERROR", payload ? payload : prefix, gas_limit,
                              remaining, trace);

  if (payload) {
    free(payload);
  }
  if (msg) {
    JS_FreeCString(ctx, msg);
  }
  JS_FreeValue(ctx, exception);
  return out;
}

static int drain_pending_jobs(JSContext *ctx, JSRuntime *rt,
                              JSContext **out_error_ctx) {
  while (JS_IsJobPending(rt)) {
    JSContext *job_ctx = NULL;
    int rc = JS_ExecutePendingJob(rt, &job_ctx);
    if (rc < 0) {
      if (out_error_ctx) {
        *out_error_ctx = job_ctx ? job_ctx : ctx;
      }
      return -1;
    }
  }

  if (out_error_ctx) {
    *out_error_ctx = ctx;
  }
  return 0;
}

static int resolve_promise_result(JSContext *ctx, JSValue *value) {
  int state = (int)JS_PromiseState(ctx, *value);
  if (state < 0) {
    return 0;
  }

  if (state == JS_PROMISE_PENDING) {
    JS_ThrowTypeError(ctx,
                      "promise did not settle during deterministic job drain");
    return -1;
  }

  JSValue settled = JS_PromiseResult(ctx, *value);
  if (state == JS_PROMISE_REJECTED) {
    JS_FreeValue(ctx, *value);
    *value = JS_UNDEFINED;
    JS_Throw(ctx, settled);
    return -1;
  }

  JS_FreeValue(ctx, *value);
  *value = settled;
  return 0;
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_init(const uint8_t *manifest_bytes,
                   uint32_t manifest_size,
                   const char *manifest_hash_hex,
                   const uint8_t *context_blob,
                   uint32_t context_blob_size,
                   uint64_t gas_limit,
                   uint32_t feature_flags) {
  free_det_runtime();
  det_gas_limit = gas_limit;

  if (JS_NewDeterministicRuntimeWithFeatures(&det_rt, &det_ctx, feature_flags) != 0) {
    return dup_printf("ERROR <init> GAS remaining=0 used=0");
  }

  if (JS_SetHostCallDispatcher(det_rt, wasm_host_call, NULL) != 0) {
    free_det_runtime();
    return dup_printf("ERROR <host dispatcher> GAS remaining=0 used=0");
  }

  JSDeterministicInitOptions opts = {
      .manifest_bytes = manifest_bytes,
      .manifest_size = manifest_size,
      .manifest_hash_hex = manifest_hash_hex,
      .context_blob = context_blob,
      .context_blob_size = context_blob_size,
      .gas_limit = gas_limit,
      .feature_flags = feature_flags,
  };

  if (JS_InitDeterministicContext(det_ctx, &opts) != 0) {
    char *out = format_exception(det_ctx, det_gas_limit, "<init>", NULL);
    free_det_runtime();
    return out;
  }

  if (run_gc_checkpoint(det_ctx) != 0) {
    char *out = format_exception(det_ctx, det_gas_limit, "<gc checkpoint>", NULL);
    free_det_runtime();
    return out;
  }

  return NULL;
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_eval(const char *code) {
  JSContext *job_error_ctx = NULL;

  if (!det_ctx || !det_rt) {
    return dup_printf("ERROR <uninitialized> GAS remaining=0 used=0");
  }

  if (run_gc_checkpoint(det_ctx) != 0) {
    return format_exception(det_ctx, det_gas_limit, "<gc checkpoint>", NULL);
  }

  JSValue result = JS_Eval(det_ctx, code, strlen(code), "<eval>", JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(result)) {
    JS_FreeValue(det_ctx, result);
    return format_exception(det_ctx, det_gas_limit, "<exception>", NULL);
  }

  if (drain_pending_jobs(det_ctx, det_rt, &job_error_ctx) != 0) {
    JS_FreeValue(det_ctx, result);
    return format_exception(job_error_ctx ? job_error_ctx : det_ctx,
                            det_gas_limit, "<job queue>", NULL);
  }

  if (resolve_promise_result(det_ctx, &result) != 0) {
    JS_FreeValue(det_ctx, result);
    return format_exception(det_ctx, det_gas_limit, "<promise result>", NULL);
  }

  JSDvBuffer dv = {0};
  if (JS_EncodeDV(det_ctx, result, &JS_DV_LIMIT_DEFAULTS, &dv) != 0) {
    JS_FreeValue(det_ctx, result);
    char *out = format_exception(det_ctx, det_gas_limit, "<dv encode>", NULL);
    JS_FreeDVBuffer(det_ctx, &dv);
    return out;
  }

  JS_FreeValue(det_ctx, result);

  if (run_gc_checkpoint(det_ctx) != 0) {
    JS_FreeDVBuffer(det_ctx, &dv);
    return format_exception(det_ctx, det_gas_limit, "<gc checkpoint>", NULL);
  }

  char *hex = hex_bytes(dv.data, dv.length);
  JS_FreeDVBuffer(det_ctx, &dv);
  if (!hex) {
    uint64_t remaining = JS_GetGasRemaining(det_ctx);
    return format_with_gas("ERROR", "<dv encode>", det_gas_limit, remaining, NULL);
  }

  uint64_t remaining = JS_GetGasRemaining(det_ctx);
  char *out = format_with_gas("RESULT", hex, det_gas_limit, remaining, NULL);
  free(hex);
  return out;
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_eval_module_pack(const char *module_pack_json,
                               const char *entry_specifier,
                               const char *entry_export) {
  JSContext *job_error_ctx = NULL;
  ModulePack pack = {0};
  JSValue module_eval = JS_UNDEFINED;
  JSValue global_obj = JS_UNDEFINED;
  JSValue export_value = JS_UNDEFINED;
  JSDvBuffer dv = {0};
  JSAtom result_atom = JS_ATOM_NULL;
  const char *target_export = NULL;
  char *entry_specifier_escaped = NULL;
  char *entry_export_escaped = NULL;
  char *wrapper_source = NULL;
  char *hex = NULL;
  char *out = NULL;
  const char *result_global_name = "__blue_module_pack_result";

  if (!det_ctx || !det_rt) {
    return dup_printf("ERROR <uninitialized> GAS remaining=0 used=0");
  }

  if (run_gc_checkpoint(det_ctx) != 0) {
    return format_exception(det_ctx, det_gas_limit, "<gc checkpoint>", NULL);
  }

  if (!entry_specifier || entry_specifier[0] == '\0') {
    uint64_t remaining = JS_GetGasRemaining(det_ctx);
    return format_with_gas("ERROR",
                           "ModuleSpecifierNotFound: empty entry specifier",
                           det_gas_limit, remaining, NULL);
  }

  target_export = (entry_export && entry_export[0] != '\0') ? entry_export
                                                             : "default";

  if (parse_module_pack_json(det_ctx, module_pack_json, &pack) != 0) {
    return format_prefixed_exception(det_ctx, det_gas_limit,
                                     "ModuleEvaluationError",
                                     "<module-pack parse>", NULL);
  }

  if (!find_module_pack_entry(&pack, entry_specifier)) {
    uint64_t remaining = JS_GetGasRemaining(det_ctx);
    out = format_with_gas("ERROR",
                          "ModuleSpecifierNotFound: entry module not found",
                          det_gas_limit, remaining, NULL);
    goto cleanup;
  }

  if (JS_AddIntrinsicPromise(det_ctx) != 0) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError", "<promise init>",
                                    NULL);
    goto cleanup;
  }

  JS_SetModuleLoaderFunc2(det_rt, NULL, module_pack_loader, NULL, &pack);

  entry_specifier_escaped = escape_js_string(entry_specifier);
  entry_export_escaped = escape_js_string(target_export);
  if (!entry_specifier_escaped || !entry_export_escaped) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError", "<escape>", NULL);
    goto cleanup;
  }

  wrapper_source = dup_printf(
      "import * as __blue_entry_ns from %s;\n"
      "if (!Object.prototype.hasOwnProperty.call(__blue_entry_ns, %s)) {\n"
      "  throw new Error('ModuleExportMissing: export not found');\n"
      "}\n"
      "globalThis.%s = __blue_entry_ns[%s];\n",
      entry_specifier_escaped, entry_export_escaped, result_global_name,
      entry_export_escaped);
  if (!wrapper_source) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError", "<wrapper>", NULL);
    goto cleanup;
  }

  module_eval = JS_Eval(det_ctx, wrapper_source, strlen(wrapper_source),
                        "./__module_pack_entry__.js", JS_EVAL_TYPE_MODULE);
  if (JS_IsException(module_eval)) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError",
                                    "<module evaluation>", NULL);
    goto cleanup;
  }

  if (drain_pending_jobs(det_ctx, det_rt, &job_error_ctx) != 0) {
    out = format_prefixed_exception(job_error_ctx ? job_error_ctx : det_ctx,
                                    det_gas_limit, "ModuleEvaluationError",
                                    "<job queue>", NULL);
    goto cleanup;
  }

  global_obj = JS_GetGlobalObject(det_ctx);
  if (JS_IsException(global_obj)) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError",
                                    "<global object>", NULL);
    goto cleanup;
  }

  export_value = JS_GetPropertyStr(det_ctx, global_obj, result_global_name);
  if (JS_IsException(export_value)) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError",
                                    "<module export>", NULL);
    goto cleanup;
  }

  if (resolve_promise_result(det_ctx, &export_value) != 0) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError",
                                    "<module export promise>", NULL);
    goto cleanup;
  }

  result_atom = JS_NewAtom(det_ctx, result_global_name);
  if (result_atom != JS_ATOM_NULL) {
    JS_DeleteProperty(det_ctx, global_obj, result_atom, 0);
  }

  if (JS_EncodeDV(det_ctx, export_value, &JS_DV_LIMIT_DEFAULTS, &dv) != 0) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError", "<dv encode>",
                                    NULL);
    goto cleanup;
  }

  if (run_gc_checkpoint(det_ctx) != 0) {
    out = format_prefixed_exception(det_ctx, det_gas_limit,
                                    "ModuleEvaluationError",
                                    "<gc checkpoint>", NULL);
    goto cleanup;
  }

  hex = hex_bytes(dv.data, dv.length);
  if (!hex) {
    uint64_t remaining = JS_GetGasRemaining(det_ctx);
    out = format_with_gas("ERROR", "<dv encode>", det_gas_limit, remaining,
                          NULL);
    goto cleanup;
  }

  {
    uint64_t remaining = JS_GetGasRemaining(det_ctx);
    out = format_with_gas("RESULT", hex, det_gas_limit, remaining, NULL);
  }

cleanup:
  JS_SetModuleLoaderFunc2(det_rt, NULL, NULL, NULL, NULL);
  if (wrapper_source) {
    free(wrapper_source);
  }
  if (entry_specifier_escaped) {
    free(entry_specifier_escaped);
  }
  if (entry_export_escaped) {
    free(entry_export_escaped);
  }
  if (result_atom != JS_ATOM_NULL) {
    JS_FreeAtom(det_ctx, result_atom);
  }
  if (!JS_IsUndefined(export_value)) {
    JS_FreeValue(det_ctx, export_value);
  }
  if (!JS_IsUndefined(global_obj)) {
    JS_FreeValue(det_ctx, global_obj);
  }
  if (!JS_IsUndefined(module_eval)) {
    JS_FreeValue(det_ctx, module_eval);
  }
  if (dv.data) {
    JS_FreeDVBuffer(det_ctx, &dv);
  }
  if (hex) {
    free(hex);
  }
  JS_FreeContextLoadedModules(det_ctx);
  free_module_pack(&pack);

  if (!out) {
    return format_prefixed_exception(det_ctx, det_gas_limit,
                                     "ModuleEvaluationError", "<module-pack>",
                                     NULL);
  }
  return out;
}

EMSCRIPTEN_KEEPALIVE
int qjs_det_set_gas_limit(uint64_t gas_limit) {
  if (!det_ctx || !det_rt) {
    return -1;
  }

  det_gas_limit = gas_limit;
  JS_SetGasLimit(det_ctx, gas_limit);
  return 0;
}

EMSCRIPTEN_KEEPALIVE
void qjs_det_free(void) { free_det_runtime(); }

EMSCRIPTEN_KEEPALIVE
int qjs_det_enable_tape(uint32_t capacity)
{
  if (!det_ctx || !det_rt)
    return -1;

  return JS_EnableHostTape(det_ctx, capacity);
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_read_tape(void)
{
  JSHostTapeRecord *records = NULL;
  size_t count = 0;
  size_t to_read = 0;
  JSValue arr = JS_UNDEFINED;
  JSValue json = JS_UNDEFINED;
  const char *json_str = NULL;
  char *out = NULL;

  if (!det_ctx || !det_rt)
    return dup_printf("[]");

  count = JS_GetHostTapeLength(det_ctx);
  if (count == 0)
    return dup_printf("[]");

  to_read = count > JS_HOST_TAPE_MAX_CAPACITY ? JS_HOST_TAPE_MAX_CAPACITY : count;
  records = js_mallocz(det_ctx, sizeof(JSHostTapeRecord) * to_read);
  if (!records)
    return dup_printf("[]");

  if (JS_ReadHostTape(det_ctx, records, to_read, &count) != 0) {
    js_free(det_ctx, records);
    return dup_printf("[]");
  }

  arr = JS_NewArray(det_ctx);
  if (JS_IsException(arr))
    goto done;

  for (size_t i = 0; i < count; i++) {
    JSValue obj = JS_NewObjectProto(det_ctx, JS_NULL);
    char *req_hex = NULL;
    char *resp_hex = NULL;
    char gas_pre_buf[32];
    char gas_post_buf[32];

    if (JS_IsException(obj))
      goto loop_error;

    if (js_set_prop(det_ctx, obj, "fnId", JS_NewUint32(det_ctx, records[i].fn_id)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "reqLen", JS_NewUint32(det_ctx, records[i].req_len)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "respLen", JS_NewUint32(det_ctx, records[i].resp_len)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "units", JS_NewUint32(det_ctx, records[i].units)) < 0)
      goto loop_error;
    snprintf(gas_pre_buf, sizeof(gas_pre_buf), "%" PRIu64, records[i].gas_pre);
    snprintf(gas_post_buf, sizeof(gas_post_buf), "%" PRIu64, records[i].gas_post);
    if (js_set_prop(det_ctx, obj, "gasPre", JS_NewString(det_ctx, gas_pre_buf)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "gasPost", JS_NewString(det_ctx, gas_post_buf)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "isError", JS_NewBool(det_ctx, records[i].is_error)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "chargeFailed", JS_NewBool(det_ctx, records[i].charge_failed)) < 0)
      goto loop_error;

    req_hex = hex32(records[i].req_hash, sizeof(records[i].req_hash));
    resp_hex = hex32(records[i].resp_hash, sizeof(records[i].resp_hash));
    if (!req_hex || !resp_hex) {
      if (req_hex)
        free(req_hex);
      if (resp_hex)
        free(resp_hex);
      goto loop_error;
    }

    if (js_set_prop(det_ctx, obj, "reqHash", JS_NewString(det_ctx, req_hex)) < 0) {
      free(req_hex);
      free(resp_hex);
      goto loop_error;
    }
    if (js_set_prop(det_ctx, obj, "respHash", JS_NewString(det_ctx, resp_hex)) < 0) {
      free(req_hex);
      free(resp_hex);
      goto loop_error;
    }

    free(req_hex);
    free(resp_hex);

    if (JS_SetPropertyUint32(det_ctx, arr, (uint32_t)i, obj) < 0) {
      JS_FreeValue(det_ctx, obj);
      goto done;
    }

    continue;

  loop_error:
    JS_FreeValue(det_ctx, obj);
    goto done;
  }

  json = JS_JSONStringify(det_ctx, arr, JS_UNDEFINED, JS_UNDEFINED);
  if (JS_IsException(json))
    goto done;

  json_str = JS_ToCString(det_ctx, json);
  if (!json_str)
    goto done;

  out = dup_printf("%s", json_str);
  JS_FreeCString(det_ctx, json_str);

done:
  if (records)
    js_free(det_ctx, records);
  if (!JS_IsUndefined(arr))
    JS_FreeValue(det_ctx, arr);
  if (!JS_IsUndefined(json))
    JS_FreeValue(det_ctx, json);

  if (!out)
    return dup_printf("[]");
  return out;
}

EMSCRIPTEN_KEEPALIVE
int qjs_det_enable_charge_tape(uint32_t capacity)
{
  if (!det_ctx || !det_rt)
    return -1;

  return JS_EnableGasChargeTape(det_ctx, capacity);
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_read_charge_tape(void)
{
  JSGasChargeRecord *records = NULL;
  size_t count = 0;
  size_t to_read = 0;
  JSValue arr = JS_UNDEFINED;
  JSValue json = JS_UNDEFINED;
  const char *json_str = NULL;
  char *out = NULL;

  if (!det_ctx || !det_rt)
    return dup_printf("[]");

  count = JS_GetGasChargeTapeLength(det_ctx);
  if (count == 0)
    return dup_printf("[]");

  to_read = count > JS_GAS_CHARGE_TAPE_MAX_CAPACITY ? JS_GAS_CHARGE_TAPE_MAX_CAPACITY : count;
  records = js_mallocz(det_ctx, sizeof(JSGasChargeRecord) * to_read);
  if (!records)
    return dup_printf("[]");

  if (JS_ReadGasChargeTape(det_ctx, records, to_read, &count) != 0) {
    js_free(det_ctx, records);
    return dup_printf("[]");
  }

  arr = JS_NewArray(det_ctx);
  if (JS_IsException(arr))
    goto done;

  for (size_t i = 0; i < count; i++) {
    JSValue obj = JS_NewObjectProto(det_ctx, JS_NULL);
    char amount_buf[32];
    char logical_units_buf[32];
    char gas_before_buf[32];
    char gas_after_buf[32];

    if (JS_IsException(obj))
      goto loop_error;

    if (js_set_prop(det_ctx, obj, "siteId", JS_NewUint32(det_ctx, records[i].site_id)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "kind", JS_NewUint32(det_ctx, records[i].kind)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "flags", JS_NewUint32(det_ctx, records[i].flags)) < 0)
      goto loop_error;

    snprintf(amount_buf, sizeof(amount_buf), "%" PRIu64, records[i].amount);
    snprintf(logical_units_buf, sizeof(logical_units_buf), "%" PRIu64, records[i].logical_units);
    snprintf(gas_before_buf, sizeof(gas_before_buf), "%" PRIu64, records[i].gas_before);
    snprintf(gas_after_buf, sizeof(gas_after_buf), "%" PRIu64, records[i].gas_after);

    if (js_set_prop(det_ctx, obj, "amount", JS_NewString(det_ctx, amount_buf)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "logicalUnits", JS_NewString(det_ctx, logical_units_buf)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "gasBefore", JS_NewString(det_ctx, gas_before_buf)) < 0)
      goto loop_error;
    if (js_set_prop(det_ctx, obj, "gasAfter", JS_NewString(det_ctx, gas_after_buf)) < 0)
      goto loop_error;

    if (JS_SetPropertyUint32(det_ctx, arr, (uint32_t)i, obj) < 0) {
      JS_FreeValue(det_ctx, obj);
      goto done;
    }

    continue;

  loop_error:
    JS_FreeValue(det_ctx, obj);
    goto done;
  }

  json = JS_JSONStringify(det_ctx, arr, JS_UNDEFINED, JS_UNDEFINED);
  if (JS_IsException(json))
    goto done;

  json_str = JS_ToCString(det_ctx, json);
  if (!json_str)
    goto done;

  out = dup_printf("%s", json_str);
  JS_FreeCString(det_ctx, json_str);

done:
  if (records)
    js_free(det_ctx, records);
  if (!JS_IsUndefined(arr))
    JS_FreeValue(det_ctx, arr);
  if (!JS_IsUndefined(json))
    JS_FreeValue(det_ctx, json);

  if (!out)
    return dup_printf("[]");
  return out;
}

EMSCRIPTEN_KEEPALIVE
int qjs_det_enable_trace(int enabled)
{
  if (!det_ctx || !det_rt)
    return -1;

  if (JS_EnableGasTrace(det_ctx, enabled ? 1 : 0) != 0)
    return -1;

  if (enabled) {
    if (JS_ResetGasTrace(det_ctx) != 0)
      return -1;
  }
  return 0;
}

EMSCRIPTEN_KEEPALIVE
char *qjs_det_read_trace(void)
{
  JSGasTrace trace = {0};

  if (det_ctx && det_rt) {
    if (JS_ReadGasTrace(det_ctx, &trace) != 0) {
      memset(&trace, 0, sizeof(trace));
    }
  }

  return dup_printf(
      "{\"opcodeCount\":\"%" PRIu64 "\",\"opcodeGas\":\"%" PRIu64
      "\",\"arrayCbBaseCount\":\"%" PRIu64 "\",\"arrayCbBaseGas\":\"%" PRIu64
      "\",\"arrayCbPerElCount\":\"%" PRIu64
      "\",\"arrayCbPerElGas\":\"%" PRIu64
      "\",\"allocationCount\":\"%" PRIu64
      "\",\"allocationRequestedBytes\":\"%" PRIu64
      "\",\"allocationBytes\":\"%" PRIu64
      "\",\"allocationGas\":\"%" PRIu64
      "\",\"jsonParseCount\":\"%" PRIu64 "\",\"jsonParseGas\":\"%" PRIu64
      "\",\"jsonParseInputBytes\":\"%" PRIu64
      "\",\"jsonParseValues\":\"%" PRIu64
      "\",\"jsonParseObjectEntries\":\"%" PRIu64
      "\",\"jsonParseArrayElements\":\"%" PRIu64
      "\",\"jsonStringifyCount\":\"%" PRIu64
      "\",\"jsonStringifyGas\":\"%" PRIu64
      "\",\"jsonStringifyOutputBytes\":\"%" PRIu64
      "\",\"jsonStringifyValues\":\"%" PRIu64
      "\",\"jsonStringifyObjectEntries\":\"%" PRIu64
      "\",\"jsonStringifyArrayElements\":\"%" PRIu64
      "\",\"jsonStringifySortComparisons\":\"%" PRIu64
      "\",\"hostCallPreCount\":\"%" PRIu64
      "\",\"hostCallPreGas\":\"%" PRIu64
      "\",\"hostCallPostCount\":\"%" PRIu64
      "\",\"hostCallPostGas\":\"%" PRIu64 "\"}",
      trace.opcode_count, trace.opcode_gas, trace.builtin_array_cb_base_count,
      trace.builtin_array_cb_base_gas, trace.builtin_array_cb_per_element_count,
      trace.builtin_array_cb_per_element_gas, trace.allocation_count,
      trace.allocation_requested_bytes, trace.allocation_bytes,
      trace.allocation_gas, trace.json_parse_count,
      trace.json_parse_gas, trace.json_parse_input_bytes,
      trace.json_parse_value_count, trace.json_parse_object_entry_count,
      trace.json_parse_array_element_count, trace.json_stringify_count,
      trace.json_stringify_gas, trace.json_stringify_output_bytes,
      trace.json_stringify_value_count,
      trace.json_stringify_object_entry_count,
      trace.json_stringify_array_element_count,
      trace.json_stringify_sort_comparison_count,
      trace.host_call_pre_count, trace.host_call_pre_gas,
      trace.host_call_post_count, trace.host_call_post_gas);
}
