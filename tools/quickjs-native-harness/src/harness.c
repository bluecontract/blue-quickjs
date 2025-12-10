#include "quickjs.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  JSRuntime *rt;
  JSContext *ctx;
} HarnessRuntime;

static int init_runtime(HarnessRuntime *runtime) {
  if (JS_NewDeterministicRuntime(&runtime->rt, &runtime->ctx) != 0) {
    fprintf(stderr, "init: JS_NewDeterministicRuntime failed\n");
    return 1;
  }

  return 0;
}

static void free_runtime(HarnessRuntime *runtime) {
  if (runtime->ctx) {
    JS_FreeContext(runtime->ctx);
    runtime->ctx = NULL;
  }
  if (runtime->rt) {
    JS_FreeRuntime(runtime->rt);
    runtime->rt = NULL;
  }
}

static int print_exception(JSContext *ctx) {
  JSValue exception = JS_GetException(ctx);
  const char *msg = JS_ToCString(ctx, exception);
  if (msg) {
    fprintf(stdout, "ERROR %s\n", msg);
    JS_FreeCString(ctx, msg);
  } else {
    fprintf(stdout, "ERROR <exception>\n");
  }
  JS_FreeValue(ctx, exception);
  return 1;
}

static int eval_source(JSContext *ctx, const char *code) {
  JSValue result = JS_Eval(ctx, code, strlen(code), "<eval>", JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(result)) {
    JS_FreeValue(ctx, result);
    return print_exception(ctx);
  }

  JSValue json = JS_JSONStringify(ctx, result, JS_UNDEFINED, JS_UNDEFINED);
  JS_FreeValue(ctx, result);

  if (JS_IsException(json)) {
    return print_exception(ctx);
  }

  const char *json_str = JS_ToCString(ctx, json);
  if (!json_str) {
    JS_FreeValue(ctx, json);
    fprintf(stdout, "ERROR <stringify>\n");
    return 1;
  }

  fprintf(stdout, "RESULT %s\n", json_str);

  JS_FreeCString(ctx, json_str);
  JS_FreeValue(ctx, json);
  return 0;
}

static void print_usage(const char *prog) {
  fprintf(stderr, "Usage: %s --eval \"<js-source>\"\n", prog);
}

int main(int argc, char **argv) {
  if (argc < 3 || strcmp(argv[1], "--eval") != 0) {
    print_usage(argv[0]);
    return 2;
  }

  const char *code = argv[2];
  HarnessRuntime runtime = {0};

  if (init_runtime(&runtime) != 0) {
    free_runtime(&runtime);
    return 1;
  }

  int rc = eval_source(runtime.ctx, code);
  free_runtime(&runtime);
  return rc;
}
