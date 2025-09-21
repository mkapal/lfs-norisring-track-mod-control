// TODO
export default function parseLFSMessage(msg: Uint8Array | string): string {
  if (typeof msg === "string") {
    return msg;
  }

  const decodedText = new TextDecoder().decode(msg);

  return decodedText.replace(/\0+$/, "");
}
