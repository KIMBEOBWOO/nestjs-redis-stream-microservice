export type RedisStreamMessageProperty = string;

// 단일 메시지의 필드/값 쌍을 나타내는 타입
export type RedisStreamMessageFields = RedisStreamMessageProperty[]; // 필드와 값들이 번갈아 배열로 제공

// 단일 메시지를 나타내는 타입
export type RedisStreamMessage = [string, RedisStreamMessageFields]; // [messageId, [field1, value1, ...]]

// 단일 스트림의 데이터를 나타내는 타입
export type RedisStreamData = [string, RedisStreamMessage[]]; // [streamKey, [messageId, [field1, value1, ...]]]

// xreadgroup의 전체 반환 타입
export type XReadGroupRawResult = RedisStreamData[];
