export class GraphRequestError extends Error {
  readonly status: number;
  readonly graphMessage: string | null;

  constructor(message: string, status: number, graphMessage: string | null) {
    super(message);
    this.name = "GraphRequestError";
    this.status = status;
    this.graphMessage = graphMessage;
  }
}

function graphUrl(version: string, path: string): string {
  const cleanVersion = version.replace(/^\/+|\/+$/g, "");
  return `https://graph.facebook.com/${cleanVersion}/${path.replace(/^\/+/, "")}`;
}

async function assertGraphOk(
  response: Response,
  action: string,
): Promise<void> {
  if (response.ok) {
    return;
  }

  const responseText = await response.text().catch(() => "");
  let graphMessage: string | null = null;
  if (responseText) {
    try {
      const body = JSON.parse(responseText) as {
        error?: { message?: unknown };
      };
      graphMessage =
        typeof body.error?.message === "string" ? body.error.message : null;
    } catch {
      graphMessage = null;
    }
  }

  throw new GraphRequestError(
    `${action} failed with status ${response.status}`,
    response.status,
    graphMessage,
  );
}

export async function sendMessengerText(params: {
  graphApiVersion: string;
  pageAccessToken: string;
  recipientId: string;
  text: string;
}): Promise<void> {
  const response = await fetch(
    graphUrl(params.graphApiVersion, "me/messages"),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.pageAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: params.recipientId },
        messaging_type: "RESPONSE",
        message: { text: params.text },
      }),
    },
  );

  await assertGraphOk(response, "Messenger send");
}

export async function replyToComment(params: {
  graphApiVersion: string;
  pageAccessToken: string;
  commentId: string;
  text: string;
}): Promise<void> {
  const response = await fetch(
    graphUrl(
      params.graphApiVersion,
      `${encodeURIComponent(params.commentId)}/comments`,
    ),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.pageAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: params.text }),
    },
  );

  await assertGraphOk(response, "Comment reply");
}
