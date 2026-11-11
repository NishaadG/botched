"use client";

/**
 * Browser side of Nexconn Chat. One shared connection per tab; components subscribe to messages.
 * The SDK is imported lazily so it never runs during server rendering.
 */

export interface IncomingMessage {
  id: string;
  channelId: string;
  from: string;
  type: string;
  text?: string;
  data?: Record<string, unknown>;
  at: number;
}

type Listener = (m: IncomingMessage) => void;
type StatusListener = (s: "connecting" | "connected" | "disconnected") => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<StatusListener>();
let connecting: Promise<string> | null = null;
let connectedUser: string | null = null;

export const GAME_EVENT = "BT:Game";
export const TYPING = "BT:Typing";

type ChatModule = typeof import("@nexconn/chat");
let mod: ChatModule | null = null;
async function sdk() {
  return (mod ??= await import("@nexconn/chat"));
}

function toIncoming(m: {
  messageId: string;
  channelIdentifier: { channelId: string };
  senderUserId: string;
  messageType: string;
  content: Record<string, unknown>;
  sentTime: number;
}): IncomingMessage {
  const content = m.content ?? {};
  return {
    id: m.messageId,
    channelId: m.channelIdentifier.channelId,
    from: m.senderUserId,
    type: m.messageType,
    text: typeof content.text === "string" ? content.text : typeof content.content === "string" ? content.content : undefined,
    data: m.messageType.startsWith("BT:") ? content : undefined,
    at: m.sentTime,
  };
}

export function connectChat(appKey: string, token: string, userId: string) {
  if (connectedUser === userId && connecting) return connecting;
  connecting = (async () => {
    const { NCEngine, MessageHandler, ConnectionStatusHandler, ConnectionStatus, AreaCode, LogLevel } = await sdk();
    if (!connectedUser) {
      NCEngine.initialize({ appKey, areaCode: AreaCode.SG, logLevel: LogLevel.ERROR });
      NCEngine.registerCustomMessages([
        { messageType: GAME_EVENT, isPersisted: true, isCounted: false },
        { messageType: TYPING, isPersisted: false, isCounted: false, isStatusMessage: true },
      ]);
      NCEngine.addMessageHandler(
        "botched",
        new MessageHandler({
          onMessageReceived({ messages }) {
            for (const m of messages) {
              const msg = toIncoming(m as never);
              if (process.env.NODE_ENV !== "production") console.debug("[nc]", msg.type, msg.from, msg.at, msg.text ?? "");
              listeners.forEach((l) => l(msg));
            }
          },
        }),
      );
      NCEngine.addConnectionStatusHandler(
        "botched",
        new ConnectionStatusHandler({
          onConnectionStatusChanged({ status }) {
            const s =
              status === ConnectionStatus.CONNECTED
                ? "connected"
                : status === ConnectionStatus.CONNECTING
                  ? "connecting"
                  : "disconnected";
            statusListeners.forEach((l) => l(s));
          },
        }),
      );
    } else {
      await NCEngine.disconnect();
    }
    const result = await NCEngine.connect({ token });
    if (!result.isOk) {
      connecting = null;
      throw new Error(`Chat connection failed (code ${result.code})`);
    }
    connectedUser = userId;
    statusListeners.forEach((l) => l("connected"));
    return userId;
  })();
  return connecting;
}

export function onMessage(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function onStatus(listener: StatusListener) {
  statusListeners.add(listener);
  return () => void statusListeners.delete(listener);
}

export async function sendGroupText(channelId: string, text: string) {
  const { GroupChannel, SendTextMessageParams } = await sdk();
  const result = await new GroupChannel(channelId).sendMessage(new SendTextMessageParams({ text }));
  if (!result.isOk || !result.data) throw new Error(`Send failed (code ${result.code})`);
  return toIncoming(result.data as never);
}

let lastTyping = 0;
export async function sendTyping(channelId: string) {
  if (Date.now() - lastTyping < 2500) return;
  lastTyping = Date.now();
  const { GroupChannel, SendMessageParams } = await sdk();
  await new GroupChannel(channelId).sendMessage(new SendMessageParams({ kind: "typing" }, TYPING)).catch(() => {});
}

export async function sendOpenText(channelId: string, text: string) {
  const { OpenChannel, SendTextMessageParams } = await sdk();
  const result = await new OpenChannel(channelId).sendMessage(new SendTextMessageParams({ text }));
  if (!result.isOk || !result.data) throw new Error(`Send failed (code ${result.code})`);
  return toIncoming(result.data as never);
}

export async function enterOpenChannel(channelId: string, messageCount = 30) {
  const { OpenChannel } = await sdk();
  const result = await new OpenChannel(channelId).enterChannel({ messageCount });
  if (!result.isOk) throw new Error(`Could not enter the lounge (code ${result.code})`);
}

export async function exitOpenChannel(channelId: string) {
  const { OpenChannel } = await sdk();
  await new OpenChannel(channelId).exitChannel().catch(() => {});
}

export async function loadHistory(channelId: string, pageSize = 50) {
  const { BaseChannel, ChannelIdentifier, ChannelType } = await sdk();
  const query = BaseChannel.createMessagesQuery({
    channelIdentifier: new ChannelIdentifier(ChannelType.GROUP, channelId),
    isAscending: false,
    pageSize,
  });
  const result = await query.loadNextPage();
  if (!result.isOk || !result.data) return [];
  return result.data.data.map((m) => toIncoming(m as never)).reverse();
}
