import { describe, expect, it } from "vitest";

import { oggOpusDurationSeconds } from "./kapso-audio-usage";

// Builds one minimal Ogg page: "OggS" header + a granule position +
// a single-segment payload. Real Ogg pages carry a CRC, a serial
// number and a real page sequence — none of those are read by
// oggOpusDurationSeconds, so they're left as zero bytes here.
function oggPage(granulePosition: bigint, payload: Buffer): Buffer {
  const header = Buffer.alloc(27);
  header.write("OggS", 0, "ascii");
  header.writeUInt8(0, 4); // version
  header.writeUInt8(0, 5); // header type flag
  header.writeUInt32LE(Number(granulePosition & BigInt(0xffffffff)), 6);
  header.writeUInt32LE(Number((granulePosition >> BigInt(32)) & BigInt(0xffffffff)), 10);
  // bytes 14-25: serial number, page sequence, CRC — left as 0, unused by the parser
  header.writeUInt8(1, 26); // page_segments
  const segmentTable = Buffer.from([payload.length]);
  return Buffer.concat([header, segmentTable, payload]);
}

function opusHeadPayload(preSkip: number): Buffer {
  const payload = Buffer.alloc(19);
  payload.write("OpusHead", 0, "ascii");
  payload.writeUInt8(1, 8); // version
  payload.writeUInt8(1, 9); // channel count
  payload.writeUInt16LE(preSkip, 10);
  payload.writeUInt32LE(48000, 12); // original input sample rate (informational)
  payload.writeUInt16LE(0, 16); // output gain
  payload.writeUInt8(0, 18); // channel mapping family
  return payload;
}

describe("oggOpusDurationSeconds", () => {
  it("computes duration from the last page's granule position minus pre-skip", () => {
    const preSkip = 500;
    const lastGranule = BigInt(50_000);

    const headPage = oggPage(BigInt(0), opusHeadPayload(preSkip));
    const dataPage = oggPage(lastGranule, Buffer.from([0x01]));
    const buf = Buffer.concat([headPage, dataPage]);

    // (50000 - 500) / 48000 = 1.03125s
    expect(oggOpusDurationSeconds(buf)).toBeCloseTo(1.03125, 6);
  });

  it("sums correctly across more than two pages, using only the last granule", () => {
    const preSkip = 0;
    const headPage = oggPage(BigInt(0), opusHeadPayload(preSkip));
    const midPage = oggPage(BigInt(24_000), Buffer.from([0x01]));
    const lastPage = oggPage(BigInt(96_000), Buffer.from([0x01]));
    const buf = Buffer.concat([headPage, midPage, lastPage]);

    expect(oggOpusDurationSeconds(buf)).toBeCloseTo(2, 6);
  });

  it("returns null for garbage input that isn't a valid Ogg/Opus stream", () => {
    expect(oggOpusDurationSeconds(Buffer.from("not an ogg file at all"))).toBeNull();
    expect(oggOpusDurationSeconds(Buffer.alloc(0))).toBeNull();
  });

  it("returns null when there's no OpusHead packet (e.g. a Vorbis Ogg file)", () => {
    const page = oggPage(BigInt(50_000), Buffer.from("not opus head", "ascii"));
    expect(oggOpusDurationSeconds(page)).toBeNull();
  });
});
