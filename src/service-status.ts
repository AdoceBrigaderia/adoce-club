export function serviceStatusMessage({
  open,
  paused,
  channelMessage,
  scheduleMessage,
  pausedMessage,
}: {
  open: boolean;
  paused: boolean;
  channelMessage?: string | null;
  scheduleMessage: string;
  pausedMessage: string;
}) {
  if (paused) return pausedMessage;
  if (!open) return scheduleMessage;
  return channelMessage?.trim() || scheduleMessage;
}
