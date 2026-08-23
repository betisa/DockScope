import { promises as fs } from 'node:fs'

type ZipEntry = {
  name: string
  data: Buffer
  crc: number
  offset: number
  dosTime: number
  dosDate: number
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosTimestamp(value = new Date()) {
  const year = Math.max(1980, value.getFullYear())
  const dosTime = ((value.getHours() & 0x1f) << 11) |
    ((value.getMinutes() & 0x3f) << 5) |
    ((Math.floor(value.getSeconds() / 2)) & 0x1f)
  const dosDate = (((year - 1980) & 0x7f) << 9) |
    (((value.getMonth() + 1) & 0x0f) << 5) |
    (value.getDate() & 0x1f)
  return { dosTime, dosDate }
}

function localHeader(entry: ZipEntry) {
  const name = Buffer.from(entry.name.replaceAll('\\', '/'), 'utf8')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0x0800, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(entry.dosTime, 10)
  header.writeUInt16LE(entry.dosDate, 12)
  header.writeUInt32LE(entry.crc, 14)
  header.writeUInt32LE(entry.data.length, 18)
  header.writeUInt32LE(entry.data.length, 22)
  header.writeUInt16LE(name.length, 26)
  header.writeUInt16LE(0, 28)
  return Buffer.concat([header, name])
}

function centralHeader(entry: ZipEntry) {
  const name = Buffer.from(entry.name.replaceAll('\\', '/'), 'utf8')
  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0x0800, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(entry.dosTime, 12)
  header.writeUInt16LE(entry.dosDate, 14)
  header.writeUInt32LE(entry.crc, 16)
  header.writeUInt32LE(entry.data.length, 20)
  header.writeUInt32LE(entry.data.length, 24)
  header.writeUInt16LE(name.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(entry.offset, 42)
  return Buffer.concat([header, name])
}

export async function writeZip(
  target: string,
  files: Array<{ name: string; content: string | Buffer }>
) {
  const parts: Buffer[] = []
  const entries: ZipEntry[] = []
  let offset = 0
  const stamp = dosTimestamp()

  for (const file of files) {
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8')
    const entry: ZipEntry = {
      name: file.name,
      data,
      crc: crc32(data),
      offset,
      dosTime: stamp.dosTime,
      dosDate: stamp.dosDate
    }
    const header = localHeader(entry)
    parts.push(header, data)
    offset += header.length + data.length
    entries.push(entry)
  }

  const centralOffset = offset
  const central = entries.map(centralHeader)
  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  parts.push(...central)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralOffset, 16)
  end.writeUInt16LE(0, 20)
  parts.push(end)

  await fs.writeFile(target, Buffer.concat(parts))
  const stat = await fs.stat(target)
  return { fileCount: entries.length, sizeBytes: stat.size }
}
