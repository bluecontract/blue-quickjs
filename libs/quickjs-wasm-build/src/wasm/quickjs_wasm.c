#include "quickjs.h"
#include <emscripten/emscripten.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
                             uint64_t gas_remaining) {
  return dup_printf("%s %s GAS remaining=%" PRIu64 " used=%" PRIu64, kind, payload, gas_remaining,
                    gas_used(gas_limit, gas_remaining));
}

static char *format_exception(JSContext *ctx, uint64_t gas_limit, const char *fallback) {
  JSValue exception = JS_GetException(ctx);
  const char *msg = JS_ToCString(ctx, exception);
  uint64_t remaining = JS_GetGasRemaining(ctx);

  const char *payload = msg ? msg : fallback;
  char *out = format_with_gas("ERROR", payload, gas_limit, remaining);

  if (msg) {
    JS_FreeCString(ctx, msg);
  }
  JS_FreeValue(ctx, exception);
  return out;
}

static int run_gc_checkpoint(JSContext *ctx) { return JS_RunGCCheckpoint(ctx); }

EMSCRIPTEN_KEEPALIVE
char *qjs_eval(const char *code, uint64_t gas_limit) {
  JSRuntime *rt = NULL;
  JSContext *ctx = NULL;
  char *output = NULL;

  if (JS_NewDeterministicRuntime(&rt, &ctx) != 0) {
    return dup_printf("ERROR <init> GAS remaining=0 used=0");
  }

  JS_SetGasLimit(ctx, gas_limit);

  if (run_gc_checkpoint(ctx) != 0) {
    output = format_exception(ctx, gas_limit, "<gc checkpoint>");
    goto cleanup;
  }

  JSValue result = JS_Eval(ctx, code, strlen(code), "<eval>", JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(result)) {
    JS_FreeValue(ctx, result);
    if (run_gc_checkpoint(ctx) != 0) {
      output = format_exception(ctx, gas_limit, "<gc checkpoint>");
      goto cleanup;
    }
    output = format_exception(ctx, gas_limit, "<exception>");
    goto cleanup;
  }

  JSValue json = JS_JSONStringify(ctx, result, JS_UNDEFINED, JS_UNDEFINED);
  JS_FreeValue(ctx, result);

  if (JS_IsException(json)) {
    if (run_gc_checkpoint(ctx) != 0) {
      output = format_exception(ctx, gas_limit, "<gc checkpoint>");
      goto cleanup;
    }
    output = format_exception(ctx, gas_limit, "<stringify>");
    JS_FreeValue(ctx, json);
    goto cleanup;
  }

  const char *json_str = JS_ToCString(ctx, json);
  if (!json_str) {
    uint64_t remaining = JS_GetGasRemaining(ctx);
    output = format_with_gas("ERROR", "<stringify>", gas_limit, remaining);
    JS_FreeValue(ctx, json);
    goto cleanup;
  }

  if (run_gc_checkpoint(ctx) != 0) {
    output = format_exception(ctx, gas_limit, "<gc checkpoint>");
    JS_FreeCString(ctx, json_str);
    JS_FreeValue(ctx, json);
    goto cleanup;
  }

  uint64_t remaining = JS_GetGasRemaining(ctx);
  output = format_with_gas("RESULT", json_str, gas_limit, remaining);

  JS_FreeCString(ctx, json_str);
  JS_FreeValue(ctx, json);

cleanup:
  if (ctx) {
    JS_FreeContext(ctx);
  }
  if (rt) {
    JS_FreeRuntime(rt);
  }
  if (!output) {
    return dup_printf("ERROR <internal> GAS remaining=0 used=0");
  }
  return output;
}

EMSCRIPTEN_KEEPALIVE
void qjs_free_output(char *ptr) {
  if (ptr) {
    free(ptr);
  }
}
