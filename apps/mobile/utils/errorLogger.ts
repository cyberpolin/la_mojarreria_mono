import * as Sentry from "@sentry/react-native";

type ErrorReportContext = {
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export const reportError = (
  error: unknown,
  context: ErrorReportContext = {},
) => {
  Sentry.captureException(error, {
    tags: context.tags,
    extra: {
      ...(context.extra ?? {}),
      componentStack: context.componentStack,
    },
  });

  console.error("[ErrorLogger]", error, context);
};
