import { Transform, TransformCallback } from 'stream'
import { MSG_ID_MAGIC_NUMBER } from './magic-numbers'

export function x25crc(buffer: Buffer, start = 0, trim = 0, magic = null) {
  let crc = 0xffff;
  
  for (let i = start; i < buffer.length - trim; i++) {
    const byte = buffer[i]
    let tmp = (byte & 0xff) ^ (crc & 0xff);
    tmp ^= tmp << 4;
    tmp &= 0xff;
    crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
    crc &= 0xffff;
  }

  if (magic !== null) {
    let tmp = (magic & 0xff) ^ (crc & 0xff);
    tmp ^= tmp << 4;
    tmp &= 0xff;
    crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
    crc &= 0xffff;
  }

  return crc;
}

export function dump(buffer: Buffer, lineWidth = 10) {
  const line = []
  for (let i = 0; i < buffer.length; i++) {
    line.push(buffer[i].toString(16).padStart(2, '0') + ' ')
    if (line.length === lineWidth) {
      console.error(line.join(' '))
      line.length = 0
    }
  }
  if (line.length > 0) {
    console.error(line.join(' '))
  }
}

export const MAVLINK_MAGIC_NUMBER    = 0xFD
export const MAVLINK_PAYLOAD_OFFSET  = 0x0A
export const MAVLINK_CHECKSUM_LENGTH = 0x02

export type char = number
export type uint8_t = number
export type int8_t = number
export type uint16_t = number
export type int16_t = number
export type uint32_t = number
export type int32_t = number
export type uint8_t_mavlink_version = number
export type float = number
export type int64_t = BigInt
export type uint64_t = BigInt
export type double = number

/**
 * Header definition of the MavLink packet
 */
 export class MavLinkPacketHeader {
  magic: number = MAVLINK_MAGIC_NUMBER
  payloadLength: uint8_t = 0
  incompatibilityFlags: uint8_t = 0
  compatibilityFlags: uint8_t = 0
  seq: uint8_t = 0
  sysid: uint8_t = 0
  compid: uint8_t = 0
  msgid: uint8_t = 0
}

/**
 * Field definition
 */
export class MavLinkPacketField {
  readonly name: string
  readonly type: string
  readonly length: number
  readonly offset: number
  readonly extension: boolean

  constructor(name, offset, extension, type, length = 0) {
    this.name = name
    this.offset = offset
    this.type = type
    this.length = length
    this.extension = extension
  }
}

/**
 * A dictionary containing functions that deserialize a certain value based on the field type
 */
export const DESERIALIZERS = {
  // special types
  'uint8_t_mavlink_version': (buffer: Buffer, offset: number) => buffer.readUInt8(offset),

  // singular types
  'char'    : (buffer: Buffer, offset: number) => String.fromCharCode(buffer.readUInt8(offset)),
  'int8_t'  : (buffer: Buffer, offset: number) => buffer.readInt8(offset),
  'uint8_t' : (buffer: Buffer, offset: number) => buffer.readUInt8(offset),
  'int16_t' : (buffer: Buffer, offset: number) => buffer.readInt16LE(offset),
  'uint16_t': (buffer: Buffer, offset: number) => buffer.readUInt16LE(offset),
  'int32_t' : (buffer: Buffer, offset: number) => buffer.readInt32LE(offset),
  'uint32_t': (buffer: Buffer, offset: number) => buffer.readUInt32LE(offset),
  'int64_t' : (buffer: Buffer, offset: number) => buffer.readBigInt64LE(offset),
  'uint64_t': (buffer: Buffer, offset: number) => buffer.readBigUInt64LE(offset),
  'float'   : (buffer: Buffer, offset: number) => buffer.readFloatLE(offset),
  'double'  : (buffer: Buffer, offset: number) => buffer.readDoubleLE(offset),

  // array types
  'char[]': (buffer: Buffer, offset: number, length: number) => {
    let result = ''
    for (let i = 0; i < length; i++) {
      const charCode = buffer.readUInt8(offset + i)
      if (charCode !== 0) {
        result += String.fromCharCode(charCode)
      } else {
        break
      }
    }
    return result
  },
  'int8_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readInt8(offset + i)
    return result
  },
  'uint8_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readUInt8(offset + i)
    return result
  },
  'int16_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readInt16LE(offset + i * 2)
    return result
  },
  'uint16_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readUInt16LE(offset + i * 2)
    return result
  },
  'int32_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readInt32LE(offset + i * 4)
    return result
  },
  'uint32_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readUInt32LE(offset + i * 4)
    return result
  },
  'int64_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<BigInt>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readBigInt64LE(offset + i * 8)
    return result
  },
  'uint64_t[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<BigInt>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readBigUInt64LE(offset + i * 8)
    return result
  },
  'float[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readFloatLE(offset + i * 8)
    return result
  },
  'double[]': (buffer: Buffer, offset: number, length: number) => {
    const result = new Array<number>(length)
    for (let i = 0; i < length; i++) result[i] = buffer.readFloatLE(offset + i * 8)
    return result
  },
}

/**
 * Base class for all data classes
 */
export abstract class MavLinkData {
  static MSG_ID: number = -1
  static FIELDS: MavLinkPacketField[] = []
}

interface MavLinkDataConstructor<T extends MavLinkData> {
  // static fields overriden by descendants of MavLinkData
  MSG_ID: number
  FIELDS: MavLinkPacketField[]

  new (): T
}

/**
 * MavLink packet definition
 */
export class MavLinkPacket {
  constructor(
    readonly header: MavLinkPacketHeader = new MavLinkPacketHeader(),
    readonly payload: Buffer = Buffer.from(new Uint8Array(255)),
    readonly crc: uint16_t = 0,
  ) {}
  
  deserialize<T extends MavLinkData>(clazz: MavLinkDataConstructor<T>): T {
    if (this.header.msgid !== clazz.MSG_ID) {
      throw new Error(`Incompatible message id: expected ${this.header.msgid}, got ${clazz.MSG_ID}`)
    }

    const instance = new clazz()
    clazz.FIELDS.forEach(field => {
      const deserialize = DESERIALIZERS[field.type]
      if (!deserialize) {
        throw new Error(`Unknown field type ${field.type}`)
      }
      instance[field.name] = deserialize(this.payload, field.offset, field.length)
    })
    
    return instance
  }
}

/**
 * A transform stream that splits the incomming data stream into MavLink packages
 */
 export class MavLinkPacketSplitter extends Transform {
  private buffer = Buffer.from([])
  
  _transform(chunk: Buffer, encoding, callback: TransformCallback) {
    this.buffer = Buffer.concat([ this.buffer, chunk ])

    while (true) {
      const magicNumberFirstOffset = this.buffer.indexOf(MAVLINK_MAGIC_NUMBER)
      if (magicNumberFirstOffset === -1) {
        break
      } else {
        this.buffer = this.buffer.slice(magicNumberFirstOffset)
        const payloadLength = this.buffer.readUInt8(1)
        const expectedBufferLength = MAVLINK_PAYLOAD_OFFSET + payloadLength + MAVLINK_CHECKSUM_LENGTH
        if (this.buffer.length >= expectedBufferLength) {
          const buffer = this.buffer.slice(0, expectedBufferLength)
          const msgid = buffer.readUIntLE(7, 3)
          const magic = MSG_ID_MAGIC_NUMBER[msgid]
          if (magic) {
            const crc = buffer.readUInt16LE(MAVLINK_PAYLOAD_OFFSET + payloadLength)
            const crc2 = x25crc(buffer, 1, 2, magic)
            if (crc === crc2) {
              this.push(buffer)
            } else {
              console.error(
                'CRC error; expected', crc2, `(0x${crc2.toString(16).padStart(4, '0')})`,
                'got', crc, `(0x${crc.toString(16).padStart(4, '0')})`,
                '; msgid:', msgid, ', magic:', magic
              )
              dump(buffer, 28)
              process.exit(0)
            }
          }
          this.buffer = this.buffer.slice(expectedBufferLength)
        } else {
          break
        }
      }
    }

    callback(null)
  }
}

/**
 * A transform stream that takes a buffer with data and converts it to MavLinkPacket object
 */
 export class MavLinkPacketParser extends Transform {
  constructor(opts = {}) {
    super({ ...opts, objectMode: true })
  }

  _transform(chunk: Buffer, encoding, callback: TransformCallback) {
    const header = new MavLinkPacketHeader()
    header.magic = chunk.readUInt8(0)
    header.payloadLength = chunk.readUInt8(1)
    header.incompatibilityFlags = chunk.readUInt8(2)
    header.compatibilityFlags = chunk.readUInt8(3)
    header.seq = chunk.readUInt8(4)
    header.sysid = chunk.readUInt8(5)
    header.compid = chunk.readUInt8(6)
    header.msgid = chunk.readUIntLE(7, 3)

    const padding = Buffer.from(new Uint8Array(288 - chunk.length))
    const payload = Buffer.concat([ chunk, padding ]).slice(10)
    const crc = chunk.readUInt16LE(chunk.length - 2)
    const packet = new MavLinkPacket(header, payload, crc)
    
    callback(null, packet)
  }
}
